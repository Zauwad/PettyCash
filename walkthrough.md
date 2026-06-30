# Walkthrough: Approval Hierarchy Verification & Database Data Migration

This walkthrough summarizes the refinements, validation, and data migrations completed to align Leave and Petty Cash approval workflows with the new business rules.

## 🛠️ Refinements, Fixes & Migrations Implemented

1. **OOO Delegation & Team Management Permissions Updated**
   - **Delegation Access for GM**: Modified [DelegationPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/delegation/pages/DelegationPage.jsx) to include `'GENERAL_MANAGER'` in the `isAuthorizedToDelegate` check and colleague list filters. This grants General Managers complete access to configure, delegate, and receive Out-of-Office approval delegation records.
   - **Team Management Tab Hidden for GM**: Removed the `GENERAL_MANAGER` role from the allowed access list of the **Team Management** navigation item in both [Sidebar.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/shared/components/layout/Sidebar.jsx) and [MobileNav.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/shared/components/layout/MobileNav.jsx), successfully hiding this tab for GM role users.

2. **Frontend Route Guards Fixed**
   - Modified [router.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/app/router.jsx) to add `ROLES.GENERAL_MANAGER` and `ROLES.HR` to the `allowedRoles` array of the `/approvals` protected route.
   - Added `ROLES.GENERAL_MANAGER` to the `/delegation` protected route.
   - This resolves the issue where tapping the approvals link redirected the General Manager/HR back to the dashboard, since the guard now correctly recognizes them as authorized.

3. **Frontend Role Access Expansion**
   - Expanded the frontend [roles.js](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/shared/constants/roles.js) constant definitions to include `GENERAL_MANAGER` and `HR` roles along with their labels.
   - Updated `Sidebar.jsx` and `MobileNav.jsx` to make the **Approvals** nav link visible to General Managers and HR roles.
   - Configured pending count queries in `Sidebar.jsx` and [ApprovalCenterPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/approvals/pages/ApprovalCenterPage.jsx) to filter and list requests pending GM approval (`pending_gm_approval`) and requests pending HR disbursement (`pending_hr_disbursement`/`partially_disbursed`).

4. **Database Data Migration**
   - Created a database data migration [0004_migrate_approved_states.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/pettycash/migrations/0004_migrate_approved_states.py) in the `pettycash` app.
   - Migrated **24 existing petty cash requests** that were in the outdated `'approved'` state to the new `'pending_hr_disbursement'` state. This updates all existing production data to match the new workflow and prevents runtime errors.

