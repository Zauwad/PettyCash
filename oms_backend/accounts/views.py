from django.shortcuts import render
from rest_framework import viewsets, status, mixins
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User

from core.mixins import OrganizationViewSetMixin
from core.permissions import IsOrganizationMember
from core.models import Department
from accounts.models import UserProfile, UserRole
from accounts.serializers import (
    UserSerializer,
    UserProfileUpdateSerializer,
    CustomTokenObtainPairSerializer,
    UserCreateSerializer,
    DepartmentSummarySerializer
)

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login view that runs SimpleJWT token acquisition
    and appends user/tenant metadata in the success response payload.
    """
    serializer_class = CustomTokenObtainPairSerializer


class MeView(APIView):
    """
    Endpoint for fetching and partially updating the logged-in user profile.
    Supports GET (me details) and PATCH (update phone/avatar).
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Returns serializer payload of request.user."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
        
    def patch(self, request):
        """Allows user to update phone and avatar_url."""
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Return updated user object
            return Response(UserSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(
    OrganizationViewSetMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    """
    ViewSet to allow listing, retrieving, and creating users.
    Scoped by the tenant organization (regular users only see their own org peers).
    """
    queryset = User.objects.all().select_related('profile', 'profile__organization', 'profile__department')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    
    # Custom tenant filter path for User model (scopes queryset through profile relation)
    tenant_filter_path = "profile__organization"
    
    filterset_fields = ['profile__department', 'profile__role']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'profile__employee_id']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        actor = request.user
        actor_profile = getattr(actor, 'profile', None)
        
        is_actor_hr = False
        if actor_profile and actor_profile.department:
            is_actor_hr = "HR" in actor_profile.department.name.upper()
            
        if not actor_profile or (actor_profile.role not in [UserRole.CEO, UserRole.ADMIN] and not is_actor_hr):
            return Response(
                {"detail": "Only CEOs, Admins, or HR department members can create user accounts."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        
        # Log to AuditLog
        new_user = serializer.instance
        from core.models import AuditLog
        AuditLog.objects.create(
            organization=actor_profile.organization,
            actor=actor,
            action="USER_CREATED",
            target_type="User",
            target_id=new_user.id,
            new_state="active",
            reason=f"User account created by {actor.username}",
            metadata={"username": new_user.username, "role": new_user.profile.role}
        )
        
        return Response(UserSerializer(new_user).data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post', 'patch'], url_path='change-role')
    def change_role(self, request, pk=None):
        """
        Custom action to allow CEOs, Admins, or members of the HR department 
        to change the role of an employee in their organization.
        """
        user_to_update = self.get_object()
        actor = request.user
        
        # Check if the actor is in the HR department
        actor_profile = getattr(actor, 'profile', None)
        is_actor_hr = False
        if actor_profile and actor_profile.department:
            is_actor_hr = "HR" in actor_profile.department.name.upper()
            
        # Permission check: Only CEO, ADMIN, or HR department members can change roles
        if not actor_profile or (actor_profile.role not in [UserRole.CEO, UserRole.ADMIN] and not is_actor_hr):
            return Response(
                {"detail": "Only CEOs, Admins, or HR department members can change user roles."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Self-update prevention: Cannot change your own role
        if user_to_update == actor:
            return Response(
                {"detail": "You cannot change your own role."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        new_role = request.data.get('role')
        if not new_role:
            return Response(
                {"role": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if new_role not in UserRole.values:
            return Response(
                {"role": [f"Invalid role. Must be one of: {', '.join(UserRole.values)}"]},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Admin restriction: Non-admins cannot assign ADMIN role
        if actor_profile.role != UserRole.ADMIN and new_role == UserRole.ADMIN:
            return Response(
                {"detail": "Only Global Admins can assign the Global Admin role."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Update user profile role
        profile = user_to_update.profile
        old_role = profile.role
        profile.role = new_role
        profile.save()
        
        # Log to AuditLog
        from core.models import AuditLog
        AuditLog.objects.create(
            organization=actor_profile.organization,
            actor=actor,
            action="ROLE_CHANGED",
            target_type="UserProfile",
            target_id=profile.id,
            old_state=old_role,
            new_state=new_role,
            reason=f"Role changed from {old_role} to {new_role}",
            metadata={"user_id": user_to_update.id, "new_role": new_role, "old_role": old_role}
        )
        
        return Response(UserSerializer(user_to_update).data)


class DepartmentViewSet(OrganizationViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet to allow listing and retrieving departments scoped to the organization.
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSummarySerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]

