import pymysql

# Patch MySQLdb to use PyMySQL for database operations, avoiding native compilation issues
pymysql.install_as_MySQLdb()

# Load Celery app on startup
from .celery import app as celery_app
__all__ = ('celery_app',)
