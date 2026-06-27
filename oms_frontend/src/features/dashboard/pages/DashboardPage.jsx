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

  // Query: CEO/Admin Executive Consolidated Dashboard Data
  const { data: execDashboardData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['exec-dashboard-data'],
    queryFn: async () => {
      const [summary, trends, burnRate] = await Promise.all([
        analyticsApi.getSummary(),
        analyticsApi.getSpendingTrends(),
        analyticsApi.getBudgetBurnRate()
      ]);
      return { summary, trends, burnRate };
    },
    enabled: isExecutive,
  });

  const execSummary = execDashboardData?.summary;
  const spendingTrends = execDashboardData?.trends;
  const budgetBurnRate = execDashboardData?.burnRate;

  // Query: Upcoming Absences for Team Lead, Manager, CEO, HR
  const { data: upcomingAbsences, isLoading: isUpcomingAbsencesLoading } = useQuery({
    queryKey: ['dashboard-upcoming-absences'],
    queryFn: () => analyticsApi.getUpcomingAbsences(),
    enabled: !!user && isManagerOrExec,
  });

  // Query: Personal / Department Petty Cash Requests
  const { data: pettyCashData, isLoading: isPettyCashLoading } = useQuery({
    queryKey: ['dashboard-petty-cash'],
    queryFn: () => pettyCashApi.list({ page_size: 5 }),
  });

  // Query: Personal Petty Cash Requests for Stats
  const { data: personalPettyCashData } = useQuery({
    queryKey: ['dashboard-personal-petty-cash'],
    queryFn: () => pettyCashApi.list({ only_self: 'true', page_size: 100 }),
    enabled: !!user,
  });

  // Query: Personal Leave Requests for Stats
  const { data: personalLeaveData } = useQuery({
    queryKey: ['dashboard-personal-leave-requests'],
    queryFn: () => leaveApi.listRequests({ only_self: 'true', page_size: 100 }),
    enabled: !!user,
  });

  // Query: Personal Leave Balances & Requests Consolidated
  const { data: employeeDashboardData, isLoading: isEmployeeLoading } = useQuery({
    queryKey: ['employee-dashboard-data'],
    queryFn: async () => {
      const [balances, requests] = await Promise.all([
        leaveApi.listBalances({ year: new Date().getFullYear() }),
        leaveApi.listRequests({ page_size: 5 })
      ]);
      return { balances, requests };
    },
    enabled: !isExecutive && !!user,
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
    enabled: !!user && ['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO', 'ADMIN', 'HR'].includes(role),
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
  const totalPettyCashSpent = personalPettyCashData?.results
    ?.filter(r => ['disbursed', 'partially_disbursed'].includes(r.state))
    ?.reduce((sum, r) => sum + parseFloat(r.amount_disbursed), 0) || 0;
  const personalPettyCashSpentRef = useGSAPCounter(totalPettyCashSpent, [totalPettyCashSpent], { prefix: '৳' });
  const personalPettyCashCountRef = useGSAPCounter(totalPettyCashCount, [totalPettyCashCount]);

  const activeLeavesCount = personalLeaveData?.results?.filter(r => r.state === 'approved')?.length || 0;
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
