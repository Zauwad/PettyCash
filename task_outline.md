# 🚀 OMS Execution Task List

> **Started:** 2026-06-08 · **Currency:** BDT (৳) · **Auth:** Email+Password · **Storage:** Cloud SQL · **Notifications:** Email + In-App

---

## Phase Overview

| Phase | Focus | Tasks |
|-------|-------|-------|
| **1** | Project Scaffolding & Environment | 8 tasks |
| **2** | Backend — Core Models & Auth | 10 tasks |
| **3** | Backend — Petty Cash Module | 10 tasks |
| **4** | Backend — Leave Module & Audit | 13 tasks |
| **5** | Backend — Analytics, Email, WebSockets & Seed Data | 9 tasks |
| **6** | Frontend — Foundation & Auth | 12 tasks |
| **7** | Frontend — Feature Modules | 12 tasks |
| **8** | Integration, Polish & Launch | 11 tasks |

### Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| **Q1** | Currency & Locale | **BDT (৳)** — Single currency, Bangladeshi Taka |
| **Q2** | Authentication Method | **Email + Password only** — No SSO/OAuth |
| **Q3** | File Storage | **Cloud in SQL** — Store files in the database / cloud SQL |
| **Q4** | Email Notifications | **Both** — Email (Celery + SMTP) AND in-app web notifications |
| **Q5** | Seed Data | **Yes** — Comprehensive seed script with demo data for all 3 orgs |

---

## Phase 1: Project Scaffolding & Environment Setup

- [ ] **1.1** Create Django project (`oms_backend/`) with proper settings structure (base/dev/prod)
- [ ] **1.2** Configure MySQL database connection in settings
- [ ] **1.3** Install all backend dependencies (`requirements.txt`) — DRF, SimpleJWT, django-fsm-2, django-filter, channels, celery, etc.
- [ ] **1.4** Create React app with Vite (`oms_frontend/`) — React 19 + Vite 6
- [ ] **1.5** Install all frontend dependencies — Tailwind v4, DaisyUI v5, GSAP, TanStack Query, Zustand, React Router v7, etc.
- [ ] **1.6** Configure Tailwind v4 + DaisyUI v5 with the 3 custom org themes (amaze, mynt, braincount)
- [ ] **1.7** Set up project-level `docker-compose.yml` for MySQL + Redis (optional, local dev)
- [ ] **1.8** Set up `.env` files for both backend and frontend

---

## Phase 2: Backend — Core Models & Auth

- [ ] **2.1** Create Django apps: `core`, `accounts`, `pettycash`, `leave`, `approvals`, `analytics`, `notifications`
- [ ] **2.2** Build Core models: `Organization`, `Department`
- [ ] **2.3** Build Accounts models: `User` (extend Django), `UserProfile` with roles (EMPLOYEE, TEAM_LEAD, CEO, ADMIN)
- [ ] **2.4** Build multi-tenant middleware: `OrganizationMiddleware`
- [ ] **2.5** Build `OrganizationViewSetMixin` — auto-filter + auto-set org
- [ ] **2.6** Build `IsOrganizationMember` permission class
- [ ] **2.7** Implement JWT Auth endpoints: login, refresh, logout, me
- [ ] **2.8** Create serializers for auth & user profile
- [ ] **2.9** Write data migration to seed the 3 organizations
- [ ] **2.10** Run `makemigrations` + `migrate` — verify DB schema

---

## Phase 3: Backend — Petty Cash Module

- [ ] **3.1** Build models: `PettyCashRequest`, `PettyCashLineItem`, `Attachment`, `Disbursement`
- [ ] **3.2** Implement FSM states & transitions using `django-fsm-2` (draft → pending_tl → pending_ceo → approved → disbursed)
- [ ] **3.3** Build serializers: request CRUD, line items (nested writable), attachments, disbursements
- [ ] **3.4** Build ViewSets: `PettyCashViewSet` with custom actions (submit, approve, reject, amend, cancel, disburse)
- [ ] **3.5** Implement budget enforcement (department monthly budget check on submit)
- [ ] **3.6** Implement partial disbursement tracking logic
- [ ] **3.7** Implement bulk approve/reject endpoint
- [ ] **3.8** Implement file upload endpoint (multi-file, validation: 10MB, PDF/JPG/PNG/WEBP)
- [ ] **3.9** Wire up URL routes for petty cash
- [ ] **3.10** Test endpoints via DRF browsable API / curl

---

## Phase 4: Backend — Leave Module & Audit

- [ ] **4.1** Build models: `LeaveType`, `LeaveBalance`, `LeaveRequest`, `CompanyHoliday`
- [ ] **4.2** Implement FSM states & transitions for leave requests
- [ ] **4.3** Implement working days calculator (exclude weekends + company holidays + BD national holidays)
- [ ] **4.4** Implement overlap detection validator
- [ ] **4.5** Implement negative balance policy check (per org `policy_config`)
- [ ] **4.6** Build serializers: leave types, balances, requests, holidays, calculate-days
- [ ] **4.7** Build ViewSets: `LeaveTypeViewSet`, `LeaveBalanceViewSet`, `LeaveRequestViewSet`, `CompanyHolidayViewSet`
- [ ] **4.8** Implement team calendar endpoint (`/api/leave/team-calendar/`)
- [ ] **4.9** Build `AuditLog` model + automatic logging on FSM transitions
- [ ] **4.10** Build `ApprovalDelegation` model + delegation check logic
- [ ] **4.11** Build `Notification` model + creation on status changes
- [ ] **4.12** Wire up URL routes for leave, audit, delegation, notifications
- [ ] **4.13** Test all leave endpoints

