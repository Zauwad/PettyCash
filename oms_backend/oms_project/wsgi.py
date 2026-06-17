"""
WSGI config for oms_project project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oms_project.settings.development')

# Auto-migration and database seeding on Vercel cold starts
if os.environ.get('VERCEL') == '1':
    import django
    django.setup()
    
    from django.conf import settings
    from django.core.management import call_command

    db_conn = settings.DATABASES.get('default', {})
    engine = db_conn.get('ENGINE', '')

    needs_init = False

    if engine == 'django.db.backends.sqlite3':
        db_path = db_conn.get('NAME', '')
        if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
            needs_init = True
            print("Vercel Cold Start: SQLite not found, initializing...")

    elif 'mysql' in engine:
        # For MySQL (Aiven): check if auth_user table exists
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SHOW TABLES LIKE 'auth_user'")
                result = cursor.fetchone()
                if not result:
                    needs_init = True
                    print("Vercel Cold Start: MySQL tables not found, running migrations...")
        except Exception as e:
            print(f"Vercel Cold Start: Could not check MySQL tables: {e}")
            needs_init = True  # Attempt migrations if we can't check

    if needs_init:
        try:
            call_command('migrate', interactive=False)
            call_command('seed_data', interactive=False)
            print("Vercel Cold Start: Database initialized and seeded successfully!")
        except Exception as e:
            print(f"Vercel Cold Start Error: {e}")

application = get_wsgi_application()

