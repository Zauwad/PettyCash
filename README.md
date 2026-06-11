# 🏗️ Operations Management System (OMS)

A robust, multi-tenant Operations Management System (OMS) designed specifically for three sister organizations under the same umbrella: **A Maze Venture**, **mYnt Connect**, and **Braincount**. 

The system leverages a premium tech stack consisting of **Django REST Framework (DRF)** on the backend, and **React + Vite + Tailwind CSS v4 + DaisyUI v5 + GSAP** on the frontend. It features row-level multi-tenancy, custom branding/theming per organization, advanced approval workflows (Petty Cash & Leave Requests), Out-of-Office delegation, and real-time notifications via WebSockets.

---

## 🚀 Key Features

*   **Row-Level Multi-Tenancy**: Data isolation across organizations (A Maze Venture, mYnt Connect, Braincount) powered by custom Django middleware, mixins, and security layers.
*   **Dynamic Styling & Custom Themes**: Automatically applies the branding and theme of the logged-in user's organization (e.g. Amaze Theme, mYnt Theme, Braincount Theme).
*   **Petty Cash Requisition Module**:
    *   State machine: `draft` ➔ `pending_tl` ➔ `pending_ceo` (for requests > TL limit) ➔ `approved` ➔ `disbursed`.
    *   Dynamic department monthly budget verification on submission.
    *   Granular itemization and support for SQL BLOB receipt storage.
    *   Supports partial or full disbursements with real-time budget updates.
*   **Leave Management Module**:
    *   Calculates exact working days requested, automatically excluding Friday/Saturday weekends and Bangladesh national holidays.
    *   Negative balance policy checks, overlapping request detection, and automatic balance reservation/restoration on cancel.
*   **OOO Approval Delegation**: Active delegation of Petty Cash and/or Leave approval authority to another user for a specific date range.
*   **Real-time Notifications**: WebSockets via Django Channels for in-app popups and status updates.
*   **Analytics Dashboard**: Interactive charts (spending trends, department budget burn rates, upcoming absences) built with Recharts.

---

## 🛠️ Technology Stack

### Backend
*   **Web Framework**: Django 5.x & Django REST Framework (DRF) 3.15+
*   **Workflow / State Management**: `django-fsm-2`
*   **ASGI Server (WebSockets)**: `daphne` + `channels` + `channels-redis`
*   **Task Queue**: `celery` + `django-celery-beat`
*   **Message Broker & Cache**: Redis 7.x
*   **Database**: MySQL 8.x (Row-level isolation)

### Frontend
*   **Runtime / Build Tool**: React 19 + Vite 6
*   **Routing**: React Router v7
*   **Styling**: Tailwind CSS v4 & DaisyUI v5 (with 3 custom organization themes)
*   **State Management**: Zustand 5 & TanStack Query (React Query) v5
*   **Animations**: GreenSock Animation Platform (GSAP) & Framer Motion
*   **Charts**: Recharts

---

## 📂 Project Directory Structure

```text
├── docker-compose.yml       # MySQL & Redis local development container configuration
├── oms_backend/             # Django backend workspace
│   ├── manage.py            # Django CLI entrypoint
│   ├── oms_project/         # Settings, WSGI/ASGI settings, Celery setup
│   ├── core/                # Core mixins, multitenancy middleware, tasks, tests
│   ├── accounts/            # User profiles, departments, roles, auth
│   ├── pettycash/           # Petty Cash models, views, serializers, FSM
│   ├── leave/               # Leave request models, calculators, calendars
│   ├── approvals/           # Approval delegations (OOO)
│   ├── analytics/           # Custom endpoints for metric aggregation
│   ├── notifications/       # Notification model, views, websockets
│   ├── requirements.txt     # Backend python dependencies
│   └── venv/                # Local virtual environment
└── oms_frontend/            # React + Vite frontend workspace
    ├── package.json         # Frontend Node dependencies
    ├── vite.config.js       # Vite build configurations
    ├── tailwind.config.js   # Tailwind configurations
    └── src/                 # React source code (components, pages, stores)
```

