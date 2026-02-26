import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(PROJECT_ROOT / '.env')
load_dotenv(BASE_DIR / '.env')


def env(key: str, default: str | None = None) -> str | None:
    return os.getenv(key, default)


def env_list(key: str, default: str = '') -> list[str]:
    raw = os.getenv(key, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


SECRET_KEY = env('DJANGO_SECRET_KEY', 'dev-only-secret-key')
DEBUG = env('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = [h.strip() for h in env('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,backend').split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'apps.accounts',
    'apps.projects',
    'apps.scans',
    'apps.findings',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'scannrai.middleware.ScanCreateRateLimitMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'scannrai.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'scannrai.wsgi.application'
ASGI_APPLICATION = 'scannrai.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('POSTGRES_DB', 'scannrai'),
        'USER': env('POSTGRES_USER', 'scannrai'),
        'PASSWORD': env('POSTGRES_PASSWORD', 'scannrai'),
        'HOST': env('POSTGRES_HOST', 'postgres'),
        'PORT': env('POSTGRES_PORT', '5432'),
    }
}

if env('USE_SQLITE', '0') == '1':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = env('DJANGO_TIME_ZONE', 'UTC')
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': int(env('API_PAGE_SIZE', '20')),
}

CACHES = {
    'default': {
        'BACKEND': env('DJANGO_CACHE_BACKEND', 'django.core.cache.backends.locmem.LocMemCache'),
        'LOCATION': env('DJANGO_CACHE_LOCATION', 'scannrai-default-cache'),
    }
}

CELERY_BROKER_URL = env('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = int(env('CELERY_TASK_TIME_LIMIT', '1800'))

SCAN_WORKDIR = env('SCAN_WORKDIR', '/tmp/scannrai')
SCAN_SHARED_UPLOAD_DIR = env('SCAN_SHARED_UPLOAD_DIR', str(PROJECT_ROOT / '.scan-uploads'))
SCAN_RETENTION_SECONDS = int(env('SCAN_RETENTION_SECONDS', '86400'))
SCAN_TOOL_TIMEOUT_SECONDS = int(env('SCAN_TOOL_TIMEOUT_SECONDS', '600'))
SCAN_TOOL_MEMORY_LIMIT_MB = int(env('SCAN_TOOL_MEMORY_LIMIT_MB', '2048'))
SCAN_TOOL_CPU_TIME_SECONDS = int(env('SCAN_TOOL_CPU_TIME_SECONDS', '600'))
SCAN_TOOL_LOG_MAX_CHARS = int(env('SCAN_TOOL_LOG_MAX_CHARS', '4000'))
SCAN_RATE_LIMIT_PER_HOUR = int(env('SCAN_RATE_LIMIT_PER_HOUR', '20'))
SCAN_CREATE_IP_RATE_LIMIT_PER_MINUTE = int(env('SCAN_CREATE_IP_RATE_LIMIT_PER_MINUTE', '60'))
SCAN_ZIP_MAX_BYTES = int(env('SCAN_ZIP_MAX_BYTES', str(500 * 1024 * 1024)))
SCAN_ZIP_MAX_FILES = int(env('SCAN_ZIP_MAX_FILES', '20000'))
LOCAL_REPO_HOST_HOME = env('LOCAL_REPO_HOST_HOME', '')
LOCAL_REPO_MOUNT_PATH = env('LOCAL_REPO_MOUNT_PATH', '/host/home')
AI_FEATURE_ENABLED = env('AI_FEATURE_ENABLED', '1') == '1'

CORS_ALLOWED_ORIGINS = env_list(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000',
)
CORS_ALLOW_CREDENTIALS = env('CORS_ALLOW_CREDENTIALS', '1') == '1'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        }
    },
    'root': {
        'handlers': ['console'],
        'level': env('DJANGO_LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'apps.scans': {
            'handlers': ['console'],
            'level': env('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}
