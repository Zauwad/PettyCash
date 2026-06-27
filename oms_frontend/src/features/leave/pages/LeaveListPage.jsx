import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { Select } from '@/shared/components/ui/Select';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Plus, 
  ArrowLeft, 
  Calendar, 
  AlertCircle, 
  ChevronRight,
  Info,
  Clock,
  Share2,
  CalendarDays,
  X,
  Users,
  CheckCircle2,
  UploadCloud,
  FileText
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

  const isCEO = user?.profile?.role === 'CEO';
  const [view, setView] = useState(searchParams.get('create') === 'true' && !isCEO ? 'create' : 'list');
  const [workingDays, setWorkingDays] = useState(0);
  const [isCalculatingDays, setIsCalculatingDays] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  // Overlapping leaves checking state
  const [overlappingLeaves, setOverlappingLeaves] = useState([]);
  const [isCheckingOverlaps, setIsCheckingOverlaps] = useState(false);

  // Leave attachments state
  const [filesToUpload, setFilesToUpload] = useState([]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer?.files || e.target.files);
    
    // Validations
    const validFiles = droppedFiles.filter(file => {
      const isValidSize = file.size <= 10 * 1024 * 1024;
      const isValidType = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      
      if (!isValidSize) toast.error(`${file.name} exceeds 10MB limit.`);
      if (!isValidType) toast.error(`${file.name} file type is not supported.`);
      
      return isValidSize && isValidType;
    });

    if (filesToUpload.length + validFiles.length > 5) {
      toast.error('You can upload a maximum of 5 files.');
      return;
    }

    setFilesToUpload(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };



  const isManagerOrLead = ['TEAM_LEAD', 'HR', 'GENERAL_MANAGER'].includes(user?.profile?.role);
  const [scopeTab, setScopeTab] = useState('org');

  // Filter parameters
  const filterParams = { page };
  if (activeTab !== 'all') filterParams.state = activeTab;
  if (searchVal) filterParams.search = searchVal;
  if (isManagerOrLead && scopeTab === 'my') {
    filterParams.only_self = 'true';
  }

  // Query: Leave requests list
  const { data: requests, isLoading, isError } = useQuery({
    queryKey: ['leave-requests-list', filterParams, scopeTab],
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
  const watchedLeaveTypeId = watch('leave_type_id');
  const watchedHalfDayPeriod = watch('half_day_period');
  const selectedLeaveType = leaveTypes?.results?.find(t => String(t.id) === String(watchedLeaveTypeId));
  const watchedDelegateToId = watch('delegate_to_id');

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
      } catch (_err) {
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

  // Trigger overlapping leaves check
  useEffect(() => {
    async function checkOverlaps() {
      if (!watchedStartDate || !watchedEndDate || watchedStartDate > watchedEndDate) {
        setOverlappingLeaves([]);
        return;
      }

      setIsCheckingOverlaps(true);
      try {
        const res = await leaveApi.getOverlappingLeaves(watchedStartDate, watchedEndDate);
        setOverlappingLeaves(res);
      } catch (_err) {
        setOverlappingLeaves([]);
      } finally {
        setIsCheckingOverlaps(false);
      }
    }

    checkOverlaps();
  }, [watchedStartDate, watchedEndDate]);

  // Mutation: Submit Leave Request
  const createMutation = useMutation({
    mutationFn: (data) => leaveApi.createRequest(data),
    onSuccess: async (newReq) => {
      // Upload files if any
      if (filesToUpload.length > 0) {
        toast.info('Uploading attachments...');
        try {
          await leaveApi.uploadAttachments(newReq.uuid, filesToUpload);
          toast.success('Attachments uploaded.');
        } catch (_e) {
          toast.error('Failed to upload some attachments.');
        }
      }

      try {
        // Submit request for approval automatically
        await leaveApi.submitRequest(newReq.uuid);
        toast.success('Leave request submitted successfully!');
      } catch (_submitErr) {
        toast.warning('Leave request created as draft. Please submit it manually.');
      }
      
      reset();
      setFilesToUpload([]);
      setView('list');
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['leave-requests-list'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leave-balances'] });
      ['pending-leaves', 'analytics-summary', 'dashboard-upcoming-absences', 'dashboard-leave-requests', 'dashboard-activities'].forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
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

  const handleTabChange = useCallback((state) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (state === 'all') next.delete('state');
      else next.set('state', state);
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const handleSearch = useCallback((term) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!term) next.delete('search');
      else next.set('search', term);
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const onSubmit = (data) => {
    const selectedLeaveType = leaveTypes?.results?.find(t => String(t.id) === String(data.leave_type_id));
    if (selectedLeaveType?.requires_attachment && filesToUpload.length === 0) {
      toast.error('An attachment is required for this leave category.');
      return;
    }

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
    if (shouldCreate && isCEO) return;
    if (shouldCreate) {
      setView('create');
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('create', 'true');
        return next;
      });
    } else {
      setView('list');
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      });
      reset();
      setFilesToUpload([]);
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
                {!isCEO && (
                  <button 
                    onClick={() => handleCreateToggle(true)}
                    className="btn btn-secondary rounded-xl font-bold gap-2 shadow-lg shadow-secondary/20"
                  >
                    <Plus className="w-5 h-5" />
                    Apply Leave
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side: Requests queue */}
            <div className={`${isCEO ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6`}>
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <SearchInput 
                  value={searchVal}
                  onSearch={handleSearch}
                  placeholder="Search reasons, delegate names..."
                />

                {isManagerOrLead && (
                  <div className="flex bg-base-200/60 p-1 rounded-xl border border-base-content/5 shrink-0 max-w-fit shadow-inner">
                    <button
                      type="button"
                      onClick={() => {
                        setScopeTab('org');
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          next.set('page', '1');
                          return next;
                        });
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        scopeTab === 'org'
                          ? 'bg-secondary text-secondary-content shadow font-black'
                          : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
                      }`}
                    >
                      Organization Requests
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScopeTab('my');
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          next.set('page', '1');
                          return next;
                        });
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        scopeTab === 'my'
                          ? 'bg-secondary text-secondary-content shadow font-black'
                          : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
                      }`}
                    >
                      My Requests
                    </button>
                  </div>
                )}
              </div>

              {/* Status tabs */}
              <div className="tabs tabs-box bg-base-200/50 p-1 rounded-xl max-w-fit border border-base-content/5 flex-wrap gap-1">
                {['all', 'draft', 'pending_tl_approval', 'pending_gm_approval', 'approved', 'rejected', 'cancelled'].map((tab) => {
                  const label = tab === 'all' 
                    ? 'All' 
                    : tab === 'pending_tl_approval'
                    ? 'Lead Approval'
                    : tab === 'pending_gm_approval'
                    ? 'GM Approval'
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
                      onClick={() => setSelectedLeave(req)}
                      className="leave-card glass-panel rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all border border-base-content/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
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
                          onClick={(e) => e.stopPropagation()}
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
                  message={isCEO ? "No leave requests have been submitted in your department yet." : "Raise a leave application to request scheduled time off."}
                  actionLabel={isCEO ? undefined : "Apply Leave"}
                  onAction={isCEO ? undefined : () => handleCreateToggle(true)}
                />
              )}

              {/* Pagination */}
              {requests?.count > 20 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    disabled={page === 1}
                    onClick={() => setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.set('page', String(page - 1));
                      return next;
                    })}
                    className="btn btn-outline btn-sm rounded-lg border-base-content/10 text-xs"
                  >
                    Previous
                  </button>
                  <span className="self-center text-xs font-semibold text-base-content/60 px-4">
                    Page {page} of {Math.ceil(requests.count / 20)}
                  </span>
                  <button
                    disabled={page >= Math.ceil(requests.count / 20)}
                    onClick={() => setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.set('page', String(page + 1));
                      return next;
                    })}
                    className="btn btn-outline btn-sm rounded-lg border-base-content/10 text-xs"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Right side: Detailed Balances */}
            {!isCEO && (
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
            )}
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
                    <Select
                      value={watchedLeaveTypeId}
                      onChange={(val) => setValue('leave_type_id', val, { shouldValidate: true })}
                      options={leaveTypes?.results?.map(type => ({
                        value: String(type.id),
                        label: `${type.name}${type.requires_attachment ? ' (Requires Attachment)' : ''}`
                      })) || []}
                      placeholder="Select a category..."
                      className={errors.leave_type_id ? 'border-error rounded-xl [&>button]:border-error' : ''}
                    />
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
                        <Select
                          value={watchedHalfDayPeriod}
                          onChange={(val) => setValue('half_day_period', val, { shouldValidate: true })}
                          options={[
                            { value: 'MORNING', label: 'Morning Session' },
                            { value: 'AFTERNOON', label: 'Afternoon Session' },
                          ]}
                          placeholder="Choose..."
                          className={cn("w-48", errors.half_day_period ? 'border-error rounded-xl [&>button]:border-error' : '')}
                        />
                      </div>
                    )}
                  </div>
                  {errors.half_day_period && (
                    <span className="text-xs text-error font-medium block">{errors.half_day_period.message}</span>
                  )}

                  {/* Delegation colleague */}
                  <div>
                    <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Colleague Handover backup (Optional)</label>
                    <Select
                      value={watchedDelegateToId}
                      onChange={(val) => setValue('delegate_to_id', val)}
                      options={colleagues?.map(c => ({
                        value: String(c.id),
                        label: `${c.first_name ? `${c.first_name} ${c.last_name || ''}` : c.username} (${c.email})`
                      })) || []}
                      placeholder="Select colleague..."
                    />
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

              {/* Overlapping Leaves Card */}
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
                <h3 className="text-base font-bold Outfit flex items-center gap-2">
                  <Users className="w-5 h-5 text-secondary" />
                  Department Coverage Check
                </h3>

                {!watchedStartDate || !watchedEndDate ? (
                  <div className="alert alert-info rounded-xl p-3 flex items-start gap-2 text-xs bg-info/10 text-info border border-info/20">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Please select a start date and end date to check for overlapping department leaves.
                    </span>
                  </div>
                ) : watchedStartDate > watchedEndDate ? (
                  <div className="alert alert-error rounded-xl p-3 flex items-start gap-2 text-xs bg-error/10 text-error border border-error/20">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-error" />
                    <span>
                      Start date cannot be after end date.
                    </span>
                  </div>
                ) : isCheckingOverlaps ? (
                  <div className="flex flex-col items-center justify-center py-6 text-xs text-base-content/40 font-semibold gap-2">
                    <span className="loading loading-spinner loading-sm text-secondary"></span>
                    <span>Checking for overlaps...</span>
                  </div>
                ) : overlappingLeaves.length > 0 ? (
                  <div className="space-y-3">
                    <div className="alert alert-warning rounded-xl p-3 flex items-start gap-2 text-xs bg-warning/10 text-warning border border-warning/20">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                      <span>
                        <strong>Warning:</strong> {overlappingLeaves.length} {overlappingLeaves.length === 1 ? 'colleague has' : 'colleagues have'} overlapping leaves.
                      </span>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1">
                      {overlappingLeaves.map((leaf) => (
                        <div key={leaf.uuid} className="p-3 bg-base-100/40 border border-base-content/5 rounded-xl space-y-1.5 hover:bg-base-100/70 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-xs text-base-content">{leaf.employee_name}</h4>
                              <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wide">{leaf.department_name}</p>
                            </div>
                            <span className={`badge ${
                              leaf.state === 'approved' ? 'badge-success bg-success/20 text-success' : 'badge-warning bg-warning/20 text-warning'
                            } font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5 h-4 rounded-md border-0`}>
                              {leaf.state === 'approved' ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-base-content/50 font-medium">
                            <span>{leaf.start_date} → {leaf.end_date}</span>
                            <span className="font-semibold text-base-content/85">{leaf.working_days_requested} days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-success rounded-xl p-3 flex items-start gap-2 text-xs bg-success/10 text-success border border-success/20">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>Perfect Coverage!</strong> No other colleagues are out during this period.
                    </span>
                  </div>
                )}
              </div>

              {/* Document Uploader */}
              <div className={`glass-panel p-6 rounded-2xl shadow-xl space-y-4 border transition-all duration-300 ${
                selectedLeaveType?.requires_attachment 
                  ? 'border-warning/35 bg-warning/5' 
                  : 'border-base-content/5'
              }`}>
                <div>
                  <h3 className="text-base font-bold Outfit flex items-center justify-between">
                    <span>Medical / Support Attachments</span>
                    {selectedLeaveType?.requires_attachment && (
                      <span className="badge badge-warning font-bold text-[9px] uppercase tracking-wider h-4 rounded-md">Required</span>
                    )}
                  </h3>
                  <p className="text-[10px] text-base-content/40 font-semibold uppercase mt-0.5">
                    {selectedLeaveType?.requires_attachment 
                      ? 'Please upload supporting documents (Max 5 files, 10MB each)'
                      : 'Optional supporting documents (Max 5 files, 10MB each)'
                    }
                  </p>
                </div>

                {/* Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 bg-base-100/20 ${
                    selectedLeaveType?.requires_attachment
                      ? 'border-warning/30 hover:border-warning/60 hover:bg-warning/5'
                      : 'border-base-content/20 hover:border-secondary/40 hover:bg-secondary/5'
                  }`}
                >
                  <input
                    type="file"
                    id="leave-file-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileDrop}
                  />
                  <label htmlFor="leave-file-upload" className="cursor-pointer flex flex-col items-center">
                    <UploadCloud className={`w-8 h-8 mb-2 ${selectedLeaveType?.requires_attachment ? 'text-warning/55' : 'text-base-content/30'}`} />
                    <span className={`text-xs font-bold ${selectedLeaveType?.requires_attachment ? 'text-warning' : 'text-secondary'}`}>Upload documents</span>
                    <span className="text-[10px] text-base-content/40 mt-1">or drag and drop here</span>
                  </label>
                </div>

                {/* Selected files list */}
                {filesToUpload.length > 0 && (
                  <div className="space-y-2 border-t border-base-content/5 pt-3">
                    <p className="text-[10px] font-bold text-base-content/40 uppercase">Selected Files ({filesToUpload.length})</p>
                    {filesToUpload.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-base-300/40 p-2.5 rounded-lg border border-base-content/5 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className={`w-4 h-4 shrink-0 ${selectedLeaveType?.requires_attachment ? 'text-warning' : 'text-secondary'}`} />
                          <span className="font-semibold truncate max-w-[150px]">{file.name}</span>
                          <span className="text-[9px] text-base-content/40">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="btn btn-ghost btn-circle btn-xs text-base-content/45 hover:text-error"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leave Details Slide-over Drawer */}
      {selectedLeave && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedLeave(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-md bg-base-200/98 backdrop-blur-md shadow-2xl h-full border-l border-base-content/5 flex flex-col z-10 animate-slide-in-right glass-panel p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-base-content/5 pb-4">
              <div>
                <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Leave Application Peek</span>
                <h3 className="text-lg font-bold Outfit text-base-content mt-0.5">#{selectedLeave.id} Details</h3>
              </div>
              <button 
                onClick={() => setSelectedLeave(null)}
                className="btn btn-ghost btn-circle btn-sm hover:bg-base-content/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <StatusBadge state={selectedLeave.state} />
              </div>

              <div>
                <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide">Leave Type</h4>
                <p className="text-base font-extrabold text-base-content Outfit mt-1">{selectedLeave.leave_type_details?.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-b border-base-content/5 py-4">
                <div>
                  <h4 className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Duration</h4>
                  <p className="text-xs text-base-content font-extrabold mt-1">
                    {selectedLeave.working_days_requested} working {selectedLeave.working_days_requested === '1.0' || selectedLeave.working_days_requested === 0.5 ? 'day' : 'days'}
                  </p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Type</h4>
                  <p className="text-xs text-base-content font-semibold mt-1">
                    {selectedLeave.is_half_day ? `Half Day (${selectedLeave.half_day_period})` : 'Full Day'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Leave Period</h4>
                <p className="text-xs text-base-content font-bold mt-1">
                  {new Date(selectedLeave.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' → '}
                  {new Date(selectedLeave.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide">Reason</h4>
                <p className="text-xs text-base-content/75 mt-1 leading-relaxed whitespace-pre-wrap">{selectedLeave.reason}</p>
              </div>

              {selectedLeave.delegate_name && (
                <div>
                  <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide">Handover Backup Colleague</h4>
                  <p className="text-xs text-base-content/85 font-semibold mt-1">{selectedLeave.delegate_name}</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-base-content/5 flex gap-3">
              <Link 
                to={`/leave/${selectedLeave.uuid}`}
                onClick={() => setSelectedLeave(null)}
                className="btn btn-secondary rounded-xl font-bold flex-1 text-xs shadow-md shadow-secondary/25"
              >
                View Full Details Page
              </Link>
              <button 
                onClick={() => setSelectedLeave(null)}
                className="btn btn-outline border-base-content/10 hover:bg-base-content/5 rounded-xl text-xs"
              >
                Close Peek
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageTransition>
  );
}

export default LeaveListPage;
