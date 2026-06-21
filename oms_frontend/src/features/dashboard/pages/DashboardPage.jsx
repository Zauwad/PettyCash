import { useAuth } from '@/features/auth/hooks/useAuth';
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
  const role = user?.profile?.role || user?.role;
  const isExecutive = ['CEO', 'ADMIN', 'GENERAL_MANAGER', 'HR'].includes(role);
  const isCEO = role === 'CEO';
  const isManagerOrExec = ['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO', 'ADMIN', 'HR'].includes(role);

  // Stagger entrance hook for dashboard cards
  const containerRef = useGSAPStagger('.stagger-card', [role]);

  // Query: CEO/Admin Executive Summary
  const { data: execSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.getSummary(),
    enabled: isExecutive,
  });

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

  // Query: Personal Leave Balances
  const { data: leaveBalances, isLoading: isLeaveBalancesLoading } = useQuery({
    queryKey: ['dashboard-leave-balances'],
    queryFn: () => leaveApi.listBalances({ year: new Date().getFullYear() }),
    enabled: !isExecutive,
  });

  // Query: Personal/Department Leave Requests
  const { data: leaveRequests, isLoading: isLeaveRequestsLoading } = useQuery({
    queryKey: ['dashboard-leave-requests'],
    queryFn: () => leaveApi.listRequests({ page_size: 5 }),
    enabled: !isExecutive,
  });

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
  const totalPettyCashCount = pettyCashData?.results?.length || 0;
  const totalPettyCashSpent = pettyCashData?.results
    ?.filter(r => ['disbursed', 'partially_disbursed'].includes(r.state))
    ?.reduce((sum, r) => sum + parseFloat(r.amount_disbursed), 0) || 0;
  const personalPettyCashSpentRef = useGSAPCounter(totalPettyCashSpent, [totalPettyCashSpent], { prefix: '৳' });
  const personalPettyCashCountRef = useGSAPCounter(totalPettyCashCount, [totalPettyCashCount]);

  const activeLeavesCount = leaveRequests?.results?.filter(r => r.state === 'approved')?.length || 0;
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
            isSummaryLoading={isSummaryLoading}
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
