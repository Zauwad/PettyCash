import { useAuth } from '@/features/auth/hooks/useAuth';
import { useThemeStore } from '@/shared/stores/themeStore';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { pettyCashApi } from '@/features/petty-cash/api/pettyCashApi';
import { leaveApi } from '@/features/leave/api/leaveApi';
import { analyticsApi } from '@/features/analytics/api/analyticsApi';
import { auditApi } from '@/shared/api/auditApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useGSAPCounter } from '@/shared/hooks/useGSAPCounter';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';

import { WelcomeGreeting } from '../components/WelcomeGreeting';
import { ExecutiveSummaryView } from '../components/ExecutiveSummaryView';
import { EmployeeDashboardView } from '../components/EmployeeDashboardView';

export function DashboardPage() {
  const { user } = useAuth();
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const role = user?.profile?.role || user?.role;
  const isExecutive = ['CEO', 'ADMIN', 'GENERAL_MANAGER', 'HR'].includes(role);
  const isCEO = role === 'CEO';
  const isManagerOrExec = ['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO', 'ADMIN', 'HR'].includes(role);

  // Stagger entrance hook for dashboard cards
  const containerRef = useGSAPStagger('.stagger-card', [role]);

  // Query 1: Executive Summary Numbers (Immediate)
  const { data: execSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['executive-summary'],
    queryFn: () => analyticsApi.getSummary(),
    enabled: isExecutive && !!user,
  });

  // Query 2: Executive Charts Data (Staggered - only after summary loads)
  const { data: spendingTrends } = useQuery({
    queryKey: ['executive-spending-trends'],
    queryFn: () => analyticsApi.getSpendingTrends(),
    enabled: isExecutive && !!execSummary,
  });

  const { data: budgetBurnRate } = useQuery({
    queryKey: ['executive-budget-burn-rate'],
    queryFn: () => analyticsApi.getBudgetBurnRate(),
    enabled: isExecutive && !!execSummary,
  });

  // Query: Personal Petty Cash Requests for Stats (Immediate)
  const { data: personalPettyCashData } = useQuery({
    queryKey: ['dashboard-personal-petty-cash'],
    queryFn: () => pettyCashApi.list({ only_self: 'true', page_size: 1 }),
    enabled: !isExecutive && !!user,
  });

  // Query: Disbursed Petty Cash Requests for Spent Sum Stats (Immediate)
  const { data: disbursedPettyCashData } = useQuery({
    queryKey: ['dashboard-disbursed-petty-cash'],
    queryFn: () => pettyCashApi.list({ only_self: 'true', state: 'disbursed', page_size: 100 }),
    enabled: !isExecutive && !!user,
  });

  // Query: Personal Approved Leave Requests for Stats (Immediate)
  const { data: personalLeaveData } = useQuery({
    queryKey: ['dashboard-personal-leave-requests'],
    queryFn: () => leaveApi.listRequests({ only_self: 'true', state: 'approved', page_size: 1 }),
    enabled: !isExecutive && !!user,
  });

  // Determine when top widgets/stats are successfully loaded
  const isTopSectionLoaded = isExecutive ? !!execSummary : !!personalPettyCashData;

  // Query: Upcoming Absences (Staggered - only after top section loads)
  const { data: upcomingAbsences, isLoading: isUpcomingAbsencesLoading } = useQuery({
    queryKey: ['dashboard-upcoming-absences'],
    queryFn: () => analyticsApi.getUpcomingAbsences(),
    enabled: !!user && isManagerOrExec && isTopSectionLoaded,
  });

  // Query: Personal / Department Petty Cash Requests (Staggered - only after top section loads)
  const { data: pettyCashData, isLoading: isPettyCashLoading } = useQuery({
    queryKey: ['dashboard-petty-cash'],
    queryFn: () => pettyCashApi.list({ page_size: 5 }),
    enabled: !!user && isTopSectionLoaded,
  });

  // Query: Personal Leave Balances & Requests Consolidated (Staggered - only after top section loads)
  const { data: employeeDashboardData, isLoading: isEmployeeLoading } = useQuery({
    queryKey: ['employee-dashboard-data'],
    queryFn: async () => {
      const [balances, requests] = await Promise.all([
        leaveApi.listBalances({ year: new Date().getFullYear() }),
        leaveApi.listRequests({ page_size: 5 })
      ]);
      return { balances, requests };
    },
    enabled: !isExecutive && !!user && isTopSectionLoaded,
  });

  const leaveBalances = employeeDashboardData?.balances;
  const leaveRequests = employeeDashboardData?.requests;
  const isLeaveRequestsLoading = isEmployeeLoading;
  const isLeaveBalancesLoading = isEmployeeLoading;

  // Query: Recent audit logs for activity timeline via Infinite Query
  const {
    data: infiniteActivities,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isActivitiesLoading,
  } = useInfiniteQuery({
    queryKey: ['dashboard-activities'],
    queryFn: ({ pageParam = 1 }) => auditApi.list({ page: pageParam, page_size: 15 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.next) return undefined;
      return allPages.length + 1;
    },
    enabled: !!user && ['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO', 'ADMIN', 'HR'].includes(role) && isTopSectionLoaded,
  });

  const allActivities = infiniteActivities?.pages?.flatMap(page => page.results || []) || [];

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  };

  // GSAP Counter references (only populated when data loads)
  const monthlySpendRef = useGSAPCounter(execSummary?.monthly_spend || 0, [execSummary?.monthly_spend], { prefix: '৳' });
  const pendingApprovalsRef = useGSAPCounter(execSummary?.pending_approvals || 0, [execSummary?.pending_approvals]);
  const employeesOnLeaveRef = useGSAPCounter(execSummary?.employees_on_leave || 0, [execSummary?.employees_on_leave]);
  const totalRequestsRef = useGSAPCounter(execSummary?.total_requests || 0, [execSummary?.total_requests]);

  // Employee-scoped stat counters
  const totalPettyCashCount = personalPettyCashData?.count || 0;
  const totalPettyCashSpent = disbursedPettyCashData?.results
    ?.reduce((sum, r) => sum + parseFloat(r.amount_disbursed || r.amount_requested || 0), 0) || 0;
  const personalPettyCashSpentRef = useGSAPCounter(totalPettyCashSpent, [totalPettyCashSpent], { prefix: '৳' });
  const personalPettyCashCountRef = useGSAPCounter(totalPettyCashCount, [totalPettyCashCount]);

  const activeLeavesCount = personalLeaveData?.count || 0;
  const activeLeavesCountRef = useGSAPCounter(activeLeavesCount, [activeLeavesCount]);

  // Compute available budget for employee's department
  const deptBudget = parseFloat(user?.profile?.department?.monthly_budget || 0);
  const tlLimit = parseFloat(user?.profile?.department?.tl_approval_limit || 0);

  return (
    <PageTransition>
      <div ref={containerRef} className="space-y-8 pb-12">
        <WelcomeGreeting user={user} isExecutive={isExecutive} isCEO={isCEO} />

        {isExecutive && (
          <ExecutiveSummaryView
            user={user}
            isDarkMode={isDarkMode}
            isSummaryLoading={isSummaryLoading}
            spendingTrends={spendingTrends}
            budgetBurnRate={budgetBurnRate}
            monthlySpendRef={monthlySpendRef}
            pendingApprovalsRef={pendingApprovalsRef}
            employeesOnLeaveRef={employeesOnLeaveRef}
            totalRequestsRef={totalRequestsRef}
          />
        )}

        <EmployeeDashboardView
          user={user}
          isExecutive={isExecutive}
          isManagerOrExec={isManagerOrExec}
          isPettyCashLoading={isPettyCashLoading}
          isLeaveRequestsLoading={isLeaveRequestsLoading}
          isLeaveBalancesLoading={isLeaveBalancesLoading}
          isUpcomingAbsencesLoading={isUpcomingAbsencesLoading}
          isActivitiesLoading={isActivitiesLoading}
          isFetchingNextPage={isFetchingNextPage}
          pettyCashData={pettyCashData}
          leaveRequests={leaveRequests}
          leaveBalances={leaveBalances}
          upcomingAbsences={upcomingAbsences}
          allActivities={allActivities}
          personalPettyCashSpentRef={personalPettyCashSpentRef}
          personalPettyCashCountRef={personalPettyCashCountRef}
          activeLeavesCountRef={activeLeavesCountRef}
          tlLimit={tlLimit}
          deptBudget={deptBudget}
          handleScroll={handleScroll}
        />
      </div>
    </PageTransition>
  );
}

export default DashboardPage;