---

## Phase 5: Backend — Analytics, Email, WebSockets & Seed Data

- [ ] **5.1** Build `AnalyticsViewSet` — spending trends, budget burn rate, upcoming absences, summary
- [ ] **5.2** Set up Celery + Redis for async tasks
- [ ] **5.3** Implement email notification tasks (Celery): approval needed, status changed, delegation granted
- [ ] **5.4** Set up Django Channels + WebSocket consumer (`DashboardConsumer`)
- [ ] **5.5** Broadcast status changes via WebSocket on FSM transitions
- [ ] **5.6** Implement Celery Beat tasks: budget reset (monthly), delegation expiry (daily)
- [ ] **5.7** Set up `drf-spectacular` for auto-generated API docs (Swagger UI)
- [ ] **5.8** Create comprehensive seed/fixture script — 3 orgs, departments, users (various roles), sample petty cash requests, leave types/balances, holidays
- [ ] **5.9** Run full backend smoke test — all endpoints working

---

## Phase 6: Frontend — Foundation & Auth

- [ ] **6.1** Set up design system: `index.css` with 3 DaisyUI themes, typography (Inter + Outfit), glassmorphism utilities
- [ ] **6.2** Build shared layout: `AppLayout`, `Sidebar`, `Header`, `MobileNav`
- [ ] **6.3** Build `AppProviders` (QueryClient + Auth + Theme wrappers)
- [ ] **6.4** Build `AuthProvider` + `authStore` (Zustand) — JWT storage, refresh logic
- [ ] **6.5** Build `ThemeProvider` — dynamic theme switching per org
- [ ] **6.6** Build `LoginForm` with GSAP stagger-in animation
- [ ] **6.7** Build `ProtectedRoute` + router config (React Router v7)
- [ ] **6.8** Set up Axios instance with JWT interceptor (auto-attach token, auto-refresh on 401)
- [ ] **6.9** Build shared UI components: `StatusBadge`, `DataTable`, `LoadingSkeleton`, `ConfirmModal`, `EmptyState`, `FileUploader`, `SearchInput`
- [ ] **6.10** Build GSAP hooks: `useGSAPStagger`, `useGSAPCounter`, `useGSAPPageTransition`
- [ ] **6.11** Build `PageTransition` wrapper component
- [ ] **6.12** Verify login flow end-to-end (frontend ↔ backend)

---

## Phase 7: Frontend — Feature Modules

- [ ] **7.1** Build Dashboard: `DashboardPage`, `WelcomeHero`, `StatCards` (animated counters), `QuickActions`, `RecentActivity`, `PendingApprovals`
- [ ] **7.2** Build Petty Cash List: `PettyCashListPage`, `RequestList` (staggered cards), filters, search, pagination
- [ ] **7.3** Build Petty Cash Form: `RequestForm` (multi-step), `LineItemEditor` (dynamic rows), `BudgetIndicator` (animated bar)
- [ ] **7.4** Build Petty Cash Detail: `PettyCashDetailPage`, `RequestTimeline`, `ReceiptPreview` (inline PDF/image), `DisbursementPanel`
- [ ] **7.5** Build Leave List: `LeaveListPage`, `LeaveList`, `LeaveBalance` (animated donut charts)
- [ ] **7.6** Build Leave Form: `LeaveForm` with date picker, overlap warnings, `WorkingDaysCalc` live display
- [ ] **7.7** Build Leave Detail: `LeaveDetailPage` with approval timeline
- [ ] **7.8** Build Leave Calendar: `LeaveCalendarPage` — monthly team view
- [ ] **7.9** Build Approval Center: `ApprovalCenterPage`, `ApprovalQueue`, `ExpressApproval`, `BulkActionBar` (GSAP slide-up)
- [ ] **7.10** Build Analytics Dashboard: `AnalyticsDashboardPage`, `SpendingTrendChart`, `BudgetBurnRate`, `AbsenceCalendar`, `SummaryMetrics`
- [ ] **7.11** Build Delegation: `DelegationPage`, `DelegationForm`, `ActiveDelegations`
- [ ] **7.12** Build Notifications: `NotificationBell` (shake animation), `NotificationDropdown`, WebSocket integration

---

## Phase 8: Integration, Polish & Launch

- [ ] **8.1** Full integration test: create petty cash request → TL approve → CEO approve → disburse (all 3 orgs)
- [ ] **8.2** Full integration test: leave request → approve → verify balance deduction → cancel → verify balance restore
- [ ] **8.3** Test multi-tenant isolation: log in as Org A user, verify no Org B/C data visible
- [ ] **8.4** Test delegation flow end-to-end
- [ ] **8.5** Test bulk approval flow
- [ ] **8.6** Verify email notifications arrive correctly
- [ ] **8.7** Responsive testing: 1440px, 1024px, 768px, 375px
- [ ] **8.8** GSAP animation performance check (60fps target)
- [ ] **8.9** Final UI polish: empty states, error states, loading skeletons
- [ ] **8.10** Run seed script, verify demo-ready state
- [ ] **8.11** Create README.md with setup instructions
