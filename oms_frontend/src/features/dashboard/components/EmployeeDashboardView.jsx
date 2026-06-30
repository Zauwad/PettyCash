import { Link } from 'react-router-dom';
import { 
  Wallet, 
  CalendarDays, 
  CheckSquare, 
  PlusCircle, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  Users, 
  Building, 
  PiggyBank, 
  AlertCircle 
} from 'lucide-react';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { EmptyState } from '@/shared/components/ui/EmptyState';

export function EmployeeDashboardView({
  user,
  isExecutive,
  isManagerOrExec,
  isPettyCashLoading,
  isLeaveRequestsLoading,
  isLeaveBalancesLoading,
  isUpcomingAbsencesLoading,
  isActivitiesLoading,
  isFetchingNextPage,
  pettyCashData,
  leaveRequests,
  leaveBalances,
  upcomingAbsences,
  allActivities,
  personalPettyCashSpentRef,
  personalPettyCashCountRef,
  activeLeavesCountRef,
  tlLimit,
  deptBudget,
  handleScroll
}) {
  return (
    <>
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
      {isManagerOrExec ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: Recent Activity */}
            <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-3 border-b border-base-content/5 shrink-0">
                <h3 className="text-lg font-bold Outfit">Recent Activity</h3>
                <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Live Feed</span>
              </div>

              {isActivitiesLoading ? (
                <div className="space-y-3 pt-4 flex-1">
                  <div className="h-10 bg-base-300/40 animate-pulse rounded-xl"></div>
                  <div className="h-10 bg-base-300/40 animate-pulse rounded-xl"></div>
                  <div className="h-10 bg-base-300/40 animate-pulse rounded-xl"></div>
                </div>
              ) : allActivities.length > 0 ? (
                <div 
                  onScroll={handleScroll}
                  className="flow-root pt-2 flex-1 overflow-y-auto pr-2 scrollbar-thin mt-4"
                >
                  <ul className="mb-4">
                    {allActivities.map((activity, idx) => {
                      const getActionLabel = (action) => {
                        const mapping = {
                          'CREATED': 'created',
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
                            {idx !== allActivities.length - 1 && (
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
                                <p className="text-[10px] text-base-content/65 mt-0.5 leading-normal text-left">
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
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-2">
                      <span className="loading loading-spinner loading-sm text-secondary"></span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-base-content/35 font-semibold flex-1 flex items-center justify-center">
                  No activities recorded.
                </div>
              )}
            </div>

            {/* Column 2: Upcoming Leaves */}
            <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl flex flex-col h-[520px]">
              <div className="flex items-center gap-3 border-b border-base-content/5 pb-3 shrink-0">
                <div className="bg-secondary/10 p-2.5 rounded-lg text-secondary">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold Outfit">Upcoming Leaves</h3>
                  <p className="text-[10px] text-base-content/40 uppercase font-black tracking-wider">Next 30 Days</p>
                </div>
              </div>

              {isUpcomingAbsencesLoading ? (
                <div className="space-y-3 pt-4 flex-1">
                  <div className="h-12 bg-base-300/40 animate-pulse rounded-xl"></div>
                  <div className="h-12 bg-base-300/40 animate-pulse rounded-xl"></div>
                </div>
              ) : upcomingAbsences && upcomingAbsences.length > 0 ? (
                <div className="pt-2 flex-1 overflow-y-auto pr-1 scrollbar-thin mt-4 space-y-3">
                  {upcomingAbsences.map((abs) => {
                    const userDetails = abs.requester_details;
                    const deptName = userDetails?.profile?.department?.name || 'Central Office';
                    return (
                      <div key={abs.id} className="p-3 bg-base-300/30 rounded-xl border border-base-content/5 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-base-content">
                              {userDetails?.first_name ? `${userDetails.first_name} ${userDetails.last_name || ''}` : userDetails?.username}
                            </h4>
                            <span className="block text-[9px] text-base-content/40 font-bold uppercase mt-0.5">
                              {deptName} · {abs.leave_type_name}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded">
                            {abs.working_days_requested} Days
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-base-content/50 font-medium">
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
                <div className="text-center py-12 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium flex-1 flex items-center justify-center mt-4">
                  No approved absences in the next 30 days.
                </div>
              )}
            </div>

            {/* Column 3: Payment Status */}
            <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl flex flex-col h-[520px]">
              <div className="flex items-center gap-3 border-b border-base-content/5 pb-3 shrink-0">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold Outfit">Payment Status</h3>
                  <p className="text-[10px] text-base-content/40 uppercase font-black tracking-wider">Recent Requisitions</p>
                </div>
              </div>

              {isPettyCashLoading ? (
                <div className="space-y-3 pt-4 flex-1">
                  <div className="h-12 bg-base-300/40 animate-pulse rounded-xl"></div>
                  <div className="h-12 bg-base-300/40 animate-pulse rounded-xl"></div>
                </div>
              ) : pettyCashData?.results?.length > 0 ? (
                <div className="pt-2 flex-1 overflow-y-auto pr-1 scrollbar-thin mt-4 space-y-3">
                  {pettyCashData.results.slice(0, 5).map((req) => (
                    <div key={req.id} className="p-3 bg-base-300/30 rounded-xl border border-base-content/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1 pr-2">
                          <Link to={`/petty-cash/${req.uuid}`} className="font-bold text-xs text-base-content hover:text-primary transition-colors block truncate">
                            {req.title}
                          </Link>
                          <span className="block text-[9px] text-base-content/40 font-bold uppercase mt-0.5">
                            By {req.requester_name || req.requester_username} · Dept: {req.department_name}
                          </span>
                        </div>
                        <span className="text-xs font-black text-base-content shrink-0">
                          ৳{parseFloat(req.amount_requested).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-base-content/50">
                        <span>Needed: {new Date(req.needed_by).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <StatusBadge state={req.state} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium flex-1 flex items-center justify-center mt-4">
                  No requisitions found.
                </div>
              )}
            </div>
          </div>

          {/* Department Budget summary */}
          {user?.profile?.department && (
            <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl relative overflow-hidden border-l-4 border-success">
              <div className="absolute top-0 right-0 w-64 h-64 bg-success/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-success/10 p-2.5 rounded-lg text-success">
                    <PiggyBank className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold Outfit">Department Budget Summary</h3>
                    <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider">
                      {user.profile.department.name} Department
                    </p>
                  </div>
                </div>

                <div className="flex gap-8 flex-wrap items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-base-content/45 font-bold uppercase tracking-wider">Monthly Budget</span>
                    <p className="text-lg font-extrabold Outfit text-base-content">৳{deptBudget.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-base-content/45 font-bold uppercase tracking-wider">Spent This Month</span>
                    <p className="text-lg font-extrabold Outfit text-base-content/90">৳{parseFloat(user.profile.department.budget_spent_this_month || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-base-content/45 font-bold uppercase tracking-wider">Remaining Budget</span>
                    <p className="text-lg font-extrabold Outfit text-success">৳{(deptBudget - parseFloat(user.profile.department.budget_spent_this_month || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 cols wide): My Recent Requisitions */}
          <div className="lg:col-span-2 space-y-8">
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
          </div>

          {/* Right Column (1 col wide): Department Budget or Leave Balances */}
          <div className="space-y-8">
            {user?.profile?.department && user?.profile?.role !== 'EMPLOYEE' && (
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

            {user?.profile?.role === 'EMPLOYEE' && leaveBalances && leaveBalances.length > 0 && (
              <div className="stagger-card glass-panel p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold Outfit">My Leave Balances</h3>
                    <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-wider">
                      Year {new Date().getFullYear()}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  {leaveBalances
                    .filter(b => {
                      const allocated = parseFloat(b.total_allocated);
                      if (allocated <= 0) return false;
                      if (user?.profile?.role === 'EMPLOYEE') {
                        const code = b.leave_type_details?.code ? b.leave_type_details.code.toUpperCase() : '';
                        return code !== 'MATERNITY' && code !== 'PATERNITY';
                      }
                      return true;
                    })
                    .map((bal) => {
                      const allocated = parseFloat(bal.total_allocated);
                      const available = parseFloat(bal.available);
                      const used = parseFloat(bal.used);
                      const percentage = allocated > 0 ? (available / allocated) * 100 : 0;
                      return (
                        <div key={bal.id} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-base-content/70">{bal.leave_type_details.name}</span>
                            <span className="text-base-content font-bold">
                              {available} / {allocated} Days Left
                            </span>
                          </div>
                          <div className="w-full bg-base-content/5 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                bal.leave_type_details.code === 'ANNUAL' 
                                  ? 'bg-primary' 
                                  : bal.leave_type_details.code === 'SICK'
                                  ? 'bg-secondary'
                                  : 'bg-accent'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                            ></div>
                          </div>
                          {used > 0 && (
                            <span className="text-[9px] text-base-content/40 block text-right font-medium">
                              {used} days taken
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
export default EmployeeDashboardView;
