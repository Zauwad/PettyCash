import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  PiggyBank, 
  Calendar, 
  AlertCircle,
  Building,
  ArrowRight
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
  Cell,
  Legend
} from 'recharts';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';

export function AnalyticsDashboardPage() {
  const { user } = useAuth();
  
  // Queries
  const { data: spendingTrends, isLoading: isTrendsLoading } = useQuery({
    queryKey: ['deep-spending-trends'],
    queryFn: () => analyticsApi.getSpendingTrends(),
  });

  const { data: budgetBurnRate, isLoading: isBurnLoading } = useQuery({
    queryKey: ['deep-burn-rate'],
    queryFn: () => analyticsApi.getBudgetBurnRate(),
  });

  const { data: absences, isLoading: isAbsencesLoading } = useQuery({
    queryKey: ['deep-absences'],
    queryFn: () => analyticsApi.getUpcomingAbsences(),
  });

  const listRef = useGSAPStagger('.analytics-card', [spendingTrends, budgetBurnRate, absences]);

  const isLoading = isTrendsLoading || isBurnLoading || isAbsencesLoading;

  return (
    <PageTransition>
      <div ref={listRef} className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-base-content/5 pb-5">
          <h2 className="text-3xl font-extrabold Outfit tracking-tight">Executive Analytics</h2>
          <p className="text-sm text-base-content/55">Scrutinize business spent trends and upcoming resource allocations.</p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 skeleton h-80 rounded-3xl"></div>
              <div className="skeleton h-80 rounded-3xl"></div>
            </div>
            <div className="skeleton h-64 w-full rounded-3xl"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle: Recharts spending trends & Burn Rates */}
            <div className="lg:col-span-2 space-y-8">
              {/* Area Chart: Spending Trends */}
              <div className="analytics-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold Outfit">Historical Petty Cash Disbursements</h3>
                    <p className="text-xs text-base-content/50">Disbursed voucher totals by calendar month</p>
                  </div>
                  <span className="text-xs font-bold text-primary flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Last 12 Months
                  </span>
                </div>

                <div className="h-72 w-full pt-4">
                  {spendingTrends && spendingTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={spendingTrends} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spendTrendsGrad" x1="0" y1="0" x2="0" y2="1">
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
                          formatter={(value) => [`৳${value.toLocaleString()}`, 'Spent Total']}
                        />
                        <Area type="monotone" dataKey="total_disbursed" stroke="var(--color-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#spendTrendsGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-base-content/35 font-medium">
                      No spending records found for this period.
                    </div>
                  )}
                </div>
              </div>

              {/* Department Burn Rate Utilisation Detail */}
              <div className="analytics-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold Outfit">Departmental Spending Utilization</h3>
                  <p className="text-xs text-base-content/50">Details of budget expenditure limits this month</p>
                </div>

                {budgetBurnRate && budgetBurnRate.length > 0 ? (
                  <div className="overflow-x-auto w-full">
                    <table className="table w-full">
                      <thead>
                        <tr className="border-b border-base-content/5">
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Department</th>
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Spent</th>
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Limit</th>
                          <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Usage %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetBurnRate.map((dept, index) => {
                          const utilization = parseFloat(dept.utilization_pct);
                          
                          return (
                            <tr key={index} className="hover:bg-base-content/2 border-b border-base-content/5 transition-colors duration-150">
                              <td className="px-2 py-4 font-bold text-sm text-base-content">{dept.department}</td>
                              <td className="px-2 py-4 text-sm font-semibold">৳{parseFloat(dept.spent).toLocaleString()}</td>
                              <td className="px-2 py-4 text-xs text-base-content/60">৳{parseFloat(dept.budget).toLocaleString()}</td>
                              <td className="px-2 py-4">
                                <div className="flex items-center gap-3">
                                  <progress
                                    className={`progress w-24 h-2 rounded-full ${
                                      utilization >= 90
                                        ? 'progress-error'
                                        : utilization >= 70
                                        ? 'progress-warning'
                                        : 'progress-success'
                                    }`}
                                    value={utilization}
                                    max={100}
                                  ></progress>
                                  <span className={`text-xs font-black ${
                                    utilization >= 90
                                      ? 'text-error'
                                      : utilization >= 70
                                      ? 'text-warning'
                                      : 'text-success'
                                  }`}>
                                    {utilization}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                    No department spending data.
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Upcoming Absences */}
            <div className="space-y-6">
              {/* Upcoming Absences Card */}
              <div className="analytics-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-secondary/10 p-2.5 rounded-lg text-secondary">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold Outfit">Absences (Next 30 Days)</h3>
                    <p className="text-[10px] text-base-content/40 uppercase font-black tracking-wider">Approved Leave schedules</p>
                  </div>
                </div>

                {absences && absences.length > 0 ? (
                  <div className="space-y-4 text-xs pt-2">
                    {absences.map((abs) => {
                      const userDetails = abs.requester_details;
                      const deptName = userDetails?.profile?.department?.name || 'Central Office';
                      
                      return (
                        <div key={abs.id} className="p-3 bg-base-300/30 rounded-2xl border border-base-content/5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-base-content">
                                {userDetails?.first_name ? `${userDetails.first_name} ${userDetails.last_name || ''}` : userDetails?.username}
                              </h4>
                              <span className="block text-[10px] text-base-content/40 font-bold uppercase mt-0.5">
                                {deptName} · {abs.leave_type_name}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded">
                              {abs.working_days_requested} Days
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-base-content/50 font-medium">
                            <span className="font-semibold text-base-content/70">
                              {new Date(abs.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <ArrowRight className="w-3 h-3 mx-0.5 text-base-content/30" />
                            <span className="font-semibold text-base-content/70">
                              {new Date(abs.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                    No approved absences in the next 30 days.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default AnalyticsDashboardPage;
