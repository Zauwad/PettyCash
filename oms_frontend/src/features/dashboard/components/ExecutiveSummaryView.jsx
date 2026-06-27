import { Wallet, CheckSquare, Users, TrendingUp } from 'lucide-react';
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

export function ExecutiveSummaryView({
  user,
  isDarkMode,
  isSummaryLoading,
  spendingTrends,
  budgetBurnRate,
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

      {/* Executive Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 stagger-card">
        {/* Spend Trend Chart */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
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
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
          <div>
            <h3 className="text-lg font-bold Outfit">Department Budget Utilization</h3>
            <p className="text-xs text-base-content/50">Running totals of active cycle budget usage</p>
          </div>
          <div className="h-72 w-full">
            {budgetBurnRate && budgetBurnRate.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetBurnRate} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="color-mix(in oklch, var(--color-base-content) 8%, transparent)"/>
                  <XAxis 
                    type="number" 
                    stroke="var(--color-base-content)" 
                    opacity={0.5} 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `${val}%`}
                    domain={[0, (dataMax) => Math.max(100, dataMax)]}
                  />
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
      </div>
    </>
  );
}
export default ExecutiveSummaryView;

