import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../api/leaveApi';
import axiosInstance from '@/shared/lib/axios';
import { SearchInput } from '@/shared/components/ui/SearchInput';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Plus, 
  ArrowLeft, 
  Calendar, 
  User, 
  Briefcase, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  Info,
  Clock,
  ArrowRight,
  Share2,
  CalendarDays
} from 'lucide-react';

const leaveRequestSchema = z.object({
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  is_half_day: z.boolean().default(false),
  half_day_period: z.enum(['MORNING', 'AFTERNOON']).optional(),
  delegate_to_id: z.string().optional().nullable(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
}).refine(data => {
  if (data.is_half_day) {
    return data.start_date === data.end_date;
  }
  return true;
}, {
  message: "Start and End dates must be identical for half-day requests.",
  path: ["end_date"]
}).refine(data => {
  if (data.is_half_day && !data.half_day_period) {
    return false;
  }
  return true;
}, {
  message: "Half-day period (MORNING/AFTERNOON) is required.",
  path: ["half_day_period"]
});

export function LeaveListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('state') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const searchVal = searchParams.get('search') || '';

  const [view, setView] = useState(searchParams.get('create') === 'true' ? 'create' : 'list');
  const [workingDays, setWorkingDays] = useState(0);
  const [isCalculatingDays, setIsCalculatingDays] = useState(false);

  // Filter parameters
  const filterParams = { page };
  if (activeTab !== 'all') filterParams.state = activeTab;
  if (searchVal) filterParams.search = searchVal;

  // Query: Leave requests list
  const { data: requests, isLoading, isError } = useQuery({
    queryKey: ['leave-requests-list', filterParams],
    queryFn: () => leaveApi.listRequests(filterParams),
  });

  // Query: Leave Balances
  const { data: balances, isLoading: isBalancesLoading } = useQuery({
    queryKey: ['leave-balances-list'],
    queryFn: () => leaveApi.listBalances({ year: new Date().getFullYear() }),
  });

  // Query: Leave Types configurations
  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types-config'],
    queryFn: () => leaveApi.listTypes({ is_active: true }),
  });

  // Query: Peer Users in same organization (for delegation backup)
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues-list'],
    queryFn: async () => {
      const res = await axiosInstance.get('/api/users/');
      // Exclude self from potential delegates
      return res.data?.results?.filter(u => u.email !== user.email) || [];
    },
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leave_type_id: '',
      start_date: '',
      end_date: '',
      is_half_day: false,
      half_day_period: undefined,
      delegate_to_id: '',
      reason: '',
    },
  });

  const watchedStartDate = watch('start_date');
  const watchedEndDate = watch('end_date');
  const watchedIsHalfDay = watch('is_half_day');

  // Trigger working days calculation
  useEffect(() => {
    async function calculate() {
      if (watchedIsHalfDay) {
        setWorkingDays(0.5);
        return;
      }

      if (!watchedStartDate || !watchedEndDate) {
        setWorkingDays(0);
        return;
      }

      if (watchedStartDate > watchedEndDate) {
        setWorkingDays(0);
        return;
      }

      setIsCalculatingDays(true);
      try {
        const res = await leaveApi.calculateDays(watchedStartDate, watchedEndDate);
        setWorkingDays(res.working_days);
      } catch (err) {
        setWorkingDays(0);
      } finally {
        setIsCalculatingDays(false);
      }
    }

    calculate();
  }, [watchedStartDate, watchedEndDate, watchedIsHalfDay]);

  // Force start date and end date to match if half day is checked
  useEffect(() => {
    if (watchedIsHalfDay && watchedStartDate) {
      setValue('end_date', watchedStartDate);
    }
  }, [watchedIsHalfDay, watchedStartDate, setValue]);

  // Mutation: Submit Leave Request
  const createMutation = useMutation({
    mutationFn: (data) => leaveApi.createRequest(data),
    onSuccess: async (newReq) => {
      try {
        // Submit request for approval automatically
        await leaveApi.submitRequest(newReq.uuid);
        toast.success('Leave request submitted successfully!');
      } catch (submitErr) {
        toast.warning('Leave request created as draft. Please submit it manually.');
      }
      
      reset();
      setView('list');
      setSearchParams(prev => {
        prev.delete('create');
        return prev;
      });
      queryClient.invalidateQueries({ queryKey: ['leave-requests-list'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leave-balances'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 
                  err.response?.data?.dates || 
                  err.response?.data?.balance || 
                  'Failed to create leave request.';
      toast.error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    }
  });

  // Stagger animation
  const listRef = useGSAPStagger('.leave-card', [requests?.results]);

  const handleTabChange = (state) => {
    setSearchParams((prev) => {
      if (state === 'all') prev.delete('state');
      else prev.set('state', state);
      prev.set('page', '1');
      return prev;
    });
  };

  const handleSearch = (term) => {
    setSearchParams((prev) => {
      if (!term) prev.delete('search');
      else prev.set('search', term);
      prev.set('page', '1');
      return prev;
    });
  };

  const onSubmit = (data) => {
    const payload = {
      leave_type_id: parseInt(data.leave_type_id),
      start_date: data.start_date,
      end_date: data.end_date,
      is_half_day: data.is_half_day,
      half_day_period: data.is_half_day ? data.half_day_period : null,
      delegate_to_id: data.delegate_to_id ? parseInt(data.delegate_to_id) : null,
      reason: data.reason,
    };

    createMutation.mutate(payload);
  };

  const handleCreateToggle = (shouldCreate) => {
    if (shouldCreate) {
      setView('create');
      setSearchParams(prev => {
        prev.set('create', 'true');
        return prev;
      });
    } else {
      setView('list');
      setSearchParams(prev => {
        prev.delete('create');
        return prev;
      });
      reset();
      setWorkingDays(0);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-content/5 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {view === 'create' && (
                <button 
                  onClick={() => handleCreateToggle(false)} 
                  className="btn btn-ghost btn-circle btn-sm mr-1 text-base-content"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-3xl font-extrabold Outfit tracking-tight">
                {view === 'create' ? 'Apply for Leave' : 'Leave Management'}
              </h2>
            </div>
            <p className="text-sm text-base-content/55">
              {view === 'create' 
                ? 'Submit a leave request. Working days are auto-calculated excluding weekends and holidays.' 
                : 'Track your annual, sick, and other leave balances and requests.'}
            </p>
          </div>

          <div className="flex gap-2">
            {view === 'list' && (
              <>
                <Link to="/leave/calendar" className="btn btn-ghost border border-base-content/10 rounded-xl font-bold gap-2 text-xs">
                  <CalendarDays className="w-4 h-4" />
                  Team Calendar
                </Link>
                <button 
                  onClick={() => handleCreateToggle(true)}
                  className="btn btn-secondary rounded-xl font-bold gap-2 shadow-lg shadow-secondary/20"
                >
                  <Plus className="w-5 h-5" />
                  Apply Leave
                </button>
              </>
            )}
          </div>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side: Requests queue */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <SearchInput 
                  value={searchVal}
                  onSearch={handleSearch}
                  placeholder="Search reasons, delegate names..."
                />
              </div>

              {/* Status tabs */}
              <div className="tabs tabs-box bg-base-200/50 p-1 rounded-xl max-w-fit border border-base-content/5 flex-wrap gap-1">
                {['all', 'draft', 'pending_tl_approval', 'pending_ceo_approval', 'approved', 'rejected', 'cancelled'].map((tab) => {
                  const label = tab === 'all' 
                    ? 'All' 
                    : tab === 'pending_tl_approval'
                    ? 'Lead Approval'
                    : tab === 'pending_ceo_approval'
                    ? 'CEO Approval'
                    : tab.charAt(0).toUpperCase() + tab.slice(1).replace('_', ' ');
                  
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={`tab rounded-lg text-xs font-semibold px-4 py-2 ${
                        activeTab === tab 
                          ? 'tab-active bg-secondary text-secondary-content shadow font-bold' 
                          : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Requests grid */}
              {isLoading ? (
                <LoadingSkeleton variant="table" count={3} />
              ) : isError ? (
                <div className="alert alert-error rounded-2xl flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 mt-0.5 text-error-content" />
                  <div>
                    <h4 className="font-bold text-sm">Failed to load leave requests</h4>
                    <p className="text-xs text-error-content/80 mt-1">Please check your network connection or verify your session.</p>
                  </div>
                </div>
              ) : requests?.results?.length > 0 ? (
                <div ref={listRef} className="space-y-4">
                  {requests.results.map((req) => (
                    <div 
                      key={req.id} 
                      className="leave-card glass-panel rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-base-content/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                    >
                      <div className="flex gap-4 items-start">
                        <div className="bg-secondary/10 p-3 rounded-xl text-secondary shrink-0">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 overflow-hidden">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-sm text-base-content Outfit">
                              {req.leave_type_details?.name}
                            </h4>
                            <span className="text-[10px] font-bold bg-base-300 px-2 py-0.5 rounded text-base-content/75">
                              {req.working_days_requested} working {req.working_days_requested === '1.0' || req.working_days_requested === 0.5 ? 'day' : 'days'}
                            </span>
                          </div>
                          <p className="text-xs text-base-content/70 font-semibold">
                            {new Date(req.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            {' → '}
                            {new Date(req.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            {req.is_half_day && ` (Half Day - ${req.half_day_period})`}
                          </p>
                          <p className="text-xs text-base-content/40 truncate max-w-sm">
                            {req.reason}
                          </p>
                          {req.delegate_name && (
                            <span className="flex items-center gap-1 text-[10px] text-base-content/40 font-bold uppercase mt-1">
                              <Share2 className="w-3 h-3 text-secondary" />
                              Backup: {req.delegate_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-between border-t border-base-content/5 pt-3 md:border-0 md:pt-0 shrink-0">
                        <StatusBadge state={req.state} />
                        
                        <Link 
                          to={`/leave/${req.uuid}`}
                          className="btn btn-ghost btn-circle btn-sm text-base-content/45 hover:bg-base-content/5 hover:text-secondary group-hover:translate-x-1 transition-transform"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No leave requests found"
                  message="Raise a leave application to request scheduled time off."
                  actionLabel="Apply Leave"
                  onAction={() => handleCreateToggle(true)}
                />
              )}

              {/* Pagination */}
              {requests?.count > 20 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    disabled={page === 1}
                    onClick={() => setSearchParams(prev => { prev.set('page', String(page - 1)); return prev; })}
                    className="btn btn-outline btn-sm rounded-lg border-base-content/10 text-xs"
                  >
                    Previous
                  </button>
                  <span className="self-center text-xs font-semibold text-base-content/60 px-4">
                    Page {page} of {Math.ceil(requests.count / 20)}
                  </span>
                  <button
                    disabled={page >= Math.ceil(requests.count / 20)}
                    onClick={() => setSearchParams(prev => { prev.set('page', String(page + 1)); return prev; })}
                    className="btn btn-outline btn-sm rounded-lg border-base-content/10 text-xs"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Right side: Detailed Balances */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold Outfit">My Leave Balances</h3>
                  <p className="text-xs text-base-content/50">Allocations and remaining balances for {new Date().getFullYear()}</p>
                </div>

                {isBalancesLoading ? (
                  <LoadingSkeleton variant="table" count={3} />
                ) : balances && balances.length > 0 ? (
                  <div className="space-y-5">
                    {balances.map((bal) => {
                      const avail = parseFloat(bal.available);
                      const alloc = parseFloat(bal.total_allocated);
                      const pct = Math.max(0, Math.min(100, Math.round((avail / alloc) * 100)));
                      
                      return (
                        <div key={bal.id} className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-base-content">{bal.leave_type_details?.name}</span>
                            <span className="text-secondary font-black">{bal.available} / {bal.total_allocated} Days</span>
                          </div>
                          <progress
                            className="progress progress-secondary w-full h-2 rounded-full"
                            value={alloc - avail}
                            max={alloc}
                          ></progress>
                          <div className="flex justify-between text-[9px] text-base-content/40 font-bold uppercase">
                            <span>Used: {bal.used} days</span>
                            <span>Pending: {bal.pending} days</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-6 text-xs text-base-content/35 font-medium border border-dashed border-base-content/10 rounded-xl">
                    No leave balances allocated for this year.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* APPLY LEAVE VIEW */}
        {view === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5">
                <h3 className="text-lg font-bold Outfit border-b border-base-content/5 pb-3">Leave Particulars</h3>

                <div className="space-y-4">
                  {/* Leave Type */}
                  <div>
                    <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Leave Category</label>
                    <select
                      className={`select select-bordered w-full rounded-xl bg-base-100/40 border-base-content/10 text-sm focus:bg-base-100 ${
                        errors.leave_type_id ? 'select-error' : ''
                      }`}
                      {...register('leave_type_id')}
                    >
                      <option value="">Select a category...</option>
                      {leaveTypes?.results?.map(type => (
                        <option key={type.id} value={type.id}>
                          {type.name} {type.requires_attachment ? ' (Requires Attachment)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.leave_type_id && (
                      <span className="text-xs text-error font-medium mt-1 block">{errors.leave_type_id.message}</span>
                    )}
                  </div>

                  {/* Date pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Start Date</label>
                      <input
                        type="date"
                        className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm ${
                          errors.start_date ? 'input-error' : ''
                        }`}
                        {...register('start_date')}
                      />
                      {errors.start_date && (
                        <span className="text-xs text-error font-medium mt-1 block">{errors.start_date.message}</span>
                      )}
                    </div>

                    <div>
                      <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">End Date</label>
                      <input
                        type="date"
                        disabled={watchedIsHalfDay}
                        className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm ${
                          errors.end_date ? 'input-error' : ''
                        }`}
                        {...register('end_date')}
                      />
                      {errors.end_date && (
                        <span className="text-xs text-error font-medium mt-1 block">{errors.end_date.message}</span>
                      )}
                    </div>
                  </div>

                  {/* Half Day controls */}
                  <div className="bg-base-300/30 p-4 rounded-xl border border-base-content/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="is_half_day"
                        className="checkbox checkbox-secondary rounded-lg"
                        {...register('is_half_day')}
                      />
                      <label htmlFor="is_half_day" className="cursor-pointer text-xs font-bold text-base-content/85">
                        Apply for a Half Day
                      </label>
                    </div>

                    {watchedIsHalfDay && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-base-content/50 uppercase whitespace-nowrap">Select Period:</label>
                        <select
                          className={`select select-bordered select-sm rounded-lg bg-base-100 border-base-content/10 text-xs ${
                            errors.half_day_period ? 'select-error' : ''
                          }`}
                          {...register('half_day_period')}
                        >
                          <option value="">Choose...</option>
                          <option value="MORNING">Morning Session</option>
                          <option value="AFTERNOON">Afternoon Session</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {errors.half_day_period && (
                    <span className="text-xs text-error font-medium block">{errors.half_day_period.message}</span>
                  )}

                  {/* Delegation colleague */}
                  <div>
                    <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Colleague Handover backup (Optional)</label>
                    <select
                      className="select select-bordered w-full rounded-xl bg-base-100/40 border-base-content/10 text-sm focus:bg-base-100"
                      {...register('delegate_to_id')}
                    >
                      <option value="">Select colleague...</option>
                      {colleagues?.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.first_name ? `${c.first_name} ${c.last_name || ''}` : c.username} ({c.email})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-base-content/40 mt-1 block">
                      Select a colleague to temporarily delegate tasks to during your absence.
                    </span>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Reason</label>
                    <textarea
                      rows={3}
                      className={`textarea textarea-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm ${
                        errors.reason ? 'textarea-error' : ''
                      }`}
                      placeholder="Please state the purpose of your time off request."
                      {...register('reason')}
                    />
                    {errors.reason && (
                      <span className="text-xs text-error font-medium mt-1 block">{errors.reason.message}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleCreateToggle(false)}
                  className="btn btn-ghost rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || workingDays <= 0}
                  className="btn btn-secondary rounded-xl font-bold px-8 shadow-lg shadow-secondary/20 text-xs"
                >
                  {createMutation.isPending ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>

            {/* Right side: working days indicator */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-base font-bold Outfit flex items-center gap-2">
                  <Clock className="w-5 h-5 text-secondary" />
                  Leave Calculator
                </h3>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2 border-b border-base-content/5 pb-3">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-base-content/60">Selected Duration</span>
                      <span className="font-extrabold text-base text-secondary">
                        {isCalculatingDays ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          `${workingDays} working ${workingDays === 0.5 || workingDays === 1 ? 'day' : 'days'}`
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="alert alert-info rounded-xl p-3 flex items-start gap-2 text-xs">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Weekends (Fri & Sat) and company/national holidays are automatically excluded from the calculation.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default LeaveListPage;
