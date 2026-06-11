from .base import *

# Override email backend for local development to print to console
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Additional development-specific settings
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
