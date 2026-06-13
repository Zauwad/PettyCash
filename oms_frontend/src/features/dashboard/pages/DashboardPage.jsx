import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useThemeStore } from '@/shared/stores/themeStore';
import { useQuery } from '@tanstack/react-query';
import { pettyCashApi } from '@/features/petty-cash/api/pettyCashApi';
import { leaveApi } from '@/features/leave/api/leaveApi';
import { analyticsApi } from '@/features/analytics/api/analyticsApi';
import { auditApi } from '@/shared/api/auditApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useGSAPCounter } from '@/shared/hooks/useGSAPCounter';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { Link } from 'react-router-dom';
import {
  Wallet,
  CalendarDays,
  CheckSquare,
  Share2,
  PlusCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Users,
  Building,
  PiggyBank,
  AlertCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

function useTypewriter(text, speed = 35, delay = 100) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setCurrentIndex(0);
      setIsComplete(false);
      return;
    }
    setCurrentIndex(0);
    setIsComplete(false);
    
    let timer;
    const startTimeout = setTimeout(() => {
      timer = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          if (prevIndex >= text.length) {
            clearInterval(timer);
            setIsComplete(true);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      if (timer) clearInterval(timer);
    };
  }, [text, speed, delay]);

  const displayedText = text ? text.slice(0, currentIndex) : '';
  return { text: displayedText, isComplete };
}

