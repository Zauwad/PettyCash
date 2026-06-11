from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken
from core.thread_local import set_current_user, set_current_request
from django.http import HttpRequest

# Dynamically add organization property to HttpRequest class.
# This ensures that request.organization is resolved lazily and dynamically,
# which works even when request.user is set after the middleware runs (e.g. in DRF tests).
@property
def http_request_organization(self):
    if not hasattr(self, '_organization_cache'):
        self._organization_cache = None
        if self.user and not self.user.is_anonymous:
            try:
                if hasattr(self.user, 'profile'):
                    self._organization_cache = self.user.profile.organization
            except Exception:
                pass
    return self._organization_cache

HttpRequest.organization = http_request_organization


class OrganizationMiddleware(MiddlewareMixin):
    """
    Middleware to attach organization to the request object.
    
    Acts as Layer 1 isolation: reads user profile and attaches request.organization.
    Since SimpleJWT authentication happens in the REST framework view layer,
    this middleware manually attempts JWT authentication on the incoming request
    if the standard Django Session auth has not populated request.user.
    """
    def process_request(self, request):
        # If user is not yet authenticated via sessions/cookies
        if not request.user or request.user.is_anonymous:
            try:
                # Perform manual JWT token verification from the Authorization header
                jwt_auth = JWTAuthentication()
                header = jwt_auth.get_header(request)
                if header:
                    raw_token = jwt_auth.get_raw_token(header)
                    validated_token = jwt_auth.get_validated_token(raw_token)
                    user = jwt_auth.get_user(validated_token)
                    request.user = user
            except (InvalidToken, AuthenticationFailed, Exception):
                # Ignore failures; let standard DRF views handle the 401/403 permission denied later
                pass

        # Store in thread locals
        set_current_request(request)
        if request.user and not request.user.is_anonymous:
            set_current_user(request.user)

    def process_response(self, request, response):
        # Clear thread locals on response to avoid leak
        set_current_request(None)
        set_current_user(None)
        return response

    def process_exception(self, request, exception):
        # Clear thread locals on exception to avoid leak
        set_current_request(None)
        set_current_user(None)
        return None

