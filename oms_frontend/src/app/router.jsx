import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { ROLES } from '@/shared/constants/roles';

// Feature Page imports
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import PettyCashListPage from '@/features/petty-cash/pages/PettyCashListPage';
import PettyCashDetailPage from '@/features/petty-cash/pages/PettyCashDetailPage';
import LeaveListPage from '@/features/leave/pages/LeaveListPage';
import LeaveDetailPage from '@/features/leave/pages/LeaveDetailPage';
import LeaveCalendarPage from '@/features/leave/pages/LeaveCalendarPage';
import ApprovalCenterPage from '@/features/approvals/pages/ApprovalCenterPage';
import AnalyticsDashboardPage from '@/features/analytics/pages/AnalyticsDashboardPage';
import WeeklyReportPage from '@/features/analytics/pages/WeeklyReportPage';
import MonthlyReportPage from '@/features/analytics/pages/MonthlyReportPage';
import QuarterlyReportPage from '@/features/analytics/pages/QuarterlyReportPage';
import DelegationPage from '@/features/delegation/pages/DelegationPage';
import TeamPage from '@/features/team/pages/TeamPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';

// Roles that have access to analytics & reports
const ANALYTICS_ROLES = [ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.TEAM_LEAD, ROLES.HR];

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginForm />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'petty-cash',
        element: <PettyCashListPage />,
      },
      {
        path: 'petty-cash/:uuid',
        element: <PettyCashDetailPage />,
      },
      {
        path: 'leave',
        element: <LeaveListPage />,
      },
      {
        path: 'leave/:uuid',
        element: <LeaveDetailPage />,
      },
      {
        path: 'leave/calendar',
        element: <LeaveCalendarPage />,
      },
      {
        path: 'approvals',
        element: (
          <ProtectedRoute allowedRoles={[ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.HR]}>
            <ApprovalCenterPage />
          </ProtectedRoute>
        ),
      },
      // ─── Analytics & Reports ──────────────────────────────────────────────
      {
        path: 'analytics',
        element: (
          <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
            <AnalyticsDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'analytics/weekly',
        element: (
          <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
            <WeeklyReportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'analytics/monthly',
        element: (
          <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
            <MonthlyReportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'analytics/quarterly',
        element: (
          <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
            <QuarterlyReportPage />
          </ProtectedRoute>
        ),
      },
      // ─────────────────────────────────────────────────────────────────────
      {
        path: 'delegation',
        element: (
          <ProtectedRoute allowedRoles={[ROLES.TEAM_LEAD, ROLES.CEO, ROLES.GENERAL_MANAGER]}>
            <DelegationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'team',
        element: (
          <ProtectedRoute allowedRoles={[ROLES.CEO, ROLES.ADMIN, ROLES.HR]} allowHR={true}>
            <TeamPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
export default router;
