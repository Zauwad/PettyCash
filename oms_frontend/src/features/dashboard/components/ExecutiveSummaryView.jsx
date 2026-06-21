import { Wallet, CheckSquare, Users, TrendingUp } from 'lucide-react';

export function ExecutiveSummaryView({
  isSummaryLoading,
  monthlySpendRef,
  pendingApprovalsRef,
  employeesOnLeaveRef,
  totalRequestsRef
}) {
  return (
    <>
      {/* Executive Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stagger-card glass-panel rounded-2xl p-6 shadow-lg flex items-center gap-5 border-l-4 border-primary">
          <div className="bg-primary/10 p-4 rounded-xl text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Company Spend (Month)</p>
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
            <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Company Pending Approvals</p>
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
            <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Employees Out on Leave</p>
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
            <p className="text-xs text-base-content/55 font-bold uppercase tracking-wider">Company Total Requests</p>
            {isSummaryLoading ? (
              <div className="h-8 w-24 skeleton rounded"></div>
            ) : (
              <h3 ref={totalRequestsRef} className="text-2xl font-extrabold Outfit">0</h3>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
export default ExecutiveSummaryView;

