# Operations Management System (OMS) — Multi-Tenant Enterprise ERP & Petty Cash Engine

[![Repository](https://img.shields.io/badge/GitHub-Zauwad%2FPettyCash-181717.svg?logo=github)](https://github.com/Zauwad/PettyCash)
[![Backend](https://img.shields.io/badge/Backend-Django%204.2%20%7C%20DRF-092e20.svg)](https://www.djangoproject.com)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20React%20Router%20v7-61DAFB.svg)](https://react.dev)
[![Styling](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4%20%7C%20DaisyUI%20v5-38B2AC.svg)](https://tailwindcss.com)
[![Animation](https://img.shields.io/badge/Animation-GSAP%203.15%20%7C%20Framer%20Motion-88CE02.svg)](https://gsap.com)
[![State Machine](https://img.shields.io/badge/Workflow-django--fsm%20FSM-blueviolet.svg)](#finite-state-machine-petty-cash-workflow)
[![Multi-Tenancy](https://img.shields.io/badge/Tenancy-Row--Level%20Multi--Tenant-blue.svg)](#multi-tenant-architecture)

> **Operations Management System (OMS)** is a production-grade, multi-tenant enterprise ERP platform designed and deployed for three sister organizations under the same corporate umbrella: **A Maze Venture**, **mYnt Connect**, and **Braincount**. Built with **Django REST Framework** and **React 19 + Tailwind CSS v4 + GSAP**, OMS automates complex financial requisitions, multi-level approval hierarchies, statutory leave management, and cross-organization delegation.

---

## 🏛️ Executive Summary & Business Impact

Traditional internal financial and HR workflows rely on fragmented spreadsheets and manual email approvals, causing budget overruns, delayed reimbursements, and untracked expenditures. OMS modernizes internal operations into a consolidated, secure digital platform:

* **Row-Level Multi-Tenancy**: Complete logical isolation of users, departments, budgets, and approval chains across **A Maze Venture**, **mYnt Connect**, and **Braincount** from a single unified codebase.
* **Dynamic Brand Theming**: Automatically applies the branding, typography, color palettes, and logos of the logged-in user's active organization in real time.
* **Finite State Machine Requisition Engine**: Deterministic financial lifecycle governed by `django-fsm`, eliminating invalid approval states or skipped managerial thresholds.
* **Automated Bangladesh Calendar Engine**: Leave calculations automatically account for Bangladesh national statutory holidays and Friday/Saturday weekend policies.
* **Out of Office (OOO) Delegation Engine**: Temporary managerial approval authority delegation with automated expiration and full audit logging.
* **Recruiter & Executive Demo Mode**: Built-in one-click demo persona switcher allowing recruiters and evaluators to test Employee, Team Lead, CEO, and Finance roles seamlessly.

---

## 🧭 System Architecture & Workflow State Machine

### Finite State Machine (Petty Cash Lifecycle)

```text
       ┌───────────────┐
       │     DRAFT     │
       └───────┬───────┘
               │ Submit Requisition (Validate Dept Budget)
               ▼
       ┌────────────────────────┐
       │  PENDING_TL_APPROVAL   │
       └───────┬────────┬───────┘
  Amount <= TL │        │ Amount > TL Limit
  Limit        ▼        ▼
       ┌──────────┐  ┌────────────────────────┐
       │          │  │  PENDING_CEO_APPROVAL  │
       │          │  └──────────┬─────────────┘
       │          │             │ CEO Approves
       │          ▼             ▼
       │     ┌────────────────────────┐
       └────►│ PENDING_HR_DISBURSEMENT│
             └──────────┬─────────────┘
                        │
       ┌────────────────┴────────────────┐
       │ Partial Payout                  │ Full Payout
       ▼                                 ▼
┌────────────────────────┐     ┌────────────────────────┐
│  PARTIALLY_DISBURSED   │     │       DISBURSED        │
└────────────────────────┘     └────────────────────────┘
```

---

## 🏢 Multi-Tenant Architecture

```text
                           [ Authenticated User / Client ]
                                          │
                                          ▼  JWT Token (org_id payload)
                     ┌────────────────────────────────────────┐
                     │     Django Tenant Scope Middleware     │
                     └────────────────────┬───────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
  [ A Maze Venture ]              [ mYnt Connect ]               [ Braincount ]
  • Custom Theme Palette          • Custom Theme Palette        • Custom Theme Palette
  • Isolated Dept Budgets         • Isolated Dept Budgets       • Isolated Dept Budgets
  • Dedicated TL / CEO Roster     • Dedicated TL / CEO Roster   • Dedicated TL / CEO Roster
  • Scoped Requisitions           • Scoped Requisitions         • Scoped Requisitions
```

* **Tenant Isolation**: Custom Django querysets and model mixins automatically filter records by `organization_id`.
* **Dynamic Client-Side Theming**: React dynamically swaps CSS variables and DaisyUI themes on authentication, delivering branded UI tailored to each sister company.

---

## 🌟 Key Feature Modules

### 1. Petty Cash Requisition Module
* **Dynamic Budget Enforcement**: Real-time validation verifying that line item totals do not exceed remaining department monthly allocations.
* **Dual Approval Thresholds**:
  * Amounts within Team Lead threshold proceed directly to HR/Finance.
  * Requisitions exceeding the TL limit automatically escalate to the CEO.
* **Receipt & BLOB Support**: Granular itemized expenses with secure file upload and SQL BLOB attachment storage.
* **Disbursement Tracking**: Supports full or multi-installment partial payouts with payment mode logging (Cash, bKash, Bank Wire).

### 2. Statutory Leave Management Module
* **Working Day Calculator**: Automatically deducts Friday/Saturday weekends and Bangladesh national holidays via the `holidays` engine.
* **Balance Safeguards**: Prevents negative balances, rejects overlapping date ranges, and automatically restores balance reservations upon cancellation.
* **Half-Day Support**: Configurable First-Half / Second-Half working day requests.

### 3. Out-of-Office (OOO) Delegation Engine
* Authorizes temporary surrogate approval power to designated peers for specified date windows.
* Automatically routes requisitions to the delegate while logging the principal in the audit trail.

### 4. Recruiter Demo Quick-Selectors
* Instant persona switching in the login portal:
  * **Employee**: Submit requisitions and leave requests.
  * **Team Lead**: Approve direct reports' requisitions within threshold.
  * **CEO**: High-value requisition approvals and company-wide oversight.
  * **HR / Finance**: Execute disbursements and budget management.

---

## 💻 Tech Stack Breakdown

### Backend
* **Framework**: Django 4.2 LTS, Django REST Framework (DRF)
* **Authentication**: SimpleJWT (`djangorestframework-simplejwt`)
* **State Machine & Auditing**: `django-fsm`, `django-fsm-log`, `django-auditlog`, `django-simple-history`
* **Calendar Engine**: `holidays` (Bangladesh national calendar)
* **API Documentation**: `drf-spectacular` (OpenAPI 3.0 & Swagger UI)

### Frontend
* **Core**: React 19 (`19.2.6`), Vite, TypeScript, React Router DOM v7 (`7.17.0`)
* **Styling**: Tailwind CSS v4 (`4.3.0`), DaisyUI v5 (`5.5.23`)
* **Animation & Motion**: GSAP 3.15, `@gsap/react`, Framer Motion (`12.40.0`)
* **State & Data**: TanStack Query v5, Zustand v5, React Hook Form + Zod v4
* **Visualization & Export**: Recharts v3.8, XLSX (Excel reporting)

---

## 🛠️ Local Development Setup

### 1. Backend Setup
```bash
cd oms_backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations and seed data
python manage.py migrate
python manage.py loaddata ../local_data.json  # If available

# Boot backend API
python manage.py runserver 8000
```
Swagger API documentation available at `http://localhost:8000/api/schema/swagger-ui/`.

### 2. Frontend Setup
```bash
cd oms_frontend

# Install dependencies
npm install

# Boot development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🐳 Docker Deployment

The repository includes ready-to-run multi-container Docker compose definitions:

```bash
# Production containerized deployment
docker compose -f docker-compose.prod.yml up --build -d
```

---

## 👨‍💻 Engineering Leadership & Portfolio Highlight

* **Architecture**: Enterprise Multi-Tenant Operations & Financial ERP System
* **Author / Senior Engineer**: **Ridwanul Azim** ([@Zauwad](https://github.com/Zauwad))
* **Organization**: A Maze Venture / mYnt Connect / Braincount
