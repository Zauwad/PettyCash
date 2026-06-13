import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { exportToExcel } from '../utils/exportToExcel';
import {
  BarChart3,
  TrendingUp,
  Download,
  CalendarRange,
  DollarSign,
  Users,
  FileSpreadsheet,
  PieChart,
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
  Legend,
} from 'recharts';

export function MonthlyReportPage() {
  const [isExporting, setIsExporting] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['analytics-monthly-report'],
    queryFn: () => analyticsApi.getMonthlyReport(),
  });

  const listRef = useGSAPStagger('.report-card', [report]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const sheets = [];
      if (report?.petty_cash_summary) sheets.push({ name: 'Petty Cash Summary', data: report.petty_cash_summary });
      if (report?.department_breakdown) sheets.push({ name: 'Department Breakdown', data: report.department_breakdown });
      if (report?.leave_summary) sheets.push({ name: 'Leave Summary', data: report.leave_summary });
      if (report?.weekly_trend) sheets.push({ name: 'Weekly Trend', data: report.weekly_trend });
      exportToExcel(sheets, `Monthly_Report_${new Date().toISOString().split('T')[0]}`);
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
              <div className="bg-secondary/10 p-2 rounded-xl text-secondary">
                <CalendarRange className="w-5 h-5" />
              </div>
              <h2 className="text-3xl font-extrabold Outfit tracking-tight">Monthly Report</h2>
            </div>
            <p className="text-sm text-base-content/55 ml-14">
              Full month performance — petty cash trends, department utilization, and leave statistics.
            </p>
          </div>
          <button
            id="monthly-export-btn"
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="btn btn-secondary btn-sm gap-2 rounded-xl font-semibold shadow-lg shadow-secondary/20 hover:shadow-secondary/30 transition-all"
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
              <KpiCard label="Total Disbursed" value={`৳${parseFloat(report?.totals?.total_disbursed || 0).toLocaleString()}`} subLabel="This month" icon={DollarSign} color="text-primary" bg="bg-primary/10" />
              <KpiCard label="Total Vouchers" value={report?.totals?.total_vouchers || 0} subLabel="All statuses" icon={BarChart3} color="text-secondary" bg="bg-secondary/10" />
              <KpiCard label="Leave Requests" value={report?.totals?.total_leaves || 0} subLabel="This month" icon={Users} color="text-accent" bg="bg-accent/10" />
              <KpiCard label="Approval Rate" value={`${report?.totals?.approval_rate || 0}%`} subLabel="Approved requests" icon={TrendingUp} color="text-success" bg="bg-success/10" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Weekly Trend Chart (spans 2 cols) */}
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold Outfit">Weekly Petty Cash Trend</h3>
                    <p className="text-xs text-base-content/50">Week-by-week spending breakdown</p>
                  </div>
                  <span className="text-xs font-bold text-secondary flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" /> This Month
                  </span>
                </div>
                <div className="h-64">
                  {report?.weekly_trend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={report.weekly_trend} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                        <defs>
                          <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in oklch, var(--color-base-content) 8%, transparent)" />
                        <XAxis dataKey="week" stroke="var(--color-base-content)" opacity={0.5} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-base-content)" opacity={0.5} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: 'var(--color-base-200)', border: '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)', borderRadius: '0.75rem' }}
                          formatter={(v) => [`৳${parseFloat(v).toLocaleString()}`, 'Disbursed']}
                        />
                        <Area type="monotone" dataKey="amount" stroke="var(--color-secondary)" strokeWidth={2.5} fillOpacity={1} fill="url(#monthlyGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState />
                  )}
                </div>
              </div>

              {/* Department Burn Rate */}
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Dept. Utilization</h3>
                  <p className="text-xs text-base-content/50">Budget burn this month</p>
                </div>
                {report?.department_breakdown?.length > 0 ? (
                  <div className="space-y-3 overflow-y-auto max-h-64 pr-1">
                    {report.department_breakdown.map((dept, i) => {
                      const pct = Math.min(parseFloat(dept.pct || 0), 100);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold truncate max-w-[65%]">{dept.department}</span>
                            <span className={`font-black ${pct >= 90 ? 'text-error' : pct >= 70 ? 'text-warning' : 'text-success'}`}>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-base-content/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${pct >= 90 ? 'bg-error' : pct >= 70 ? 'bg-warning' : 'bg-success'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                    No department data.
                  </div>
                )}
              </div>
            </div>

            {/* Leave Summary Table */}
            {report?.leave_summary?.length > 0 && (
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Monthly Leave Summary</h3>
                  <p className="text-xs text-base-content/50">All leave requests for this month</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table w-full text-sm">
                    <thead>
                      <tr className="border-b border-base-content/5">
                        {['Employee', 'Type', 'Status', 'Days', 'Start', 'End'].map((h) => (
                          <th key={h} className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.leave_summary.map((row, i) => (
                        <tr key={i} className="hover:bg-base-content/2 border-b border-base-content/5 transition-colors">
                          <td className="px-2 py-3 font-semibold">{row.employee}</td>
                          <td className="px-2 py-3 text-base-content/70">{row.leave_type}</td>
                          <td className="px-2 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              row.status === 'approved' ? 'bg-success/15 text-success' :
                              row.status === 'rejected' ? 'bg-error/15 text-error' :
                              'bg-warning/15 text-warning'
                            }`}>{row.status}</span>
                          </td>
                          <td className="px-2 py-3 font-bold">{row.days}</td>
                          <td className="px-2 py-3 text-base-content/60 text-xs">{row.start_date}</td>
                          <td className="px-2 py-3 text-base-content/60 text-xs">{row.end_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 text-base-content/40">
            <CalendarRange className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No data available for this month.</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="skeleton h-80 rounded-3xl lg:col-span-2" />
        <div className="skeleton h-80 rounded-3xl" />
      </div>
    </div>
  );
}

export default MonthlyReportPage;
