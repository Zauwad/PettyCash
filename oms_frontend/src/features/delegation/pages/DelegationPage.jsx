import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { delegationApi } from '../api/delegationApi';
import axiosInstance from '@/shared/lib/axios';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Share2, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  ShieldAlert,
  ArrowRight,
  Info,
  CheckCircle,
  User
} from 'lucide-react';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';

const delegationSchema = z.object({
  delegate_id: z.string().min(1, 'Delegate colleague is required'),
  scope: z.enum(['PETTY_CASH', 'LEAVE', 'ALL']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  reason: z.string().optional(),
}).refine(data => {
  return data.start_date <= data.end_date;
}, {
  message: "End date cannot be before start date.",
  path: ["end_date"]
});

export function DelegationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.profile?.role || user?.role;
  const isAuthorizedToDelegate = ['TEAM_LEAD', 'CEO', 'GENERAL_MANAGER'].includes(role);

  const [showCreateForm, setShowCreateForm] = useState(false);

  // Query: Fetch delegations list
  const { data: delegations, isLoading, isError } = useQuery({
    queryKey: ['delegations-list'],
    queryFn: () => delegationApi.list(),
  });

  // Query: Fetch colleagues in same organization
  const { data: colleagues } = useQuery({
    queryKey: ['delegation-colleagues'],
    queryFn: async () => {
      const res = await axiosInstance.get('/api/users/');
      // Filter out self and only show roles capable of approving (TLs / GMs / CEOs / Admins)
      return res.data?.results?.filter(u => 
        u.email !== user.email && 
        ['TEAM_LEAD', 'CEO', 'ADMIN', 'GENERAL_MANAGER'].includes(u.profile?.role || u.role)
      ) || [];
    },
    enabled: isAuthorizedToDelegate
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(delegationSchema),
    defaultValues: {
      delegate_id: '',
      scope: 'ALL',
      start_date: '',
      end_date: '',
      reason: '',
    }
  });

  // Mutation: Create Delegation
  const createMutation = useMutation({
    mutationFn: (data) => delegationApi.create(data),
    onSuccess: () => {
      toast.success('OOO approval delegation created successfully.');
      setShowCreateForm(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['delegations-list'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.delegate_id || 
                  err.response?.data?.end_date || 
                  err.response?.data?.detail || 
                  'Failed to create delegation.';
      toast.error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    }
  });

  // Mutation: Revoke
  const revokeMutation = useMutation({
    mutationFn: (id) => delegationApi.revoke(id),
    onSuccess: () => {
      toast.success('Delegation revoked.');
      queryClient.invalidateQueries({ queryKey: ['delegations-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to revoke.');
    }
  });

  const listRef = useGSAPStagger('.delegation-item', [delegations]);

  const onSubmit = (data) => {
    createMutation.mutate({
      delegate_id: parseInt(data.delegate_id),
      scope: data.scope,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-content/5 pb-5">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold Outfit tracking-tight">Out of Office Delegation</h2>
            <p className="text-sm text-base-content/55">
              Temporarily delegate your approval authority to a colleague during your absences.
            </p>
          </div>

          {isAuthorizedToDelegate && !showCreateForm && (
            <button 
              onClick={() => setShowCreateForm(true)}
              className="btn btn-success text-success-content rounded-xl font-bold gap-2 shadow-lg shadow-success/20 text-xs"
            >
              <Plus className="w-5 h-5" />
              Delegate Permissions
            </button>
          )}
        </div>

        {/* Not Authorized warning (e.g. for Employees) */}
        {!isAuthorizedToDelegate && (
          <div className="alert alert-warning rounded-2xl flex items-start gap-4 p-5 max-w-xl">
            <ShieldAlert className="w-6 h-6 text-warning mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Access Restricted</h4>
              <p className="text-xs text-warning-content/85 mt-1">
                Only Team Leads, General Managers, CEOs, and Administrators can configure Out-of-Office approval delegation records.
              </p>
            </div>
          </div>
        )}

        {/* Content grid */}
        {isAuthorizedToDelegate && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle: Delegation form & list */}
            <div className="lg:col-span-2 space-y-6">
              {showCreateForm && (
                <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5 animate-fade-in border border-base-content/10">
                  <div className="flex justify-between items-center border-b border-base-content/5 pb-3">
                    <h3 className="text-lg font-bold Outfit">Configure OOO Delegation</h3>
                    <button 
                      onClick={() => { setShowCreateForm(false); reset(); }}
                      className="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-error"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
                    {/* Delegate user */}
                    <div>
                      <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Delegate Colleague</label>
                      <select
                        className={`select select-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm ${
                          errors.delegate_id ? 'select-error' : ''
                        }`}
                        {...register('delegate_id')}
                      >
                        <option value="">Select colleague...</option>
                        {colleagues?.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.first_name ? `${c.first_name} ${c.last_name || ''}` : c.username} ({c.profile?.role})
                          </option>
                        ))}
                      </select>
                      {errors.delegate_id && (
                        <span className="text-xs text-error font-medium mt-1 block">{errors.delegate_id.message}</span>
                      )}
                    </div>

                    {/* Scope & Date ranges */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Delegation Scope</label>
                        <select
                          className="select select-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                          {...register('scope')}
                        >
                          <option value="ALL">All (Cash + Leave)</option>
                          <option value="PETTY_CASH">Petty Cash Only</option>
                          <option value="LEAVE">Leave Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Start Date</label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                          {...register('start_date')}
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">End Date</label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                          {...register('end_date')}
                        />
                      </div>
                    </div>
                    {errors.end_date && (
                      <span className="text-xs text-error font-medium block">{errors.end_date.message}</span>
                    )}

                    {/* Reason */}
                    <div>
                      <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">OOO Reason</label>
                      <textarea
                        rows={3}
                        className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                        placeholder="State reason for going out of office..."
                        {...register('reason')}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => { setShowCreateForm(false); reset(); }}
                        className="btn btn-ghost rounded-xl text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="btn btn-success text-success-content rounded-xl font-bold px-8 shadow-lg shadow-success/20 text-xs"
                      >
                        {createMutation.isPending ? (
                          <span className="loading loading-spinner"></span>
                        ) : (
                          'Save Delegation'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Active Delegation list */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold Outfit">My Delegations</h3>

                {isLoading ? (
                  <LoadingSkeleton variant="table" count={3} />
                ) : delegations && delegations.length > 0 ? (
                  <div ref={listRef} className="space-y-4">
                    {delegations.map((del) => {
                      const isOutgoing = del.delegator_details?.username === user.username;
                      
                      return (
                        <div 
                          key={del.id} 
                          className="delegation-item glass-panel p-5 rounded-2xl border border-base-content/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex gap-4 items-start overflow-hidden">
                            <div className={`p-3 rounded-xl shrink-0 ${
                              isOutgoing ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                            }`}>
                              <Share2 className="w-5 h-5" />
                            </div>
                            <div className="space-y-1 overflow-hidden">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-sm Outfit text-base-content">
                                  {isOutgoing 
                                    ? `Delegated to ${del.delegate_details?.first_name || del.delegate_details?.username}`
                                    : `Delegation from ${del.delegator_details?.first_name || del.delegator_details?.username}`
                                  }
                                </h4>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                  del.is_active ? 'bg-success/15 text-success' : 'bg-base-300 text-base-content/40'
                                }`}>
                                  {del.is_active ? 'Active' : 'Expired'}
                                </span>
                              </div>
                              <p className="text-xs text-base-content/50 font-semibold">
                                Scope: <span className="text-primary font-bold">{del.scope}</span> · {new Date(del.start_date).toLocaleDateString()} to {new Date(del.end_date).toLocaleDateString()}
                              </p>
                              {del.reason && (
                                <p className="text-xs text-base-content/40 italic leading-normal truncate max-w-sm">
                                  "{del.reason}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Revoke button (only for outgoing delegations) */}
                          {isOutgoing && del.is_active && (
                            <button
                              onClick={() => revokeMutation.mutate(del.id)}
                              disabled={revokeMutation.isPending}
                              className="btn btn-ghost btn-circle btn-sm text-base-content/45 hover:text-error hover:bg-error/15 shrink-0"
                              title="Revoke early"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState 
                    title="No active delegations" 
                    message="You haven't configured any Out-of-Office delegations, and no active delegations are shared with you."
                    icon={Share2}
                  />
                )}
              </div>
            </div>

            {/* Right side: Information block */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-base font-bold Outfit flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  OOO Delegation Rules
                </h3>
                <div className="space-y-3 text-xs text-base-content/70 leading-relaxed">
                  <p>
                    Delegating approval authority ensures your team's requisitions and leave requests don't get blocked while you are away.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 font-medium">
                    <li>You can only delegate to colleagues within your own organization.</li>
                    <li>The delegate must have a role capable of approving (Team Lead, CEO, or Admin).</li>
                    <li>Circular delegations are blocked (if A delegates to B, B cannot delegate to A during the same time frame).</li>
                    <li>Active delegations automatically expire and deactivate after the end date passes.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// Inline component workaround for X/Cancel modal button
function X({ className }) {
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>;
}

export default DelegationPage;