5. **Visibility Checking (`get_queryset` scope)**
   - Modified `get_queryset` in both [pettycash/views.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/pettycash/views.py#L39-L62) and [leave/views.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/leave/views.py#L96-L119) to restrict filtering strictly to the `list` action (`self.action == 'list'`).
   - This ensures detail-level actions (e.g. `approve`, `reject`, `disburse`) fetch the request object successfully and return `403 Forbidden` if unauthorized, instead of confusingly returning `404 Not Found`. It also permits delegated users to access detail endpoints properly.

6. **Partial Disbursement Target State Choice**
   - Modified the `hr_disburse` transition in [pettycash/models.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/pettycash/models.py#L184-L195) to use `django_fsm`'s `RETURN_VALUE` feature.
   - This dynamically transitions the request state to `partially_disbursed` if the cumulative paid amount is less than approved, or to `disbursed` when fully paid.
   - Fixed a `TypeError` by explicitly casting the input `amount` to `Decimal` when incrementing `self.amount_disbursed`.

7. **Disbursement Authorization State Check**
   - Updated the authorization check in [core/utils.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/core/utils.py#L87-L90) to allow HR users to perform disbursements on requests that are in either the `pending_hr_disbursement` state or the `partially_disbursed` state.

8. **Integration Test Suite Adjustments**
   - Updated [core/tests.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/core/tests.py) to match the new workflows:
     - `test_bulk_approval_flow`: Asserted that TL bulk approval routes requests to `pending_ceo_approval`.
     - `test_delegation_flow_end_to_end`: Passed required note/amount keys; asserted that CEO-delegated approval transitions the state to `pending_hr_disbursement`.
     - `test_end_to_end_leave_flow`: Integrated the General Manager approval step with required notes, asserting state matches `pending_gm_approval` and then `approved`.
     - `test_end_to_end_petty_cash_flow_over_limit`: Passed notes, updated parameter keys, used the HR user for disbursement, and updated state assertions.
   - Updated [leave/tests.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/leave/tests.py):
     - `test_leave_approval_updates_used_balance`: Modified setup to run both TL and GM approval stages with note payloads before asserting used balance updates.
   - Updated [pettycash/tests.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/pettycash/tests.py):
     - `test_approval_routing_escalation`: Updated approval payload to include the required note and correct key name.

9. **Frontend Syntax Bug Fix**
   - Cleaned up [PettyCashDetailPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/petty-cash/pages/PettyCashDetailPage.jsx#L1085-L1091) to remove duplicate block remnants at the end of the file.

10. **Workflow Stepper Timelines Premature Completion Fix**
    - **Leave Request Timeline**: In [LeaveDetailPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/leave/pages/LeaveDetailPage.jsx), corrected the conditions for the "Team Lead Approval" and "GM Approval" checkmarks to ensure they only render as completed (with a checkmark `✓` and green background) when the request state progresses *past* the respective approval stage or the approval note is recorded, rather than checking them prematurely while they are still pending action.
    - **Petty Cash Process Pipeline**: In [PettyCashDetailPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/petty-cash/pages/PettyCashDetailPage.jsx), made a similar refinement for "Team Lead Approval", "CEO Approval", and "Pending Payout" steps. They are now correctly unchecked when their respective states are still active/pending approval or action.

11. **Recent Activity Feature Scoping & Fixes**
    - **Backend Audit Logs API**: Implemented [AuditLogViewSet](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/core/views.py) to expose a new endpoint `/api/audit-logs/` with robust scoping logic:
      - **CEO / General Manager / Admins**: Retrieve all recent audit logs scoped per tenant organization.
      - **Team Leads**: Retrieve only audit logs related to requests (Petty Cash and Leave) originating from users in their own department.
      - **Regular Employees**: Access is blocked (returns empty/denied).
    - **Main Routing**: Registered `core.urls` in the main routing file [urls.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/oms_project/urls.py).
    - **Frontend API Client**: Created a shared [auditApi.js](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/shared/api/auditApi.js) client for the new `/api/audit-logs/` endpoint.
    - **Dashboard Integration**: Updated [DashboardPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/dashboard/pages/DashboardPage.jsx) to query the new Audit Logs endpoint for recent activities, rendering rich details (action, actor, reason, amount/duration) dynamically.
    - **Role Scoping (Employee Hiding)**: Wrapped the Recent Activity feed container in a role check so it is completely hidden for regular employees and queries are disabled for them.

12. **Personal Approvals Badge Scoping (Badge count fix)**
    - **Sidebar & Nav Counts**: Updated [Sidebar.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/shared/components/layout/Sidebar.jsx) to filter pending petty cash and leave requests based strictly on the logged-in user's role-specific pending states:
      - **Team Lead**: Counts only requests in `pending_tl_approval` (department-level scoped by backend).
      - **General Manager**: Counts only requests in `pending_gm_approval` (for Leave Requests).
      - **CEO / Admins**: Counts only requests in `pending_ceo_approval` (for Petty Cash).
      - **HR**: Counts only requests in `pending_hr_disbursement` and `partially_disbursed`.
      - **Self-Approval filter**: Automatically filters out the user's own requests (since a user cannot approve their own requests).
    - **Approval Center Sync**: Updated [ApprovalCenterPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/approvals/pages/ApprovalCenterPage.jsx) to use the exact same role-based filtering logic. This ensures that the tab count matches the list of requests in their approvals queue.

13. **Back Navigation Route Fixes**
    - **Approval Center Links**: Added React Router state parameter (`state={{ from: '/approvals' }}`) to links in [ApprovalCenterPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/approvals/pages/ApprovalCenterPage.jsx).
    - **Detail Pages back navigation**: Retrieved the state parameter via `useLocation` hook in [LeaveDetailPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/leave/pages/LeaveDetailPage.jsx) and [PettyCashDetailPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/petty-cash/pages/PettyCashDetailPage.jsx).
    - **Dynamic Redirection**: Configured the back buttons to dynamically route to `/approvals` (with the label `Back to Approvals`) if coming from approvals, falling back to default list paths/labels if accessed directly.

14. **Smart Requisition Quick-Find (ID Search Override)**
    - **Global Requisition Search**: Updated [pettycash/views.py](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_backend/pettycash/views.py) filter queryset to check if the search string is a Requisition reference or ID.
    - If a match is found (e.g. `REQ-1851` or `1851`), it skips state and tab filters, querying the database globally by ID to return the result immediately.

15. **Zero-Trust Budget Guard**
    - **Hide stats from regular employees**: Conditionally hid the department budget summary card on [EmployeeDashboardView.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/dashboard/components/EmployeeDashboardView.jsx) and the Budget Monitor widget on [PettyCashCreateModal.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/petty-cash/components/PettyCashCreateModal.jsx) if `user?.profile?.role === 'EMPLOYEE'`.
    - This limits budget visibility to Team Leads and Managers, avoiding excessive spending rushes while maintaining backend budget limit checks.

16. **My Leave Balances Widget**
    - **Dashboard Integration**: Added a personal leave balances tracking card for regular employees on the right sidebar of the dashboard, filling the empty space cleanly with a visualization of remaining/allocated days.

17. **Leave Type Scoping (Maternity & Paternity Leave Hide)**
    - **Hide by default**: Excluded Maternity and Paternity leave types from the employee's visible balances and the application category select dropdown on [LeaveListPage.jsx](file:///f:/Work%20Stuff/A%20Maze/PettyCash/PettyCash/oms_frontend/src/features/leave/pages/LeaveListPage.jsx).

18. **Multi-Tenant Custom Branding**
    - **Mynt Connect Customization**: Enabled dynamic branding for the Mynt Connect portal (displays correct organization names, correct emails, and hides unrelated brand info tables on the disbursement details).

19. **Log Cash Disbursement Reference Hardcoding**
    - **Single Reference System**: Bound the cash disbursement reference number directly to the requisition reference number to prevent dual-numbering confusion for HR and allow simple cross-referencing.

20. **Disbursement Details Grid Realignment**
    - **Horizontal Layout**: Repositioned the process pipeline, activity history, and disbursement journal to sit side-by-side in a responsive row layout, replacing the tall single vertical column.

---

## 🧪 Verification & Validation

- **Backend Test Suite**: Verified that all integration tests pass successfully:
  ```bash
  python manage.py test
  ```
- **Frontend Build**: Verified that Vite compiling environment builds client code without error:
  ```bash
  npm run build
  ```
