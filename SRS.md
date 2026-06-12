# OMS — Operations Management System
## Technical Reference & Software Requirements Specification (SRS)

**Version:** 1.0 | **Environment:** Vercel (Frontend + Backend) + Cloud SQL (MySQL)  
**Organizations:** A Maze Venture · mYnt Connect · Braincount  
**Last Updated:** June 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Technology Stack](#3-technology-stack)
4. [Architecture & Multi-Tenancy](#4-architecture--multi-tenancy)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Database Models (ERD Summary)](#6-database-models-erd-summary)
7. [Backend: Django Apps](#7-backend-django-apps)
   - 7.1 [core](#71-core-app)
   - 7.2 [accounts](#72-accounts-app)
   - 7.3 [pettycash](#73-pettycash-app)
   - 7.4 [leave](#74-leave-app)
   - 7.5 [approvals](#75-approvals-app)
   - 7.6 [analytics](#76-analytics-app)
   - 7.7 [notifications](#77-notifications-app)
8. [FSM State Machines](#8-fsm-state-machines)
9. [Frontend: React App](#9-frontend-react-app)
10. [API Endpoint Reference](#10-api-endpoint-reference)
11. [Deployment Topology](#11-deployment-topology)
12. [Environment Variables](#12-environment-variables)
13. [Role-Based Access Control (RBAC)](#13-role-based-access-control-rbac)
14. [Debugging Guide](#14-debugging-guide)
15. [Common Issues & Solutions](#15-common-issues--solutions)
16. [Local Development Setup](#16-local-development-setup)

---

## 1. System Overview

OMS is a **multi-tenant Operations Management System** designed for a group of companies under A Maze Venture. It centralizes employee management, petty cash requisitions, leave requests, and approval workflows in a single application, with complete **data isolation** between tenants.

### Core Capabilities

| Module | Purpose |
|---|---|
| **Authentication** | JWT-based login, token refresh, logout with blacklisting |
| **Team Directory** | Create/manage employees, assign roles and departments |
| **Petty Cash Requisition** | Full FSM-based expense request lifecycle with budget tracking |
| **Leave Management** | Working-day-aware leave requests with FSM approval flows |
| **Approval Center** | Unified dashboard for TL/CEO approvers |
| **Delegation** | Out-of-office (OOO) authority delegation |
| **Analytics** | Spending trends, budget burn rate, absence forecasting |
| **Notifications** | In-app notification system |

### Tenants

```
Organization slug → Company name
─────────────────────────────────
amaze             → A Maze Venture
mynt              → mYnt Connect
braincount        → Braincount
```

---

## 2. Repository Structure

```
PettyCash/
├── oms_backend/                   ← Django REST API
│   ├── accounts/                  ← User, UserProfile, auth
│   ├── analytics/                 ← Reporting endpoints
│   ├── approvals/                 ← Approval delegation
│   ├── core/                      ← Base models, middleware, permissions
│   ├── leave/                     ← Leave request module
│   ├── notifications/             ← In-app notifications
│   ├── pettycash/                 ← Petty cash requisition module
│   ├── oms_project/
│   │   ├── settings/
│   │   │   ├── base.py            ← Shared settings
│   │   │   ├── development.py     ← Local dev overrides
│   │   │   └── production.py      ← Vercel production overrides
│   │   ├── urls.py                ← Root URL router
│   │   ├── wsgi.py                ← WSGI entry point (Vercel)
│   │   ├── asgi.py                ← ASGI (Channels/Daphne)
│   │   └── celery.py              ← Celery task app
│   ├── requirements.txt
│   └── vercel.json                ← Vercel build config
│
└── oms_frontend/                  ← React + Vite frontend
    ├── src/
    │   ├── app/
    │   │   ├── router.jsx          ← React Router definitions
    │   │   └── providers/          ← App-level context providers
    │   ├── features/               ← Feature-based folder structure
    │   │   ├── auth/               ← Login, ProtectedRoute, authStore
    │   │   ├── petty-cash/         ← Petty cash pages & components
    │   │   ├── leave/              ← Leave pages & components
    │   │   ├── approvals/          ← Approval center
    │   │   ├── analytics/          ← Analytics dashboard
    │   │   ├── delegation/         ← Delegation management
    │   │   ├── team/               ← Team directory
    │   │   ├── settings/           ← User settings
    │   │   └── dashboard/          ← Home dashboard
    │   └── shared/
    │       ├── api/                ← API utility functions
    │       ├── components/         ← Reusable UI components
    │       ├── constants/
    │       │   ├── apiEndpoints.js ← All API URL constants
    │       │   ├── roles.js        ← ROLES enum
    │       │   └── states.js       ← FSM state labels & badge classes
    │       ├── hooks/              ← GSAP animation hooks
    │       ├── lib/
    │       │   └── axios.js        ← Axios instance + interceptors
    │       └── stores/
    │           └── themeStore.js   ← DaisyUI theme Zustand store
    └── .env                        ← VITE_API_URL, VITE_WS_URL
```

---

## 3. Technology Stack

### Backend

| Package | Version | Purpose |
|---|---|---|
| Django | 4.2.x | Web framework |
| djangorestframework | 3.14–3.15 | REST API |
| djangorestframework-simplejwt | 5.3.x | JWT auth |
| django-cors-headers | 4.x | CORS policy |
| django-filter | 23–24 | Queryset filtering |
| django-fsm | 2.8 | Finite state machines |
| django-fsm-log | 3.x | FSM audit trail |
| django-auditlog | 2.x | Model change auditing |
| django-simple-history | 3.5 | Historical model records |
| django-environ | 0.11 | `.env` configuration |
| pymysql | 1.1 | MySQL connector |
| whitenoise | 6.5 | Static file serving |
| gunicorn | 21+ | WSGI server |
| celery | 5.3 | Async task queue |
| redis | 5.0 | Celery broker + cache |
| channels | 4.0 | Django Channels (WebSockets) |
| channels-redis | 4.0 | Redis channel layer |
| daphne | 4.0 | ASGI server |
| drf-spectacular | 0.26 | OpenAPI schema/docs |

### Frontend

| Package | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool |
| React Router v6 | Client-side routing |
| Zustand | Global state management |
| Axios | HTTP client with interceptors |
| TailwindCSS | Utility-first styling |
| DaisyUI | Component library (themes) |
| GSAP | Animations |

---

## 4. Architecture & Multi-Tenancy

### How Tenancy Works

OMS uses a **shared-schema multi-tenancy** model. All tenants share the same database tables but all domain objects are scoped by `organization` foreign key.

```
Request → OrganizationMiddleware → Sets request.organization
                                 → Stores in thread local storage
       → DRF View → OrganizationViewSetMixin → Filters queryset by org
                  → IsOrganizationMember permission → Validates object access
```

#### Layer 1 — Middleware (`core/middleware.py`)
`OrganizationMiddleware` runs on every request. It:
1. Attempts to decode the JWT from the `Authorization` header (for API requests)
2. Attaches `request.organization` via a lazy `@property` on `HttpRequest`
3. Stores current user and request in **thread local storage** (`core/thread_local.py`)
4. Clears thread locals on response/exception to prevent leaks

#### Layer 2 — ViewSet Mixin (`core/mixins.py`)
`OrganizationViewSetMixin` overrides `get_queryset()`:
```python
queryset.filter(organization=request.organization)
```
All standard list, retrieve, create, update, delete operations are automatically scoped.

#### Layer 3 — Object Permissions (`core/permissions.py`)
`IsOrganizationMember` validates that the retrieved object's `.organization` matches the requesting user's organization. Global Admins bypass this check.

---

## 5. Authentication & Authorization

### JWT Token Flow

```
Frontend                         Backend
────────                         ───────
POST /api/token/  ──────────►  CustomTokenObtainPairView
  { username, password }         └─ Validates credentials
                                  └─ Returns:
◄─────────────────────────────────  { access, refresh, user{...} }

  access token: stored in Zustand memory (in-app state)
  refresh token: stored in localStorage

Per-request:
  Authorization: Bearer <access_token>  ──► DRF JWTAuthentication
                                            └─ Validates token signature
                                            └─ Attaches request.user

Token refresh (automatic via axios interceptor):
  On 401 response:
    POST /api/token/refresh/  ──►  TokenRefreshView
      { refresh: <token> }          └─ Returns new access token
    Retry original request
    If refresh also fails → clearAuth() + redirect to /login
```

### Login Response Payload

```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>",
  "user": {
    "id": 1,
    "email": "alice@amaze.com",
    "username": "alice",
    "first_name": "Alice",
    "last_name": "Smith",
    "role": "TEAM_LEAD",
    "employee_id": "AMZ-001",
    "organization": {
      "id": 1,
      "name": "A Maze Venture",
      "slug": "amaze",
      "theme_name": "amaze",
      "primary_color": "#...",
      "secondary_color": "#..."
    },
    "department": {
      "id": 3,
      "name": "Engineering",
      "monthly_budget": 50000.00,
      "tl_approval_limit": 10000.00
    }
  }
}
```

### Token Lifetime

| Token | Lifetime |
|---|---|
| Access Token | 2 hours |
| Refresh Token | 7 days (rotated on refresh) |

### Blacklisting

`ROTATE_REFRESH_TOKENS = True` and `BLACKLIST_AFTER_ROTATION = True` are enabled. Old refresh tokens are invalidated on logout or rotation.

---

## 6. Database Models (ERD Summary)

### `core` App

```
Organization
├── id, name, slug, logo_url
├── primary_color, secondary_color, theme_name
├── policy_config (JSONField)
└── is_active, created_at, updated_at

Department
├── id, organization (FK)
├── name, monthly_budget, budget_spent_this_month
├── budget_reset_day, tl_approval_limit
└── is_active, created_at

AuditLog
├── id, organization (FK), actor (FK → User)
├── action (e.g. CREATED, APPROVED, REJECTED)
├── target_type, target_id
├── old_state, new_state, reason
└── metadata (JSONField), created_at

ApprovalDelegation
├── id, organization (FK)
├── delegator (FK → User), delegate (FK → User)
├── scope (PETTY_CASH | LEAVE | ALL)
├── start_date, end_date, is_active
└── reason, created_at

Notification
├── id, recipient (FK → User)
├── notification_type, title, message
├── action_url, is_read
└── created_at
```

### `accounts` App

```
UserProfile (extends Django User via OneToOne)
├── user (OneToOne → auth.User)
├── organization (FK → Organization)
├── department (FK → Department)
├── role (EMPLOYEE | TEAM_LEAD | CEO | ADMIN)
├── employee_id (unique)
├── phone, avatar_url (TextField — supports base64 or URL)
└── created_at, updated_at
```

### `pettycash` App

```
PettyCashRequest
├── uuid (unique, editable=False)
├── organization (FK), department (FK), requester (FK)
├── title, description
├── amount_requested, amount_approved, amount_disbursed
├── state (FSMField)
├── priority (LOW|MEDIUM|HIGH|URGENT)
├── needed_by (date)
└── rejection_reason, created_at, updated_at

PettyCashLineItem
├── request (FK → PettyCashRequest)
├── description, quantity, unit_price, total_price
└── category

Attachment (shared with Leave)
├── request (FK → PettyCashRequest, nullable)
├── leave_request (FK → LeaveRequest, nullable)
├── uploaded_by (FK → User)
├── file_data (BinaryField — stored in DB)
├── original_filename, content_type, file_size_bytes
└── uploaded_at

Disbursement
├── request (FK → PettyCashRequest)
├── disbursed_by (FK → User)
├── amount, payment_method, reference_number
└── notes, disbursed_at
```

### `leave` App

```
LeaveType
├── organization (FK), name, code
├── default_days_per_year
├── allow_negative_balance, requires_attachment
└── is_active

LeaveBalance
├── user (FK → User), leave_type (FK), year
├── total_allocated, used, pending, available
└── updated_at

LeaveRequest
├── uuid, organization (FK), requester (FK)
├── leave_type (FK), start_date, end_date
├── working_days_requested, is_half_day, half_day_period
├── reason, state (FSMField)
├── rejection_reason, delegate_to (FK → User)
└── created_at, updated_at

CompanyHoliday
├── organization (FK), name, holiday_date
└── is_recurring, year
```

---

## 7. Backend: Django Apps

### 7.1 `core` App

**Location:** `oms_backend/core/`

| File | Purpose |
|---|---|
| `models.py` | `Organization`, `Department`, `AuditLog`, `ApprovalDelegation`, `Notification` |
| `middleware.py` | `OrganizationMiddleware` — JWT decode, tenant injection, thread-local storage |
| `permissions.py` | `IsOrganizationMember`, `IsCEOOrAdmin` DRF permission classes |
| `mixins.py` | `OrganizationViewSetMixin` — auto-scopes querysets |
| `utils.py` | `is_authorized_approver()` — checks delegation + role for approval authority |
| `thread_local.py` | `set_current_user()`, `get_current_user()` helpers |

### 7.2 `accounts` App

**Location:** `oms_backend/accounts/`

| File | Purpose |
|---|---|
| `models.py` | `UserRole` choices, `UserProfile` model |
| `serializers.py` | `UserSerializer`, `CustomTokenObtainPairSerializer`, `UserCreateSerializer`, `UserProfileUpdateSerializer` |
| `views.py` | `CustomTokenObtainPairView`, `MeView` (GET/PATCH), `UserViewSet`, `DepartmentViewSet` |
| `urls.py` | Routes: `/api/token/`, `/api/token/refresh/`, `/api/me/`, `/api/users/`, `/api/departments/` |

#### Key Behaviors

- **Create user** (`POST /api/users/`): Only CEO, ADMIN, or HR department members can create accounts.
- **Change role** (`POST /api/users/{id}/change-role/`): CEO, ADMIN, or HR can change roles. Cannot change own role. Only ADMIN can assign the ADMIN role.
- **CEO restrictions**: CEOs cannot create petty cash requests or submit leave requests.
- **Avatar**: Stored as raw base64 string or URL in `UserProfile.avatar_url` (TextField).

### 7.3 `pettycash` App

**Location:** `oms_backend/pettycash/`

| File | Purpose |
|---|---|
| `models.py` | `PettyCashRequest`, `PettyCashLineItem`, `Attachment`, `Disbursement` |
| `serializers.py` | Serializers for all models |
| `views.py` | `PettyCashViewSet` (FSM transitions), `AttachmentDownloadView` |
| `urls.py` | Routes: `/api/petty-cash/`, `/api/attachments/<pk>/` |

#### FSM Actions on PettyCashViewSet

| Action URL | Method | Auth | Description |
|---|---|---|---|
| `/api/petty-cash/{uuid}/submit/` | POST | Requester | Draft → Pending TL |
| `/api/petty-cash/{uuid}/approve/` | POST | TL/CEO/Delegate | Pending → Approved or Escalated |
| `/api/petty-cash/{uuid}/reject/` | POST | TL/CEO/Delegate | Pending → Rejected (requires reason) |
| `/api/petty-cash/{uuid}/amend/` | POST | Requester | Rejected → Draft |
| `/api/petty-cash/{uuid}/cancel/` | POST | Requester | Draft/Pending → Cancelled |
| `/api/petty-cash/{uuid}/disburse/` | POST | ADMIN/CEO | Approved → Disbursed |
| `/api/petty-cash/bulk-action/` | POST | TL/CEO/ADMIN | Express bulk approve/reject |

### 7.4 `leave` App

**Location:** `oms_backend/leave/`

| File | Purpose |
|---|---|
| `models.py` | `LeaveType`, `LeaveBalance`, `LeaveRequest`, `CompanyHoliday` |
| `serializers.py` | Serializers for all models |
| `views.py` | `LeaveRequestViewSet`, `LeaveBalanceViewSet`, `LeaveTypeViewSet`, etc. |
| `urls.py` | Routes under `/api/leave/` |

#### Key Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/leave/requests/` | GET/POST | List or create leave requests |
| `/api/leave/requests/{uuid}/` | GET | Request detail |
| `/api/leave/requests/{uuid}/submit/` | POST | Submit draft |
| `/api/leave/requests/{uuid}/approve/` | POST | TL approval |
| `/api/leave/requests/{uuid}/reject/` | POST | Reject |
| `/api/leave/requests/calculate-days/` | POST | Calculate working days between dates |
| `/api/leave/requests/team-calendar/` | GET | Team leave calendar |
| `/api/leave/balances/` | GET | View own leave balances |
| `/api/leave/types/` | GET | Available leave types |
| `/api/leave/holidays/` | GET | Company holidays |

### 7.5 `approvals` App

**Location:** `oms_backend/approvals/`

Handles `ApprovalDelegation` CRUD. Delegates can be granted temporary approval authority with date-scoped validity.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/delegations/` | GET | List active delegations |
| `/api/delegations/` | POST | Create delegation (TL or CEO) |
| `/api/delegations/{id}/` | GET/PATCH/DELETE | Manage delegation |

### 7.6 `analytics` App

**Location:** `oms_backend/analytics/`

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/analytics/summary/` | GET | KPI summary (requests, approvals, budget) |
| `/api/analytics/spending-trends/` | GET | Monthly spending breakdown |
| `/api/analytics/budget-burn-rate/` | GET | Department budget consumption |
| `/api/analytics/upcoming-absences/` | GET | Approved leaves in next 30 days |

> **Access restricted** to CEO and ADMIN roles only.

### 7.7 `notifications` App

**Location:** `oms_backend/notifications/`

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/notifications/` | GET | List unread notifications |
| `/api/notifications/mark-read/` | POST | Mark notifications as read |

---

## 8. FSM State Machines

### Petty Cash Request States

```
draft
  │
  ▼ [submit] (requester only)
pending_tl_approval
  │                │
  ▼ [tl_approve]  │  [reject]  ──►  rejected
  │   (amount ≤ TL limit)              │
  │                │                   │ [amend] (requester)
  │                │                   ▼
  │  [tl_approve]  │                  draft
  │   (amount > TL limit)
  │                │
  ▼                ▼
approved       pending_ceo_approval
  │                │
  │  [ceo_approve] │ [reject]  ──► rejected
  │  ◄─────────────┘
  │
  ▼ [disburse partial]
partially_disbursed
  │
  ▼ [disburse final]
disbursed

Any pending state can be cancelled back to:
cancelled  ◄── [cancel] by requester (draft or pending_tl_approval)
```

**Budget Routing Rule:** If `amount_approved > department.tl_approval_limit`, TL's `tl_approve()` automatically returns `pending_ceo_approval` (django-fsm `RETURN_VALUE` transition).

### Leave Request States

```
draft
  │
  ▼ [submit]
pending_tl_approval
  │              │
  ▼ [tl_approve] │ [escalate]
  │              ▼
approved     pending_ceo_approval
  │              │
  │  [ceo_approve]
  │◄─────────────┘
  │
cancelled  ◄── [cancel] (draft | pending | approved)
rejected   ◄── [reject] (any pending state, reason required)
  │
draft  ◄── [amend] (requester can re-submit)
```

---

## 9. Frontend: React App

### Route Map

| Route | Page | Access |
|---|---|---|
| `/login` | `LoginForm` | Public |
| `/` | `DashboardPage` | Any authenticated user |
| `/petty-cash` | `PettyCashListPage` | Any authenticated user (CEO: read-only) |
| `/petty-cash/:uuid` | `PettyCashDetailPage` | Any authenticated user |
| `/leave` | `LeaveListPage` | Any authenticated user (CEO: read-only) |
| `/leave/:uuid` | `LeaveDetailPage` | Any authenticated user |
| `/leave/calendar` | `LeaveCalendarPage` | Any authenticated user |
| `/approvals` | `ApprovalCenterPage` | TEAM_LEAD, CEO, ADMIN |
| `/analytics` | `AnalyticsDashboardPage` | CEO, ADMIN |
| `/delegation` | `DelegationPage` | TEAM_LEAD, CEO |
| `/team` | `TeamPage` | CEO, ADMIN, HR department |
| `/settings` | `SettingsPage` | Any authenticated user |

### State Management (Zustand)

#### `authStore` — `src/features/auth/stores/authStore.js`

```
{
  user: {
    id, username, email, first_name, last_name,
    role,          ← hoisted from profile
    employee_id,   ← hoisted from profile
    organization,  ← { id, name, slug, theme_name, ... }
    department,    ← { id, name, monthly_budget, tl_approval_limit }
    profile: { ... }   ← original nested profile too
  },
  accessToken: "<jwt>",
  isAuthenticated: boolean
}

Actions:
  setAuth(user, accessToken)  ← called on login + token refresh
  clearAuth()                 ← called on logout + token refresh failure
  updateProfile(patch)        ← called after PATCH /api/me/
```

The `user.role` value is used throughout the frontend for rendering decisions (conditional sidebar items, form field visibility).

### Axios Interceptors — `src/shared/lib/axios.js`

Every outgoing API request automatically receives the `Authorization: Bearer <token>` header from Zustand in-memory state.

On a `401` response, the interceptor:
1. Reads `localStorage.refreshToken`
2. Calls `POST /api/token/refresh/`
3. Updates Zustand with the new access token
4. Retries the original request once

On refresh failure → `clearAuth()` → redirect to `/login`.

### CEO-Specific UI Restrictions

CEOs are blocked from:
- Creating a new petty cash request (the "New Request" button is hidden when `user.role === 'CEO'`)
- Submitting a leave request (the leave submission form is hidden/disabled for CEOs)

This is enforced on both the **frontend** (conditional rendering) and **backend** (HTTP 403 returned if CEO calls the create/submit endpoint).

---

## 10. API Endpoint Reference

### Base URLs

| Environment | URL |
|---|---|
| Local Development | `http://127.0.0.1:8000` |
| Production (Vercel) | `https://oms-backend-two.vercel.app` |

### Authentication

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/api/token/` | POST | `{username, password}` | `{access, refresh, user}` |
| `/api/token/refresh/` | POST | `{refresh}` | `{access, [refresh]}` |
| `/api/auth/logout/` | POST | `{refresh}` | `204` |
| `/api/me/` | GET | — | Full user object |
| `/api/me/` | PATCH | `{phone, avatar_url}` | Updated user object |

### Users & Departments

| Endpoint | Method | Notes |
|---|---|---|
| `/api/users/` | GET | List org users; supports `?search=`, `?profile__department=`, `?profile__role=` |
| `/api/users/` | POST | Create user (CEO/ADMIN/HR only) |
| `/api/users/{id}/` | GET | Retrieve user |
| `/api/users/{id}/change-role/` | POST | `{role}` — change user role |
| `/api/departments/` | GET | List org departments |

### Petty Cash

| Endpoint | Method | Notes |
|---|---|---|
| `/api/petty-cash/` | GET | List; supports `?state=`, `?department=`, `?priority=` |
| `/api/petty-cash/` | POST | Create (non-CEO) |
| `/api/petty-cash/{uuid}/` | GET/PUT/PATCH | Detail |
| `/api/petty-cash/{uuid}/submit/` | POST | Submit draft |
| `/api/petty-cash/{uuid}/approve/` | POST | `{approved_amount?}` |
| `/api/petty-cash/{uuid}/reject/` | POST | `{reason}` (required) |
| `/api/petty-cash/{uuid}/amend/` | POST | Reset rejected to draft |
| `/api/petty-cash/{uuid}/cancel/` | POST | Cancel |
| `/api/petty-cash/{uuid}/disburse/` | POST | `{amount, payment_method, reference_number, notes}` |
| `/api/petty-cash/bulk-action/` | POST | `{request_ids[], action, reason?}` |
| `/api/petty-cash/{uuid}/attachments/` | POST | File upload (multipart) |
| `/api/attachments/{pk}/` | GET | Download attachment binary |

### Leave

| Endpoint | Method | Notes |
|---|---|---|
| `/api/leave/requests/` | GET/POST | List or create |
| `/api/leave/requests/{uuid}/` | GET | Detail |
| `/api/leave/requests/{uuid}/submit/` | POST | Submit draft |
| `/api/leave/requests/{uuid}/approve/` | POST | TL/CEO approve |
| `/api/leave/requests/{uuid}/reject/` | POST | `{reason}` |
| `/api/leave/requests/{uuid}/amend/` | POST | Reset to draft |
| `/api/leave/requests/{uuid}/cancel/` | POST | Cancel |
| `/api/leave/requests/calculate-days/` | POST | `{start_date, end_date, is_half_day}` |
| `/api/leave/requests/team-calendar/` | GET | Approved leaves in org |
| `/api/leave/balances/` | GET | Own balances by type + year |
| `/api/leave/types/` | GET | Org leave types |
| `/api/leave/holidays/` | GET | Org holidays |

### OpenAPI Documentation

| URL | Purpose |
|---|---|
| `/api/schema/` | Raw OpenAPI JSON/YAML |
| `/api/schema/swagger-ui/` | Swagger interactive docs |
| `/api/schema/redoc/` | ReDoc documentation view |

---

## 11. Deployment Topology

### Current Setup

```
Internet
  │
  ├── https://oms-frontend-iota.vercel.app   (Vite SPA, Vercel CDN)
  │       └─ VITE_API_URL=https://oms-backend-two.vercel.app
  │
  └── https://oms-backend-two.vercel.app      (Django WSGI, Vercel Functions)
          └─ DATABASE_URL → Cloud SQL (MySQL)
          └─ CELERY/REDIS → ⚠️ NOT RUNNING on Vercel (serverless)
          └─ CHANNELS/WebSockets → ⚠️ NOT RUNNING on Vercel
```

### Vercel Build Config (`oms_backend/vercel.json`)

```json
{
  "version": 2,
  "builds": [
    { "src": "oms_project/wsgi.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "oms_project/wsgi.py" }
  ]
}
```

Vercel runs Django as a serverless Python function. Each request spawns a new process. **Stateful services (Celery workers, WebSocket consumers) do NOT run on Vercel** and would need to be hosted on a dedicated server (e.g., Railway, Render, EC2).

### Settings Class Hierarchy

```
base.py      ← All shared settings
    │
    ├─ development.py   ← DEBUG=True, local DB, relaxed CORS
    └─ production.py    ← DEBUG=False, strict ALLOWED_HOSTS, CORS, HSTS
```

Active settings are controlled by: `DJANGO_SETTINGS_MODULE=oms_project.settings.production`

---

## 12. Environment Variables

### Backend (`.env` in `oms_backend/`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `SECRET_KEY` | ✅ | `django-insecure-...` | Django secret key |
| `DEBUG` | ✅ | `False` | Set to `True` for local dev |
| `ALLOWED_HOSTS` | ✅ | `oms-backend-two.vercel.app` | Comma-separated list |
| `DATABASE_URL` | ✅ | `mysql://user:pass@host:3306/db` | Cloud SQL connection string |
| `CELERY_BROKER_URL` | ✅ | `redis://localhost:6379/0` | Celery message broker |
| `CELERY_RESULT_BACKEND` | ✅ | `redis://localhost:6379/0` | Celery results |
| `REDIS_URL` | ✅ | `redis://localhost:6379/0` | Django Channels layer |
| `EMAIL_HOST` | ✅ | `smtp.gmail.com` | SMTP host |
| `EMAIL_PORT` | ✅ | `587` | Usually 587 for TLS |
| `EMAIL_HOST_USER` | ✅ | `noreply@amaze.com` | Sender email |
| `EMAIL_HOST_PASSWORD` | ✅ | `app-password` | SMTP password |
| `EMAIL_USE_TLS` | ✅ | `True` | TLS toggle |
| `DEFAULT_FROM_EMAIL` | ✅ | `noreply@amaze.com` | From address |
| `CORS_ALLOWED_ORIGINS` | Prod | `https://oms-frontend-iota.vercel.app` | Comma-separated |
| `SECURE_SSL_REDIRECT` | Prod | `True` | Force HTTPS |
| `VERCEL` | Auto | `1` | Vercel injects this automatically |

### Frontend (`.env` in `oms_frontend/`)

| Variable | Example | Notes |
|---|---|---|
| `VITE_API_URL` | `https://oms-backend-two.vercel.app` | Backend base URL |
| `VITE_WS_URL` | `wss://oms-backend-two.vercel.app` | WebSocket base URL |

> **Vite env variables must be prefixed with `VITE_`** to be accessible in browser code via `import.meta.env.VITE_*`.

---

## 13. Role-Based Access Control (RBAC)

### Roles

| Role | Code | Description |
|---|---|---|
| Employee | `EMPLOYEE` | Regular employee, lowest privilege |
| Team Lead | `TEAM_LEAD` | Can approve TL-level requests |
| CEO | `CEO` | Senior approver, no self-service requests |
| Global Admin | `ADMIN` | Super-user across all orgs |

### Permission Matrix

| Action | EMPLOYEE | TEAM_LEAD | CEO | ADMIN | HR Dept |
|---|:---:|:---:|:---:|:---:|:---:|
| Create petty cash request | ✅ | ✅ | ❌ | ✅ | ✅ |
| Submit petty cash | ✅ | ✅ | ❌ | ✅ | ✅ |
| Approve petty cash (TL level) | ❌ | ✅ | ✅ | ✅ | ❌ |
| Approve petty cash (CEO level) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Disburse funds | ❌ | ❌ | ✅ | ✅ | ❌ |
| Create leave request | ✅ | ✅ | ❌ | ✅ | ✅ |
| Approve leave request | ❌ | ✅ | ✅ | ✅ | ❌ |
| View Approval Center | ❌ | ✅ | ✅ | ✅ | ❌ |
| View Analytics | ❌ | ❌ | ✅ | ✅ | ❌ |
| Create Delegation | ❌ | ✅ | ✅ | ✅ | ❌ |
| Create users (Team Dir.) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Change user roles | ❌ | ❌ | ✅ | ✅ | ✅ |
| Assign ADMIN role | ❌ | ❌ | ❌ | ✅ | ❌ |

### Delegation Override

When a TL or CEO creates an `ApprovalDelegation`, their delegate gains equivalent approval authority for the specified scope (`PETTY_CASH`, `LEAVE`, or `ALL`) during the delegation date range.

`core/utils.py → is_authorized_approver(user, request_obj, scope)` checks:
1. User's own role matches required level for current state
2. OR user has an active incoming delegation covering this scope and date

---

## 14. Debugging Guide

### Backend — Vercel Production

#### Access Logs

1. Go to [vercel.com](https://vercel.com) → Your Project → **Logs** tab
2. Filter by `Function logs` to see Django output
3. Use `?since=1h` or time filter for recent errors

#### Check if Django is Starting

The first log line on any request should be the Gunicorn/WSGI startup. If you see `ModuleNotFoundError` or `ImportError`, the build failed.

#### Common Log Signals

| Log Message | Cause | Fix |
|---|---|---|
| `DisallowedHost` | `ALLOWED_HOSTS` missing Vercel domain | Add domain to env var |
| `500 Internal Server Error` | Usually missing env vars | Check all required vars are set in Vercel Dashboard |
| `ImproperlyConfigured: ...CELERY_BROKER_URL` | Celery env not set | Add to Vercel env vars |
| `No module named 'mysqlclient'` | MySQL driver missing | Use `pymysql` (already configured) |
| `django.db.utils.OperationalError` | DB unreachable | Check `DATABASE_URL`, Cloud SQL IP whitelist |

#### Reproduce Locally

```bash
cd oms_backend
DJANGO_SETTINGS_MODULE=oms_project.settings.production python manage.py check --deploy
```

This runs Django's deployment checks without needing to start the server.

#### Test an Endpoint with curl

```bash
# Login
curl -X POST https://oms-backend-two.vercel.app/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'

# Protected endpoint
curl https://oms-backend-two.vercel.app/api/me/ \
  -H "Authorization: Bearer <access_token>"
```

### Frontend — Browser DevTools

#### Check API calls

1. Open DevTools → **Network** tab
2. Filter by `Fetch/XHR`
3. Look for red (failed) requests
4. Click a failed request → **Response** tab to read the Django error JSON

#### Common Frontend Errors

| Console Error | Cause | Fix |
|---|---|---|
| `POST .../api/token/ 500` | Backend not running or DB issue | Check Vercel backend logs |
| `Network Error` / CORS | Missing `CORS_ALLOWED_ORIGINS` | Add frontend URL to backend env |
| `401 Unauthorized` on all requests | Token expired + refresh failed | Clear localStorage, re-login |
| User sees wrong data | Org isolation issue | Verify `request.organization` in backend |
| `VITE_API_URL undefined` | Env var missing | Re-add `.env` vars in Vercel frontend settings |

#### Check Auth State

In browser console:
```javascript
// See what Zustand thinks the user is
import('@/features/auth/stores/authStore').then(m => console.log(m.useAuthStore.getState()))

// Check localStorage
localStorage.getItem('refreshToken')
```

### Django Shell (Local Debugging)

```bash
cd oms_backend
python manage.py shell

# Check a user's profile
from django.contrib.auth.models import User
u = User.objects.get(username='alice')
print(u.profile.role, u.profile.organization)

# Check petty cash state for a request
from pettycash.models import PettyCashRequest
r = PettyCashRequest.objects.get(uuid='...')
print(r.state, r.amount_requested, r.amount_approved)

# Manual FSM transition test
r.submit()
r.save()
```

### Database Queries

```bash
# Run raw SQL against the database
python manage.py dbshell

# Check migrations status
python manage.py showmigrations

# Identify unapplied migrations
python manage.py migrate --check
```

### Audit Trail

Every important action writes to `core.AuditLog`. To query:

```python
from core.models import AuditLog
logs = AuditLog.objects.filter(target_type='PettyCashRequest', target_id=42)
for log in logs:
    print(log.created_at, log.actor, log.action, log.old_state, '->', log.new_state)
```

---

## 15. Common Issues & Solutions

### Issue: `DisallowedHost at /`

**Symptom:** Backend returns HTTP 400 with `Invalid HTTP_HOST header` error.

**Cause:** The Vercel-assigned domain is not in Django's `ALLOWED_HOSTS`.

**Fix:**
In Vercel backend environment variables, set:
```
ALLOWED_HOSTS=oms-backend-two.vercel.app,.vercel.app
```
Or in `base.py` (already handled):
```python
if os.environ.get('VERCEL') == '1':
    ALLOWED_HOSTS.extend(['.vercel.app', '*'])
```

---

### Issue: Login 500 Error

**Symptom:** `POST /api/token/ 500 Internal Server Error`

**Common Causes:**
1. `DATABASE_URL` not set → DB connect fails
2. Celery/Redis env vars missing (settings file tries to read them)
3. Missing `SECRET_KEY`

**Fix:** In Vercel dashboard → Settings → Environment Variables, ensure all required variables are set. Re-deploy after adding any variable.

---

### Issue: CORS Error on Frontend

**Symptom:** Browser console shows `Access to XMLHttpRequest has been blocked by CORS policy`

**Fix:** In backend Vercel environment:
```
CORS_ALLOWED_ORIGINS=https://oms-frontend-iota.vercel.app
```
`production.py` reads `CORS_ALLOWED_ORIGINS` from env.

---

### Issue: Token Refresh Loop / Logout Loop

**Symptom:** User gets repeatedly logged out shortly after login.

**Cause:** Refresh token in `localStorage` is expired or was blacklisted.

**Fix:** The axios interceptor clears auth state and redirects to `/login`. User simply needs to log in again. On the backend, ensure `SIMPLE_JWT['ROTATE_REFRESH_TOKENS'] = True`.

---

### Issue: CEO Can See Leave/Petty Cash Submission Forms

**Symptom:** CEO user sees "New Request" button for leave or petty cash.

**Cause:** Frontend conditional rendering not checking `user.role === 'CEO'`.

**Where to fix:**
- Petty cash: `src/features/petty-cash/pages/PettyCashListPage.jsx` — check for CEO role before rendering the new request button
- Leave: `src/features/leave/pages/LeaveListPage.jsx` — same check

The backend also enforces this with an HTTP 403 in the view's `create()` method.

---

### Issue: Department Budget Not Updating After Disbursement

**Symptom:** `Department.budget_spent_this_month` doesn't reflect recent disbursements.

**Cause:** Disbursements update the budget field in a transaction via `PettyCashViewSet.disburse()`. Check if the transaction committed.

**Debug:**
```python
from core.models import Department
d = Department.objects.get(id=1)
print(d.budget_spent_this_month)
```

---

### Issue: Attachment Upload Fails

**Symptom:** File upload returns `400` or `500`.

**Cause:**
- File is not a supported MIME type
- File size exceeds limit
- Request is not in `draft` state (attachments can only be added to drafts)
- `Content-Type: multipart/form-data` header missing

**Fix:** Ensure the frontend sends the file as `FormData` with `Content-Type: multipart/form-data`.

---

## 16. Local Development Setup

### Backend

```bash
# 1. Clone and navigate
cd oms_backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your local MySQL details

# 5. Run migrations
python manage.py migrate

# 6. Create a superuser
python manage.py createsuperuser

# 7. Start development server
DJANGO_SETTINGS_MODULE=oms_project.settings.development python manage.py runserver

# Optional: Start Celery worker (requires Redis running locally)
celery -A oms_project worker -l info

# Optional: Start Celery beat (scheduled tasks)
celery -A oms_project beat -l info
```

### Frontend

```bash
cd oms_frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit VITE_API_URL=http://127.0.0.1:8000

# 3. Start dev server
npm run dev
# Opens at http://localhost:5173

# Production build (when needed)
npm run build
```

### First-Time Data Setup

After running migrations, you need to create initial data via Django admin or shell:

```python
from core.models import Organization, Department
from accounts.models import UserProfile
from django.contrib.auth.models import User

# Create organization
org = Organization.objects.create(
    name="A Maze Venture",
    slug="amaze",
    theme_name="amaze"
)

# Create department
dept = Department.objects.create(
    organization=org,
    name="Engineering",
    monthly_budget=50000,
    tl_approval_limit=10000
)

# Create CEO user
ceo_user = User.objects.create_user(username='ceo', email='ceo@amaze.com', password='test1234')
UserProfile.objects.create(
    user=ceo_user,
    organization=org,
    department=dept,
    role='CEO',
    employee_id='AMZ-CEO-001'
)
```

### Running Tests

```bash
cd oms_backend
python manage.py test core
python manage.py test accounts
python manage.py test pettycash
python manage.py test leave
```

---

## Appendix: Key File Locations Quick Reference

| What you're looking for | File |
|---|---|
| API base URL (frontend) | `oms_frontend/src/shared/constants/apiEndpoints.js` |
| All routes (frontend) | `oms_frontend/src/app/router.jsx` |
| Auth state (frontend) | `oms_frontend/src/features/auth/stores/authStore.js` |
| HTTP client + interceptors | `oms_frontend/src/shared/lib/axios.js` |
| Role constants | `oms_frontend/src/shared/constants/roles.js` |
| FSM state labels | `oms_frontend/src/shared/constants/states.js` |
| Django settings | `oms_backend/oms_project/settings/base.py` |
| Production settings | `oms_backend/oms_project/settings/production.py` |
| URL router (backend) | `oms_backend/oms_project/urls.py` |
| Org middleware | `oms_backend/core/middleware.py` |
| Permission classes | `oms_backend/core/permissions.py` |
| User model | `oms_backend/accounts/models.py` |
| Petty cash FSM | `oms_backend/pettycash/models.py` |
| Leave FSM | `oms_backend/leave/models.py` |
| Audit log | `oms_backend/core/models.py` → `AuditLog` |
| Vercel build config | `oms_backend/vercel.json` |
