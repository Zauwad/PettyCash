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
  Calendar,
  DollarSign,
  Users,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';

export function WeeklyReportPage() {
  const [isExporting, setIsExporting] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['analytics-weekly-report'],
    queryFn: () => analyticsApi.getWeeklyReport(),
  });

  const listRef = useGSAPStagger('.report-card', [report]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const sheets = [];

      if (report?.petty_cash_summary) {
        sheets.push({
          name: 'Petty Cash Summary',
          data: report.petty_cash_summary,
        });
      }
      if (report?.department_breakdown) {
        sheets.push({
          name: 'Department Breakdown',
          data: report.department_breakdown,
        });
      }
      if (report?.leave_summary) {
        sheets.push({
          name: 'Leave Summary',
          data: report.leave_summary,
        });
      }

      exportToExcel(sheets, `Weekly_Report_${new Date().toISOString().split('T')[0]}`);
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
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              <h2 className="text-3xl font-extrabold Outfit tracking-tight">Weekly Report</h2>
            </div>
            <p className="text-sm text-base-content/55 ml-14">
              Current week's operational summary — petty cash, leaves, and department activity.
            </p>
          </div>
          <button
            id="weekly-export-btn"
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="btn btn-primary btn-sm gap-2 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
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
              <KpiCard
                label="Total Disbursed"
                value={`৳${parseFloat(report?.totals?.total_disbursed || 0).toLocaleString()}`}
                subLabel="This week"
                icon={DollarSign}
                color="text-primary"
                bg="bg-primary/10"
              />
              <KpiCard
                label="Vouchers Submitted"
                value={report?.totals?.total_vouchers || 0}
                subLabel="All statuses"
                icon={BarChart3}
                color="text-secondary"
                bg="bg-secondary/10"
              />
              <KpiCard
                label="Leave Requests"
                value={report?.totals?.total_leaves || 0}
                subLabel="New this week"
                icon={Users}
                color="text-accent"
                bg="bg-accent/10"
              />
              <KpiCard
                label="Pending Approvals"
                value={report?.totals?.pending_approvals || 0}
                subLabel="Awaiting action"
                icon={TrendingUp}
                color="text-warning"
                bg="bg-warning/10"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily Disbursement Chart */}
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Daily Petty Cash Disbursements</h3>
                  <p className="text-xs text-base-content/50">Amounts disbursed per day this week</p>
                </div>
                <div className="h-56">
                  {report?.daily_disbursements?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.daily_disbursements} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in oklch, var(--color-base-content) 8%, transparent)" />
                        <XAxis dataKey="day" stroke="var(--color-base-content)" opacity={0.5} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-base-content)" opacity={0.5} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: 'var(--color-base-200)', border: '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)', borderRadius: '0.75rem' }}
                          formatter={(v) => [`৳${parseFloat(v).toLocaleString()}`, 'Disbursed']}
                        />
                        <Bar dataKey="amount" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState />
                  )}
                </div>
              </div>

              {/* Department Breakdown */}
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Department Breakdown</h3>
                  <p className="text-xs text-base-content/50">Spending distribution this week</p>
                </div>
                {report?.department_breakdown?.length > 0 ? (
                  <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
                    {report.department_breakdown.map((dept, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-base-content truncate max-w-[55%]">{dept.department}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-base-content/10 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(dept.pct || 0, 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-xs w-16 text-right">৳{parseFloat(dept.total || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                    No department data available.
                  </div>
                )}
              </div>
            </div>

            {/* Leave Table */}
            {report?.leave_summary?.length > 0 && (
              <div className="report-card glass-panel p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Leave Requests This Week</h3>
                  <p className="text-xs text-base-content/50">All leave requests submitted in the current week</p>
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
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No data available for this week.</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="skeleton h-72 rounded-3xl" />
        <div className="skeleton h-72 rounded-3xl" />
      </div>
    </div>
  );
}

export default WeeklyReportPage;