---

## ⚙️ Backend Setup & Run

### 1. Run local services (MySQL & Redis)
Ensure Docker is installed and running, then start the containers:
```bash
docker-compose up -d
```
This boots MySQL on port `3306` and Redis on port `6379`.

### 2. Configure Virtual Environment & Install Dependencies
Navigate to the backend directory, activate the virtual environment, and install dependencies:
```bash
cd oms_backend
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Initialize Database
Apply standard migrations to set up the MySQL schema and run the seed script to populate organizations, departments, seed users, and demo requests:
```bash
python manage.py migrate
python manage.py seed_data
```

### 4. Running Backend Servers
You can run the servers concurrently or in separate terminals:

*   **HTTP & WebSocket Server (ASGI / Daphne)**:
    ```bash
    daphne -b 0.0.0.0 -p 8000 oms_project.asgi:application
    ```
*   **Celery Async Worker**:
    ```bash
    celery -A oms_project worker --loglevel=info
    ```
*   **Celery Beat Scheduler**:
    ```bash
    celery -A oms_project beat --loglevel=info
    ```

### 5. Running Tests
Run the end-to-end integration and workflow verification tests:
```bash
python manage.py test
```

---

## 🎨 Frontend Setup & Run

### 1. Install Dependencies
Navigate to the frontend directory and install dependencies:
```bash
cd oms_frontend
npm install
```

### 2. Configure Environment
Verify or update the API URLs in the `.env` file:
```text
VITE_API_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000
```

### 3. Start Development Server
Run the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👥 Seed User Credentials

All seeded users have the password set to `password123`.

### 1. A Maze Venture (`amaze` tenant)
*   **CEO**: `amaze_ceo` (Approves Petty Cash above TL limit, Leave requests)
*   **Admin**: `amaze_admin` (Full tenant control, disbursement capabilities)
*   **Engineering Lead**: `amaze_eng_lead` (Approves requests within Engineering)
*   **Engineering Staff**: `amaze_eng_emp1`, `amaze_eng_emp2` (Requesters)

### 2. mYnt Connect (`mynt` tenant)
*   **CEO**: `mynt_ceo`
*   **Admin**: `mynt_admin`
*   **Marketing Lead**: `mynt_mkt_lead`
*   **Marketing Staff**: `mynt_mkt_emp1`, `mynt_mkt_emp2`

### 3. Braincount (`braincount` tenant)
*   **CEO**: `braincount_ceo`
*   **Admin**: `braincount_admin`
*   **Finance Lead**: `braincount_fin_lead`
*   **Finance Staff**: `braincount_fin_emp1`, `braincount_fin_emp2`

---

## 🧪 Verification & Manual Testing Flow

1.  **Test Tenant Isolation**:
    *   Log in as `amaze_eng_emp1` and create a Petty Cash request.
    *   Log in as `mynt_mkt_emp1`. Verify that you cannot view or access the Amaze request, and that the UI transitions to the **mYnt** color theme.
2.  **Test Petty Cash Approval**:
    *   Submit a Petty Cash request of `৳15,000` (exceeds the Engineering TL limit of `৳25,000`? No, Engineering TL limit is `৳25,000`, so try `৳30,000`).
    *   Log in as `amaze_eng_lead` and approve it. It escalates to `pending_ceo_approval`.
    *   Log in as `amaze_ceo` and approve it. The state transitions to `approved`.
    *   Log in as `amaze_admin` to execute the payment disbursement.
3.  **Test OOO Delegation**:
    *   Log in as `amaze_ceo` and delegate authority to `amaze_eng_emp1` for `PETTY_CASH`.
    *   Create a request by `amaze_eng_emp2` and submit it. Escalate to CEO level.
    *   Log in as `amaze_eng_emp1`. You will see the request in your approval queue and can successfully approve it on behalf of the CEO.
