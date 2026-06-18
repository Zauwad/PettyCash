import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { ROLES } from '@/shared/constants/roles';

// Lazy loader helper with Suspense fallback
const lazyLoad = (importFunc) => {
  const LazyComponent = lazy(importFunc);
  
  // Set display name for react devtools
  const LazyWrapper = (props) => (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg text-secondary"></span>
      </div>
    }>
      <LazyComponent {...props} />
    </Suspense>
  );
  return LazyWrapper;
};

// Lazy Page imports
const DashboardPage = lazyLoad(() => import('@/features/dashboard/pages/DashboardPage'));
const PettyCashListPage = lazyLoad(() => import('@/features/petty-cash/pages/PettyCashListPage'));
const PettyCashDetailPage = lazyLoad(() => import('@/features/petty-cash/pages/PettyCashDetailPage'));
const LeaveListPage = lazyLoad(() => import('@/features/leave/pages/LeaveListPage'));
const LeaveDetailPage = lazyLoad(() => import('@/features/leave/pages/LeaveDetailPage'));
const LeaveCalendarPage = lazyLoad(() => import('@/features/leave/pages/LeaveCalendarPage'));
const ApprovalCenterPage = lazyLoad(() => import('@/features/approvals/pages/ApprovalCenterPage'));
const AnalyticsDashboardPage = lazyLoad(() => import('@/features/analytics/pages/AnalyticsDashboardPage'));
const WeeklyReportPage = lazyLoad(() => import('@/features/analytics/pages/WeeklyReportPage'));
const MonthlyReportPage = lazyLoad(() => import('@/features/analytics/pages/MonthlyReportPage'));
const QuarterlyReportPage = lazyLoad(() => import('@/features/analytics/pages/QuarterlyReportPage'));
const DelegationPage = lazyLoad(() => import('@/features/delegation/pages/DelegationPage'));
const TeamPage = lazyLoad(() => import('@/features/team/pages/TeamPage'));
const SettingsPage = lazyLoad(() => import('@/features/settings/pages/SettingsPage'));

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
