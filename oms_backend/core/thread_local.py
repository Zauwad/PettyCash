import threading

# Thread-local storage to hold the request and user context
_thread_locals = threading.local()

def get_current_user():
    """Returns the authenticated user for the current request thread."""
    return getattr(_thread_locals, 'user', None)

def set_current_user(user):
    """Sets the authenticated user for the current request thread."""
    _thread_locals.user = user

def get_current_request():
    """Returns the active request object for the current request thread."""
    return getattr(_thread_locals, 'request', None)

def set_current_request(request):
    """Sets the active request object for the current request thread."""
    _thread_locals.request = request
