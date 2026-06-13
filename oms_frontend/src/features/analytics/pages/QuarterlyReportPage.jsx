import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { exportToExcel } from '../utils/exportToExcel';
import {
  BarChart3,
  TrendingUp,
  CalendarDays,
  DollarSign,
  Users,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function QuarterlyReportPage() {
  const [isExporting, setIsExporting] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['analytics-quarterly-report'],
    queryFn: () => analyticsApi.getQuarterlyReport(),
  });

  const listRef = useGSAPStagger('.report-card', [report]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const sheets = [];
      if (report?.petty_cash_summary) sheets.push({ name: 'Petty Cash Summary', data: report.petty_cash_summary });
      if (report?.monthly_breakdown) sheets.push({ name: 'Monthly Breakdown', data: report.monthly_breakdown });
      if (report?.department_breakdown) sheets.push({ name: 'Department Breakdown', data: report.department_breakdown });
      if (report?.leave_summary) sheets.push({ name: 'Leave Summary', data: report.leave_summary });
      if (report?.top_requesters) sheets.push({ name: 'Top Requesters', data: report.top_requesters });
      exportToExcel(sheets, `Quarterly_Report_${new Date().toISOString().split('T')[0]}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageTransition>
      <div ref={listRef} className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-base-content/5 pb-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="bg-accent/10 p-2 rounded-xl text-accent">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-3xl font-extrabold Outfit tracking-tight">Quarterly Report</h2>
            </div>
            <p className="text-sm text-base-content/55 ml-14">
              Quarter-wide executive summary — trends, top departments, and strategic insights.
            </p>
          </div>
          <button
            id="quarterly-export-btn"
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="btn btn-accent btn-sm gap-2 rounded-xl font-semibold shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all"
          >
            {isExporting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Export Excel
          </button>
        </div>

        {isLoading ? (
          <ReportSkeleton />
        ) : report ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Disbursed" value={`৳${parseFloat(report?.totals?.total_disbursed || 0).toLocaleString()}`} subLabel="This quarter" icon={DollarSign} color="text-primary" bg="bg-primary/10" />
              <KpiCard label="Total Vouchers" value={report?.totals?.total_vouchers || 0} subLabel="All statuses" icon={BarChart3} color="text-accent" bg="bg-accent/10" />
              <KpiCard label="Leave Requests" value={report?.totals?.total_leaves || 0} subLabel="This quarter" icon={Users} color="text-secondary" bg="bg-secondary/10" />
              <KpiCard label="Approval Rate" value={`${report?.totals?.approval_rate || 0}%`} subLabel="Approved requests" icon={TrendingUp} color="text-success" bg="bg-success/10" />
            </div>

            {/* Monthly Trend (full width) */}
            <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold Outfit">Month-by-Month Disbursements</h3>
                  <p className="text-xs text-base-content/50">Petty cash spending across the 3 months of this quarter</p>
                </div>
                <span className="text-xs font-bold text-accent flex items-center gap-1">
                  <Activity className="w-4 h-4" /> Q{Math.ceil((new Date().getMonth() + 1) / 3)} {new Date().getFullYear()}
                </span>
              </div>
              <div className="h-72">
                {report?.monthly_breakdown?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.monthly_breakdown} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="quarterlyBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in oklch, var(--color-base-content) 8%, transparent)" />
                      <XAxis dataKey="month" stroke="var(--color-base-content)" opacity={0.5} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-base-content)" opacity={0.5} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-base-200)', border: '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)', borderRadius: '0.75rem' }}
                        formatter={(v) => [`৳${parseFloat(v).toLocaleString()}`, 'Disbursed']}
                      />
                      <Bar dataKey="amount" fill="url(#quarterlyBarGrad)" radius={[8, 8, 0, 0]} maxBarSize={80} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Department Breakdown */}
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Department Breakdown</h3>
                  <p className="text-xs text-base-content/50">Spending by department this quarter</p>
                </div>
                {report?.department_breakdown?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table w-full text-sm">
                      <thead>
                        <tr className="border-b border-base-content/5">
                          {['Department', 'Spent', 'Budget', 'Usage'].map((h) => (
                            <th key={h} className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.department_breakdown.map((dept, i) => {
                          const pct = parseFloat(dept.pct || 0);
                          return (
                            <tr key={i} className="hover:bg-base-content/2 border-b border-base-content/5 transition-colors">
                              <td className="px-2 py-3 font-semibold text-sm">{dept.department}</td>
                              <td className="px-2 py-3 font-bold">৳{parseFloat(dept.total || 0).toLocaleString()}</td>
                              <td className="px-2 py-3 text-base-content/60 text-xs">৳{parseFloat(dept.budget || 0).toLocaleString()}</td>
                              <td className="px-2 py-3">
                                <span className={`text-xs font-black ${pct >= 90 ? 'text-error' : pct >= 70 ? 'text-warning' : 'text-success'}`}>
                                  {pct.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                    No department data.
                  </div>
                )}
              </div>

              {/* Top Requesters */}
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Top Petty Cash Requesters</h3>
                  <p className="text-xs text-base-content/50">Highest spenders this quarter</p>
                </div>
                {report?.top_requesters?.length > 0 ? (
                  <div className="space-y-3">
                    {report.top_requesters.map((person, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-base-300/30 rounded-2xl border border-base-content/5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent font-black text-sm shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{person.name}</p>
                          <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-wider">{person.department}</p>
                        </div>
                        <span className="font-black text-sm text-accent shrink-0">৳{parseFloat(person.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                    No requester data.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-base-content/40">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No data available for this quarter.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function KpiCard({ label, value, subLabel, icon: Icon, color, bg }) {
  return (
    <div className="report-card glass-panel p-5 rounded-2xl shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">{label}</p>
        <div className={`${bg} ${color} p-2 rounded-lg`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl font-black Outfit ${color}`}>{value}</p>
      <p className="text-[10px] text-base-content/40 font-semibold uppercase tracking-wider">{subLabel}</p>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-full flex items-center justify-center text-xs text-base-content/35 font-medium border border-dashed border-base-content/10 rounded-2xl">
      No data for this period.
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="skeleton h-80 w-full rounded-3xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    </div>
  );
}

export default QuarterlyReportPage;
