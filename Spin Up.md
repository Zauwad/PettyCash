# Project Setup and Spin-up Plan

This plan outlines the steps required to install all dependencies and spin up both the Django REST Framework backend and React + Vite frontend on this Windows machine.

## User Review Required

> [!NOTE]
> **Database & Cache Infrastructure (MySQL & Redis)**
> Since Docker is not installed and the current shell does not have administrator privileges (which prevents installing Docker Desktop or Windows services natively), we will use the existing **WSL Ubuntu** environment. WSL Version 1 runs directly on the host's networking stack, meaning MySQL (`3306`) and Redis (`6379`) running inside WSL will be fully accessible from the Windows host via `127.0.0.1`.

> [!IMPORTANT]
> **Celery on Windows**
> Celery 5.x does not officially support Windows. To run the Celery worker, we must use the `--pool=solo` flag.

---

## Proposed Changes

No source code files will be modified. All changes are setup and configuration actions.

### 1. Install & Configure MySQL and Redis (in WSL)
We will run WSL commands as `root` to:
- Install `mysql-server` and `redis-server` inside WSL Ubuntu.
- Start both services.
- Configure MySQL to create the database `oms_db`, create the user `oms_user` with password `oms_password`, and grant permissions.

### 2. Configure Python Virtual Environment (on Windows)
Since `venv` in the codebase appears to be a Linux-compatible venv, we will:
- Create a new Windows-compatible virtual environment in `oms_backend/venv_win`.
- Install dependencies using `requirements.txt`.

### 3. Initialize Django Database
- Run Django migrations to setup the schema.
- Run the seed script `python manage.py seed_data` to populate initial users, departments, and organizations.

### 4. Install Frontend Dependencies (on Windows)
- Navigate to `oms_frontend`.
- Run `npm install` to install all React, Tailwind CSS v4, and other dependencies.

---

## Verification Plan

### Automated Tests
- Run the backend test suite:
  ```bash
  python manage.py test
  ```

### Manual Verification
- Start the Daphne server:
  ```bash
  daphne -b 127.0.0.1 -p 8000 oms_project.asgi:application
  ```
- Start the Celery worker:
  ```bash
  celery -A oms_project worker --loglevel=info --pool=solo
  ```
- Start the Frontend dev server:
  ```bash
  npm run dev
  ```
- Open http://localhost:5173/ in the browser and verify we can log in with `amaze_ceo` / `password123`.







I will check if the MySQL and Redis database services are currently running and listening on your PC.

Yes, you need to run MySQL and Redis locally first. Both the Django backend (Daphne) and the Celery worker/beat rely on MySQL (database) and Redis (message broker and channel layer) to function. If they are not running, the backend services will fail to start.

Here is how you can start them and run the rest of the application:

Step 1: Start MySQL and Redis (via WSL)
Open a PowerShell or Command Prompt window and run:

Start MySQL:
powershell

wsl -u root service mysql start


Start Redis:
powershell

wsl -u root service redis-server start
Note: WSL 1 shares the network stack with Windows, so once these services start inside WSL, they are automatically available at 127.0.0.1:3306 and 127.0.0.1:6379 on your Windows host.


Step 2: Start the Backend & Celery Services
Once MySQL and Redis are running, open separate terminal windows for each of the following:

Backend Server (Daphne):

powershell

cd "f:\Work Stuff\A Maze\PettyCash\PettyCash\oms_backend"
.\venv_win\Scripts\daphne -b 127.0.0.1 -p 8000 oms_project.asgi:application



Celery Worker:

powershell

cd "f:\Work Stuff\A Maze\PettyCash\PettyCash\oms_backend"
.\venv_win\Scripts\celery -A oms_project worker --loglevel=info --pool=solo



Celery Beat:

powershell

cd "f:\Work Stuff\A Maze\PettyCash\PettyCash\oms_backend"
.\venv_win\Scripts\celery -A oms_project beat --loglevel=info




Step 3: Start the Frontend
In another terminal, run the React Vite development server:

Frontend:
powershell

cd "f:\Work Stuff\A Maze\PettyCash\PettyCash\oms_frontend"
npm run dev

You can then access the application at http://localhost:5173.




















Step 1: Start Databases (MySQL & Redis)
Use Docker Compose:

bash


docker compose up -d
Note: Configures database oms_db, user oms_user, and password oms_password automatically.

Step 2: Spin Up Backend API
Navigate to backend directory and create virtual environment:
bash


cd oms_backend
python3 -m venv venv
source venv/bin/activate
Install Python dependencies:
bash


pip install -r requirements.txt
Prepare .env file (copy from existing configuration or verify details match docker-compose.yml specs).
Run migrations and seed data:
bash


python manage.py migrate
python manage.py seed_data
Run server via Daphne:
bash


daphne -b 0.0.0.0 -p 8000 oms_project.asgi:application
Step 3: Run Celery Worker & Scheduler
Keep backend virtual environment active. Open two new terminal tabs and run:

Celery Worker:
bash


cd oms_backend
source venv/bin/activate
celery -A oms_project worker --loglevel=info
Celery Beat:
bash


cd oms_backend
source venv/bin/activate
celery -A oms_project beat --loglevel=info
Step 4: Run Frontend Client
Navigate to frontend directory and install Node packages:
bash


cd oms_frontend
npm install
Start development server:
bash


npm run dev
Open http://localhost:5173/ in your web browser.













Use the repo’s actual local setup: Django dev settings, MySQL on 127.0.0.1:3306, Redis on 127.0.0.1:6379, frontend on Vite 5173.


git clone <repo>
cd PettyCash

# 1) Start DB + Redis
docker compose up -d


# 2) Backend
cd oms_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000


# 3) Frontend
cd ../oms_frontend
npm install
npm run dev

What the repo actually expects

manage.py and wsgi.py default to oms_project.settings.development
backend env is MySQL + Redis, not SQLite
oms_backend/.env is wired for DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT plus CELERY_BROKER_URL and CELERY_RESULT_BACKEND
frontend .env uses:
VITE_API_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000
Note: the current requirements.txt does not include the full ASGI/Celery stack from the marketing docs, so the practical local start is the Django dev server above.
