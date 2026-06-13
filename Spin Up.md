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
