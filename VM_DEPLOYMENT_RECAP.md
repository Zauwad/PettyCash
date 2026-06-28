# Azure VM Deployment Recap

This document outlines the deployment architecture, step-by-step setup procedure, and the specific troubleshooting issues (with solutions) encountered during the deployment of the Operations Management System on the Azure VM.

---

## 1. Deployment Architecture

Instead of configuring a heavy MySQL database and Redis server, the application was deployed using a lightweight, containerized SQLite architecture:

```
  [ User Browser ]
         │ (Port 80)
         ▼
  [ Nginx Container (Frontend) ] ─── (Serves Static/Media Volumes) ───┐
         │                                                            │
         │ (Proxies /api/* & /admin/*)                                │
         ▼                                                            ▼
  [ Gunicorn Container (Django Backend) ]                     [ Shared Volumes ]
         │                                                    - django_static
         ▼ (Writes DB updates)                                - django_media
  [ SQLite Volume (sqlite_data) ] ──> /app/db/db.sqlite3
```

- **Frontend**: Built from React/Vite using Node, then compiled and served via Nginx on port 80.
- **Backend**: Runs Django on Python 3.12 (slim) using Gunicorn, listening internally on port 8000.
- **Database**: SQLite database file (`db.sqlite3`) mounted on a persistent Docker volume (`sqlite_data`).
- **Static & Media Files**: Shared between the backend container and frontend (Nginx) container using named Docker volumes (`django_static` and `django_media`).

---

## 2. Step-by-Step Setup

1. **SSH Verification**: Generated private key security rules and connected to the VM.
2. **Deploy Key Configuration**: Generated an Ed25519 SSH key on the VM and added it as a Deploy Key on GitHub to authenticate cloning the private repository.
3. **Repository Cloning**: Cloned the code directly on the VM:
   ```bash
   git clone -b V2 git@github.com:Zauwad/PettyCash.git
   ```
4. **Environment Configuration**: Set up production `.env` variables for Django settings and allowed hosts.
5. **Orchestration Launch**: Ran the Docker Compose stack in detached mode:
   ```bash
   sudo docker compose -f docker-compose.prod.yml up --build -d
   ```
6. **Data Seeding**: Migrated the schema and seeded the database with default organizations, roles, and administrative users:
   ```bash
   sudo docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
   sudo docker compose -f docker-compose.prod.yml exec backend python manage.py seed_data
   ```

---

## 3. Problems Encountered & Resolutions

### Problem 1: SSH Private Key Permissions "Too Open" (0555)
- **Symptom**: `Permissions 0555 for 'PettyCash_key.pem' are too open. This private key will be ignored.`
- **Cause**: The key was stored on the local Windows NTFS filesystem partition (`/mnt/f/`), which doesn't support Linux permissions (`chmod`) by default in WSL.
- **Resolution**: Copied the key to the native WSL Linux home directory (`~/`) where POSIX metadata is supported:
  ```bash
  cp PettyCash_key.pem ~/PettyCash_key.pem
  chmod 400 ~/PettyCash_key.pem
  ```

### Problem 2: Docker Socket Permission Denied
- **Symptom**: `permission denied while trying to connect to the Docker daemon socket`
- **Cause**: The user `azureuser` did not have active root socket permission groups applied to the current shell environment.
- **Resolution**: Prefixed the docker commands with `sudo` (e.g. `sudo docker compose`).

### Problem 3: Frontend Build Failure (`npm ci` Out of Sync)
- **Symptom**: `npm error 'npm ci' can only install packages when your package.json and package-lock.json are in sync.`
- **Cause**: The workspace's lock-file and package configurations were slightly out of sync.
- **Resolution**: Modified the VM's `oms_frontend/Dockerfile` to use `npm install` instead of `npm ci`, allowing the installer to dynamically resolve lock conflicts during build time:
  ```dockerfile
  # Change from:
  RUN npm ci
  # Change to:
  RUN npm install
  ```

### Problem 4: Django Backend Crash Loop (`KeyError: 'CELERY_BROKER_URL'`)
- **Symptom**: `django.core.exceptions.ImproperlyConfigured: Set the CELERY_BROKER_URL environment variable`
- **Cause**: Django settings (`base.py`) use `django-environ` to strictly read broker variables from `.env` even though Celery is not active.
- **Resolution**: Restored local fallback values for these variables in `oms_backend/.env` to satisfy the config reader:
  ```env
  CELERY_BROKER_URL=redis://localhost:6379/1
  CELERY_RESULT_BACKEND=redis://localhost:6379/1
  ```

### Problem 5: Login Request Falling Back to Localhost (`127.0.0.1:8000`)
- **Symptom**: Login page loads, but submitting credentials results in network connection failure.
- **Cause**: `import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'` resolves to the fallback because an empty string `""` is falsy in Javascript.
- **Resolution**: Updated `oms_frontend/Dockerfile` on the VM to bind `VITE_API_URL` to the VM's public IP during compilation:
  ```dockerfile
  ENV VITE_API_URL="http://20.219.32.255"
  ```
