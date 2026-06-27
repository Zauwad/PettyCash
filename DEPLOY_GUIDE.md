# Azure VM Deployment Guide

This guide describes how to deploy the Operations Management System (Django REST Framework backend + React Vite frontend) to your Azure VM using Docker Compose.

---

## Prerequisites
1. **VM Ports**: In your Azure Portal, open your VM's Network Security Group (NSG) and add an inbound security rule allowing **port 80** (HTTP) traffic.
2. **Key File**: Make sure you know the path to your `PettyCash_key.pem` file.

---

## Step 1: Secure the Key File & Verify SSH Connection

Open a terminal (e.g., PowerShell or WSL Ubuntu) on your local machine.

### Set Strict Permissions on the PEM Key
SSH requires private keys to have restricted access.

* **On WSL / Linux / macOS:**
  ```bash
  chmod 400 PettyCash_key.pem
  ```

* **On Windows PowerShell:**
  ```powershell
  # Disable inheritance and remove all access except for current user
  icacls.exe PettyCash_key.pem /inheritance:r
  icacls.exe PettyCash_key.pem /grant:r "$($env:USERNAME):(R)"
  ```

### Verify Connection
Test connection to your VM (replace `<username>` with your VM username, e.g., `azureuser` or `ubuntu`, and `<public_ip>` with your VM's IP):
```bash
ssh -i PettyCash_key.pem <username>@<public_ip>
```
If you connect successfully, type `exit` to return to your local machine.

---

## Step 2: Install Docker & Docker Compose on the VM

Once connected to the VM, install Docker and Docker Compose (this example is for an Ubuntu VM):

```bash
# Update package database
sudo apt-get update

# Install Docker and Compose plugin
sudo apt-get install -y docker.io docker-compose-v2

# Add your user to the docker group so you don't need 'sudo' for docker commands
sudo usermod -aG docker $USER

# Apply group changes immediately
newgrp docker
```
Verify installations:
```bash
docker --version
docker compose version
```

---

## Step 3: Bundle and Upload the Project

On your local machine, run the following command to package the project (excluding development folders and local database files) and upload it to your VM.

### 1. Create a Tarball Archive (in WSL or Git Bash):
```bash
tar --exclude='oms_frontend/node_modules' \
    --exclude='oms_backend/venv' \
    --exclude='oms_backend/venv_win' \
    --exclude='oms_backend/db.sqlite3' \
    --exclude='.git' \
    --exclude='.agents' \
    -czf project.tar.gz .
```

### 2. Copy the Archive to the VM:
```bash
scp -i PettyCash_key.pem project.tar.gz <username>@<public_ip>:~/
```

---

## Step 4: Extract and Configure Environment Variables

Connect to the VM again:
```bash
ssh -i PettyCash_key.pem <username>@<public_ip>
```

### 1. Extract the Files:
```bash
mkdir -p pettycash-app && tar -xzf project.tar.gz -C pettycash-app
cd pettycash-app
```

### 2. Configure Production `.env`
Edit the backend configuration file `oms_backend/.env` on the VM (you can use `nano oms_backend/.env`):

Set the following variables:
```env
# Security & Debug
DEBUG=False
SECRET_KEY=generate-a-strong-random-key-here
ALLOWED_HOSTS=<your_vm_public_ip>,localhost,127.0.0.1
SECURE_SSL_REDIRECT=False   # Keep False if not using HTTPS/domain yet

# Database Configuration (MySQL matches docker-compose.prod.yml)
DB_HOST=db
DB_PORT=3306
DB_NAME=oms_db
DB_USER=oms_user
DB_PASSWORD=oms_password  # Set a secure password

# Redis and Broker Configuration
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/1

# Email Configuration (Configure if you wish to send emails)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=demo@gmail.com
EMAIL_HOST_PASSWORD=password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=OMS Operations <demo@gmail.com>

# Third-Party APIs
SERPAPI_KEY=your-serpapi-key
```

---

## Step 5: Start the Containers

In the `pettycash-app` folder on the VM, build and start all containers in background daemon mode:
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

---

## Step 6: Initialize the Database (Run Migrations & Seed Data)

After the containers start successfully (you can check logs with `docker compose -f docker-compose.prod.yml logs`), run migrations and seed data:

### 1. Run migrations:
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

### 2. Seed default users, roles, and organizations:
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_data
```

---

## Step 7: Verify the Deployment

1. Open your browser and navigate to `http://<your_vm_public_ip>`.
2. Confirm the frontend loads correctly.
3. Log in with a default seeded user (e.g. `amaze_ceo` / `password123`).
4. Test navigation, create requests, and upload attachments to verify everything connects and writes to MySQL successfully.