export function DashboardPage() {
  const { user } = useAuth();
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const role = user?.profile?.role || user?.role;
  const isManager = ['TEAM_LEAD', 'CEO', 'ADMIN'].includes(role);
  const isExecutive = ['CEO', 'ADMIN'].includes(role);
  const isCEO = role === 'CEO';

  // Stagger entrance hook for dashboard cards
  const containerRef = useGSAPStagger('.stagger-card', [role]);

  // Query: CEO/Admin Executive Summary
  const { data: execSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.getSummary(),
    enabled: isExecutive,
  });

  // Query: CEO/Admin Spending Trends
  const { data: spendingTrends } = useQuery({
    queryKey: ['analytics-spending-trends'],
    queryFn: () => analyticsApi.getSpendingTrends(),
    enabled: isExecutive,
  });

  // Query: CEO/Admin Department Burn Rates
  const { data: budgetBurnRate } = useQuery({
    queryKey: ['analytics-burn-rate'],
    queryFn: () => analyticsApi.getBudgetBurnRate(),
    enabled: isExecutive,
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

  // Query: Recent audit logs for activity timeline
  const { data: activities, isLoading: isActivitiesLoading } = useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: () => auditApi.list({ page_size: 5 }),
    enabled: !!user && ['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO', 'ADMIN'].includes(role),
  });

  const getDhakaGreeting = () => {
    const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
    const dhakaTime = new Date(utc + 3600000 * 6);
    const hours = dhakaTime.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
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

  const userName = user?.first_name || user?.username;
  const greetingText = userName ? `${getDhakaGreeting()}, ${userName}!` : '';
  const { text: typedGreeting, isComplete: isGreetingComplete } = useTypewriter(greetingText, 35, 300);

  return (
    <PageTransition>
      <div ref={containerRef} className="space-y-8 pb-12">
        {/* Welcome Section */}
        <div className="stagger-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary/10 to-secondary/5 border border-primary/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
          <div className="absolute top-[-50%] right-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold Outfit tracking-tight min-h-[40px] flex items-center">
              {typedGreeting}
              {!isGreetingComplete && (
                <span className="inline-block w-[3px] h-[26px] bg-primary ml-1 animate-pulse" />
              )}
            </h2>
            <p className={`text-sm text-base-content/70 transition-all duration-700 ease-out transform ${
              isGreetingComplete 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-1.5 pointer-events-none'
            }`}>
              Welcome back to <span className="font-semibold text-primary">{user?.organization?.name}</span> portal.
              {isExecutive && ' Here is the executive dashboard overview.'}
              {!isExecutive && ` You are logged into the ${user?.profile?.department?.name || 'Central'} department.`}
            </p>
          </div>
          {!isCEO && (
            <div className="flex gap-3 relative z-10">
              <Link to="/petty-cash" className="btn btn-primary btn-sm rounded-xl font-bold gap-1.5 shadow-md shadow-primary/20">
                <PlusCircle className="w-4 h-4" />
                Petty Cash Requisition
              </Link>
              <Link to="/leave" className="btn btn-primary btn-sm rounded-xl font-bold gap-1.5 shadow-md shadow-secondary/20">
                <PlusCircle className="w-4 h-4" />
                Apply Leave
              </Link>
            </div>
          )}
        </div>

        {/* Executive Dashboard Cards */}
        {isExecutive && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-primary">
              <div className="bg-primary/10 p-4 rounded-xl text-primary">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Spend This Month</p>
                {isSummaryLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={monthlySpendRef} className="text-2xl font-extrabold Outfit">৳0</h3>
                )}
              </div>
            </div>

            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-secondary">
              <div className="bg-secondary/10 p-4 rounded-xl text-secondary">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Pending Approvals</p>
                {isSummaryLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={pendingApprovalsRef} className="text-2xl font-extrabold Outfit">0</h3>
                )}
              </div>
            </div>

            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-accent">
              <div className="bg-accent/10 p-4 rounded-xl text-accent">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Out on Leave Today</p>
                {isSummaryLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={employeesOnLeaveRef} className="text-2xl font-extrabold Outfit">0</h3>
                )}
              </div>
            </div>

            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-success">
              <div className="bg-success/10 p-4 rounded-xl text-success">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Total Requests (Month)</p>
                {isSummaryLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={totalRequestsRef} className="text-2xl font-extrabold Outfit">0</h3>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Regular Employee / Team Lead Dashboard Cards */}
        {!isExecutive && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-primary">
              <div className="bg-primary/10 p-4 rounded-xl text-primary">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">My Disbursed Requisitions</p>
                {isPettyCashLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={personalPettyCashSpentRef} className="text-2xl font-extrabold Outfit">৳0</h3>
                )}
              </div>
            </div>

            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-secondary">
              <div className="bg-secondary/10 p-4 rounded-xl text-secondary">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">My Total Requests</p>
                {isPettyCashLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={personalPettyCashCountRef} className="text-2xl font-extrabold Outfit">0</h3>
                )}
              </div>
            </div>

            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-success">
              <div className="bg-success/10 p-4 rounded-xl text-success">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Approved Leave requests</p>
                {isLeaveRequestsLoading ? (
                  <div className="h-8 w-24 skeleton rounded"></div>
                ) : (
                  <h3 ref={activeLeavesCountRef} className="text-2xl font-extrabold Outfit">0</h3>
                )}
              </div>
            </div>

            <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-info">
              <div className="bg-info/10 p-4 rounded-xl text-info">
                <Building className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Dept Approval Threshold</p>
                <h3 className="text-2xl font-extrabold Outfit text-base-content">
                  ৳{tlLimit.toLocaleString()}
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left / Middle: Activity or Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Executive Charts */}
            {isExecutive && (
              <>
                {/* Spend Trend Chart */}
                <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold Outfit">Petty Cash Spending Trends</h3>
                      <p className="text-xs text-base-content/50">Disbursed cash history over last 12 months</p>
                    </div>
                    <span className="text-xs font-bold text-success flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Live aggregates
                    </span>
                  </div>
                  <div className="h-72 w-full pt-4">
                    {spendingTrends && spendingTrends.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={spendingTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in oklch, var(--color-base-content) 8%, transparent)"/>
                          <XAxis dataKey="month" stroke="var(--color-base-content)" opacity={0.5} fontSize={11} tickLine={false} axisLine={false}/>
                          <YAxis stroke="var(--color-base-content)" opacity={0.5} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `৳${val.toLocaleString()}`}/>
                          <Tooltip
                            contentStyle={{
                              background: 'var(--color-base-200)',
                              border: '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)',
                              borderRadius: '0.75rem',
                              fontFamily: 'var(--font-sans)',
                            }}
                            labelStyle={{ fontWeight: 'bold' }}
                            formatter={(value) => [`৳${value.toLocaleString()}`, 'Total Spend']}
                          />
                          <Area type="monotone" dataKey="total_disbursed" stroke="var(--color-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#spendGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-base-content/35 font-medium">
                        No spending trend records this month.
                      </div>
                    )}
                  </div>
                </div>

                {/* Department Burn Rate utilization */}
                <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                  <div>
                    <h3 className="text-lg font-bold Outfit">Department Budget Utilization</h3>
                    <p className="text-xs text-base-content/50">Running totals of budget usage this month</p>
                  </div>
                  <div className="h-64 w-full">
                    {budgetBurnRate && budgetBurnRate.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={budgetBurnRate} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="color-mix(in oklch, var(--color-base-content) 8%, transparent)"/>
                          <XAxis type="number" stroke="var(--color-base-content)" opacity={0.5} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`}/>
                          <YAxis dataKey="department" type="category" stroke="var(--color-base-content)" opacity={0.7} fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--color-base-200)',
                              border: '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)',
                              borderRadius: '0.75rem',
                            }}
                            formatter={(value, name) => {
                              if (name === 'utilization_pct') return [`${value}%`, 'Utilization'];
                              return [`৳${value.toLocaleString()}`, name === 'spent' ? 'Spent' : 'Budget'];
                            }}
                          />
                          <Bar dataKey="utilization_pct" radius={[0, 8, 8, 0]} barSize={14}>
                            {budgetBurnRate.map((entry, index) => {
                              const orgSlug = user?.organization?.slug;
                              const utilization = entry.utilization_pct;
                              
                              let barColor;
                              if (orgSlug === 'braincount') {
                                if (utilization >= 90) barColor = '#C34994';
                                else if (utilization >= 70) barColor = '#ECC138';
                                else barColor = '#2D7ECC';
                              } else if (orgSlug === 'amaze') {
                                if (utilization >= 90) barColor = isDarkMode ? '#FAFAFA' : '#111827';
                                else if (utilization >= 70) barColor = '#7A7A7A';
                                else barColor = isDarkMode ? '#4A4A4A' : '#CCCCCC';
                              } else {
                                if (utilization >= 90) barColor = '#2D3748';
                                else if (utilization >= 70) barColor = '#4FD1C5';
                                else barColor = '#6AC98A';
                              }
                              return <Cell key={`cell-${index}`} fill={barColor} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-base-content/35 font-medium">
                        No department budget utilization logs.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Employee: Recent Petty Cash Requisitions */}
            {!isExecutive && (
              <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold Outfit">My Recent Requisitions</h3>
                    <p className="text-xs text-base-content/50">Tracking your recent petty cash requests</p>
                  </div>
                  <Link to="/petty-cash" className="btn btn-ghost btn-sm text-primary rounded-lg font-semibold gap-1 text-xs">
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {isPettyCashLoading ? (
                  <LoadingSkeleton variant="table" count={3} />
                ) : pettyCashData?.results?.length > 0 ? (
                  <div className="overflow-x-auto w-full">
                    <table className="table w-full">
                      <thead>
                        <tr className="border-b border-base-content/5">
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Title</th>
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Amount</th>
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">State</th>
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Needed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pettyCashData.results.slice(0, 4).map((req) => (
                          <tr key={req.id} className="hover:bg-base-content/2 border-b border-base-content/5 transition-colors duration-150">
                            <td className="px-2 py-4">
                              <Link to={`/petty-cash/${req.uuid}`} className="font-bold text-sm text-base-content hover:text-primary transition-colors">
                                {req.title}
                              </Link>
                              <span className="block text-[10px] text-base-content/40 mt-0.5">
                                Ref: #{req.id}
                              </span>
                            </td>
                            <td className="font-bold text-sm px-2 py-4 text-base-content">
                              ৳{parseFloat(req.amount_requested).toLocaleString()}
                            </td>
                            <td className="px-2 py-4">
                              <StatusBadge state={req.state} />
                            </td>
                            <td className="text-xs text-base-content/65 px-2 py-4">
                              {new Date(req.needed_by).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No Petty Cash Requests"
                    message="You haven't submitted any requisitions yet. Get started by raising a new requisition."
                    actionLabel="New Requisition"
                    onAction={() => (window.location.href = '/petty-cash?create=true')}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Side: Quick navigation + Balances */}
          <div className="space-y-8">
            {/* Quick Actions Panel */}
            <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-lg font-bold Outfit">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-3">
                <Link to="/petty-cash" className="btn btn-ghost bg-base-100/40 hover:bg-base-100 border border-base-content/5 hover:border-primary/20 rounded-xl justify-start gap-4 p-4 h-auto font-medium transition-all duration-200">
                  <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-base-content">Requisitions</h4>
                    <p className="text-[10px] text-base-content/40">Request petty cash disbursement</p>
                  </div>
                </Link>

                <Link to="/leave" className="btn btn-ghost bg-base-100/40 hover:bg-base-100 border border-base-content/5 hover:border-secondary/20 rounded-xl justify-start gap-4 p-4 h-auto font-medium transition-all duration-200">
                  <div className="bg-secondary/10 p-2.5 rounded-lg text-secondary">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-base-content">Leave requests</h4>
                    <p className="text-[10px] text-base-content/40">Submit and track leaves</p>
                  </div>
                </Link>

                {isManager && (
                  <Link to="/approvals" className="btn btn-ghost bg-base-100/40 hover:bg-base-100 border border-base-content/5 hover:border-accent/20 rounded-xl justify-start gap-4 p-4 h-auto font-medium transition-all duration-200">
                    <div className="bg-accent/10 p-2.5 rounded-lg text-accent">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-base-content">Approvals Desk</h4>
                      <p className="text-[10px] text-base-content/40">Approve pending applications</p>
                    </div>
                  </Link>
                )}

                {isManager && (
                  <Link to="/delegation" className="btn btn-ghost bg-base-100/40 hover:bg-base-100 border border-base-content/5 hover:border-success/20 rounded-xl justify-start gap-4 p-4 h-auto font-medium transition-all duration-200">
                    <div className="bg-success/10 p-2.5 rounded-lg text-success">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-base-content">OOO Delegation</h4>
                      <p className="text-[10px] text-base-content/40">Delegate approval permissions</p>
                    </div>
                  </Link>
                )}
              </div>
            </div>

            {/* Recent Activity Timeline Feed */}
            {['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO', 'ADMIN'].includes(role) && (
              <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold Outfit">Recent Activity</h3>
                  <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Live Feed</span>
                </div>

                {isActivitiesLoading ? (
                  <div className="space-y-3 pt-2">
                    <div className="h-10 bg-base-300/40 animate-pulse rounded-xl"></div>
                    <div className="h-10 bg-base-300/40 animate-pulse rounded-xl"></div>
                    <div className="h-10 bg-base-300/40 animate-pulse rounded-xl"></div>
                  </div>
                ) : activities?.results?.length > 0 ? (
                  <div className="flow-root pt-2">
                    <ul className="-mb-8">
                      {activities.results.slice(0, 4).map((activity, idx) => {
                        const getActionLabel = (action) => {
                          const mapping = {
                            'SUBMIT': 'submitted',
                            'TL_APPROVE': 'approved (TL)',
                            'GM_APPROVE': 'approved (GM)',
                            'CEO_DIRECT_APPROVE': 'directly approved (CEO)',
                            'APPROVE': 'approved',
                            'REJECT': 'rejected',
                            'CANCEL': 'cancelled',
                            'AMEND': 'amended',
                            'DISBURSE': 'disbursed',
                          };
                          return mapping[action] || action.toLowerCase().replace('_', ' ');
                        };
                        const actionLabel = getActionLabel(activity.action);
                        const amountOrDuration = activity.metadata?.amount_or_duration;
                        const reasonText = activity.reason ? ` - "${activity.reason}"` : '';
                        const title = activity.metadata?.title || `${activity.target_type === 'LeaveRequest' ? 'Leave' : 'Petty Cash'} Request`;
                        const message = `${activity.actor_name || activity.actor_username || 'System'} ${actionLabel}${amountOrDuration ? ` (${amountOrDuration})` : ''}${reasonText}`;

                        return (
                          <li key={activity.id}>
                            <div className="relative pb-6">
                              {idx !== activities.results.slice(0, 4).length - 1 && (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-base-content/10" aria-hidden="true" />
                              )}
                              <div className="relative flex space-x-3 items-start">
                                <div className="shrink-0">
                                  <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary ring-8 ring-base-100/10">
                                    <Clock className="w-4 h-4" />
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <p className="text-xs font-bold text-base-content leading-snug text-left">
                                    {title}
                                  </p>
                                  <p className="text-[10px] text-base-content/60 mt-0.5 leading-normal text-left">
                                    {message}
                                  </p>
                                  <span className="text-[8px] text-base-content/40 block mt-1 font-semibold uppercase tracking-wider text-left">
                                    {new Date(activity.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-base-content/35 font-semibold">
                    No recent activities or updates.
                  </div>
                )}
              </div>
            )}

            {/* Leave Balances Panel (for employee view) */}
            {!isExecutive && (
              <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold Outfit">My Leave Balances</h3>
                  <p className="text-xs text-base-content/50">Available balances for {new Date().getFullYear()}</p>
                </div>

                {isLeaveBalancesLoading ? (
                  <LoadingSkeleton variant="table" count={3} />
                ) : leaveBalances && leaveBalances.length > 0 ? (
                  <div className="space-y-4">
                    {leaveBalances.map((bal) => (
                      <div key={bal.id} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-base-content/85">{bal.leave_type_details.name}</span>
                          <span className="text-primary font-bold">{bal.available} / {bal.total_allocated} Days</span>
                        </div>
                        <progress
                          className="progress progress-primary w-full h-2 rounded-full"
                          value={parseFloat(bal.total_allocated) - parseFloat(bal.available)}
                          max={parseFloat(bal.total_allocated)}
                        ></progress>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-base-content/35 font-medium border border-dashed border-base-content/10 rounded-xl">
                    <AlertCircle className="w-5 h-5 mb-2 text-base-content/25" />
                    No leave balances allocated for this year.
                  </div>
                )}
              </div>
            )}

            {/* Department Budget summary (for employees and TLs) */}
            {!isExecutive && user?.profile?.department && (
              <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center gap-3">
                  <div className="bg-success/10 p-2.5 rounded-lg text-success">
                    <PiggyBank className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold Outfit">Department Budget</h3>
                    <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-wider">
                      {user.profile.department.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-base-content/60">Monthly Budget</span>
                    <span className="text-base-content">৳{deptBudget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-base-content/60">Spent This Month</span>
                    <span className="text-base-content/95 font-bold">
                      ৳{parseFloat(user.profile.department.budget_spent_this_month || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-base-content/60">Remaining Budget</span>
                    <span className="text-success font-bold">
                      ৳{(deptBudget - parseFloat(user.profile.department.budget_spent_this_month || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default DashboardPage;
