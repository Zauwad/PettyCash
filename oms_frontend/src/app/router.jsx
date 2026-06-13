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
import DelegationPage from '@/features/delegation/pages/DelegationPage';
import TeamPage from '@/features/team/pages/TeamPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';

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
      {
        path: 'analytics',
        element: (
          <ProtectedRoute allowedRoles={[ROLES.CEO, ROLES.ADMIN]}>
            <AnalyticsDashboardPage />
          </ProtectedRoute>
        ),
      },
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
          <ProtectedRoute allowedRoles={[ROLES.CEO, ROLES.ADMIN]} allowHR={true}>
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
