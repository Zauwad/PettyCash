import os
from pathlib import Path
import environ

# Setup environ
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ['*']),
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# Note: Since this file is in oms_project/settings/, BASE_DIR is three levels up.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Read environment file if it exists
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# Quick-start development settings - unsuitable for production
SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS')
if os.environ.get('VERCEL') == '1':
    ALLOWED_HOSTS.extend(['.vercel.app', '*'])


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party Apps
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'django_filters',
    'django_fsm',
    'auditlog',
    'simple_history',
    'drf_spectacular',
    
    # Custom Apps (to be created)
    'core',
    'accounts',
    'pettycash',
    'leave',
    'approvals',
    'analytics',
    'notifications',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Should be as high as possible
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
    # Custom Multitenant Middleware (to be created)
    'core.middleware.OrganizationMiddleware',
    
    # Simple History Middleware
    'simple_history.middleware.HistoryRequestMiddleware',
]

ROOT_URLCONF = 'oms_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'oms_project.wsgi.application'
ASGI_APPLICATION = 'oms_project.asgi.application'

# Database Configuration (MySQL / SQLite Fallback on Vercel)
if 'DATABASE_URL' in os.environ:
    DATABASES = {
        'default': env.db('DATABASE_URL')
    }
elif os.environ.get('VERCEL') == '1':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': '/tmp/db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': env.db('DATABASE_URL', default=f"mysql://{env('DB_USER')}:{env('DB_PASSWORD')}@{env('DB_HOST')}:{env('DB_PORT')}/{env('DB_NAME')}")
    }


# Custom User Model
AUTH_USER_MODEL = 'auth.User'  # We will extend User via Profile model as per ERD

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dhaka'  # Set to Bangladesh time zone
USE_I18N = True
USE_TZ = True

# Static & Media Files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPageNumberPagination',
    'PAGE_SIZE': 20,
}

# SimpleJWT Config
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = True  # For dev, we will restrict in production settings

# Celery settings
CELERY_BROKER_URL = env('CELERY_BROKER_URL')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE



# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST')
EMAIL_PORT = env('EMAIL_PORT')
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
EMAIL_USE_TLS = env('EMAIL_USE_TLS')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL')

# Third-Party API Keys
SERPAPI_KEY = env('SERPAPI_KEY', default='')

# Spectacular API doc settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'OMS API',
    'DESCRIPTION': 'Operations Management System API for A Maze Venture, mYnt Connect, and Braincount',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
