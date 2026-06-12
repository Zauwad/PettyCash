import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pettyCashApi } from '@/features/petty-cash/api/pettyCashApi';
import { leaveApi } from '@/features/leave/api/leaveApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Wallet, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Building,
  Check,
  X
} from 'lucide-react';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';

export function ApprovalCenterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.profile?.role || user?.role;
  const isCEO = role === 'CEO';
  const isTL = role === 'TEAM_LEAD';
  const isAdmin = role === 'ADMIN';

  // Toggle active approvals tab: 'petty_cash' or 'leave'
  const [activeTab, setActiveTab] = useState('petty_cash');
  
  // Selection states for bulk actions
  const [selectedPettyCash, setSelectedPettyCash] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState([]);

  // Reject modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState(null); // { type: 'petty_cash'|'leave', uuid: string, id: number }
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch Petty Cash requests in pending states
  const pettyCashParams = {};
  if (isTL && user?.profile?.department) {
    pettyCashParams.department = user.profile.department.id;
  }
  
  const { data: pettyCashPending, isLoading: isPettyCashLoading } = useQuery({
    queryKey: ['pending-petty-cash', pettyCashParams],
    queryFn: async () => {
      // Fetch both pending_tl and pending_ceo to cover delegations
      const res = await pettyCashApi.list(pettyCashParams);
      return res.results?.filter(r => 
        (r.state === 'pending_tl_approval' && (isTL || isCEO || isAdmin)) ||
        (r.state === 'pending_ceo_approval' && (isCEO || isAdmin))
      ) || [];
    },
  });

  // Fetch Leave requests in pending states
  const leaveParams = {};
  const { data: leavePending, isLoading: isLeaveLoading } = useQuery({
    queryKey: ['pending-leaves', leaveParams],
    queryFn: async () => {
      const res = await leaveApi.listRequests(leaveParams);
      return res.results?.filter(r => 
        (r.state === 'pending_tl_approval' && (isTL || isCEO || isAdmin)) ||
        (r.state === 'pending_ceo_approval' && (isCEO || isAdmin))
      ) || [];
    },
  });

  // Mutation: Approve Petty Cash
  const approvePettyCashMutation = useMutation({
    mutationFn: (uuid) => pettyCashApi.approve(uuid),
    onSuccess: () => {
      toast.success('Petty cash request approved.');
      queryClient.invalidateQueries({ queryKey: ['pending-petty-cash'] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to approve.');
    }
  });

  // Mutation: Reject Petty Cash
  const rejectPettyCashMutation = useMutation({
    mutationFn: ({ uuid, reason }) => pettyCashApi.reject(uuid, reason),
    onSuccess: () => {
      toast.success('Petty cash request rejected.');
      setShowRejectModal(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['pending-petty-cash'] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject.');
    }
  });

  // Mutation: Approve Leave
  const approveLeaveMutation = useMutation({
    mutationFn: (uuid) => leaveApi.approveRequest(uuid),
    onSuccess: () => {
      toast.success('Leave request approved.');
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to approve.');
    }
  });

  // Mutation: Reject Leave
  const rejectLeaveMutation = useMutation({
    mutationFn: ({ uuid, reason }) => leaveApi.rejectRequest(uuid, reason),
    onSuccess: () => {
      toast.success('Leave request rejected.');
      setShowRejectModal(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject.');
    }
  });

  // Mutation: Bulk Approve Petty Cash
  const bulkApprovePettyCashMutation = useMutation({
    mutationFn: (ids) => pettyCashApi.bulkAction(ids, 'approve'),
    onSuccess: (res) => {
      const succeeded = res.success?.length || 0;
      const failed = res.failed?.length || 0;
      toast.success(`Successfully approved ${succeeded} requests.${failed > 0 ? ` Failed ${failed}.` : ''}`);
      setSelectedPettyCash([]);
      queryClient.invalidateQueries({ queryKey: ['pending-petty-cash'] });
    },
    onError: () => {
      toast.error('Bulk approval failed.');
    }
  });

  // Mutation: Bulk Reject Petty Cash
  const bulkRejectPettyCashMutation = useMutation({
    mutationFn: ({ ids, reason }) => pettyCashApi.bulkAction(ids, 'reject', reason),
    onSuccess: (res) => {
      const succeeded = res.success?.length || 0;
      const failed = res.failed?.length || 0;
      toast.success(`Successfully rejected ${succeeded} requests.${failed > 0 ? ` Failed ${failed}.` : ''}`);
      setSelectedPettyCash([]);
      setShowRejectModal(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['pending-petty-cash'] });
    },
    onError: () => {
      toast.error('Bulk rejection failed.');
    }
  });

  // Mutation: Bulk Approve Leaves (Iterative parallel requests)
  const bulkApproveLeavesMutation = useMutation({
    mutationFn: async (uuids) => {
      const promises = uuids.map(uuid => leaveApi.approveRequest(uuid));
      return Promise.allSettled(promises);
    },
    onSuccess: (results) => {
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      toast.success(`Approved ${succeeded} leave requests.${failed > 0 ? ` Failed ${failed}.` : ''}`);
      setSelectedLeave([]);
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
    }
  });

  // Mutation: Bulk Reject Leaves (Iterative parallel requests)
  const bulkRejectLeavesMutation = useMutation({
    mutationFn: async ({ uuids, reason }) => {
      const promises = uuids.map(uuid => leaveApi.rejectRequest(uuid, reason));
      return Promise.allSettled(promises);
    },
    onSuccess: (results) => {
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      toast.success(`Rejected ${succeeded} leave requests.${failed > 0 ? ` Failed ${failed}.` : ''}`);
      setSelectedLeave([]);
      setShowRejectModal(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
    }
  });

  // GSAP animation references
  const staggerRef = useGSAPStagger('.approval-card', [activeTab, pettyCashPending, leavePending]);

  // Checkbox helpers
  const handleSelectPettyCash = (id) => {
    setSelectedPettyCash(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPettyCash = () => {
    if (selectedPettyCash.length === pettyCashPending.length) {
      setSelectedPettyCash([]);
    } else {
      setSelectedPettyCash(pettyCashPending.map(r => r.id));
    }
  };

  const handleSelectLeave = (uuid) => {
    setSelectedLeave(prev => 
      prev.includes(uuid) ? prev.filter(item => item !== uuid) : [...prev, uuid]
    );
  };

  const handleSelectAllLeave = () => {
    if (selectedLeave.length === leavePending.length) {
      setSelectedLeave([]);
    } else {
      setSelectedLeave(leavePending.map(r => r.uuid));
    }
  };

  // Reject Submit Handler (supports single & bulk)
  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }

    if (rejectionTarget.bulk) {
      if (rejectionTarget.type === 'petty_cash') {
        bulkRejectPettyCashMutation.mutate({ ids: selectedPettyCash, reason: rejectionReason });
      } else {
        bulkRejectLeavesMutation.mutate({ uuids: selectedLeave, reason: rejectionReason });
      }
    } else {
      if (rejectionTarget.type === 'petty_cash') {
        rejectPettyCashMutation.mutate({ uuid: rejectionTarget.uuid, reason: rejectionReason });
      } else {
        rejectLeaveMutation.mutate({ uuid: rejectionTarget.uuid, reason: rejectionReason });
      }
    }
  };

  const currentList = activeTab === 'petty_cash' ? pettyCashPending : leavePending;
  const isCurrentListLoading = activeTab === 'petty_cash' ? isPettyCashLoading : isLeaveLoading;

  return (
    <PageTransition>
      <div className="space-y-6 pb-20 relative">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-base-content/5 pb-5">
          <h2 className="text-3xl font-extrabold Outfit tracking-tight">Approvals Desk</h2>
          <p className="text-sm text-base-content/55">Review and approve employee petty cash vouchers and leave applications.</p>
        </div>

        {/* Module switcher tabs */}
        <div className="tabs tabs-box bg-base-200/50 p-1 rounded-xl max-w-fit border border-base-content/5 flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('petty_cash')}
            className={`tab rounded-lg text-xs font-semibold px-5 py-2.5 gap-2 ${
              activeTab === 'petty_cash'
                ? 'tab-active bg-primary text-primary-content shadow font-bold'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Petty Cash ({pettyCashPending?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`tab rounded-lg text-xs font-semibold px-5 py-2.5 gap-2 ${
              activeTab === 'leave'
                ? 'tab-active bg-secondary text-secondary-content shadow font-bold'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Leave requests ({leavePending?.length || 0})
          </button>
        </div>

        {/* Bulk Action floating bar (displays when selection > 0) */}
        {((activeTab === 'petty_cash' && selectedPettyCash.length > 0) || 
          (activeTab === 'leave' && selectedLeave.length > 0)) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-base-200 border border-base-content/10 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 z-40 animate-slide-up max-w-lg w-full justify-between glass-panel">
            <span className="text-xs font-bold text-base-content">
              {activeTab === 'petty_cash' ? selectedPettyCash.length : selectedLeave.length} selected
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (activeTab === 'petty_cash') {
                    bulkApprovePettyCashMutation.mutate(selectedPettyCash);
                  } else {
                    bulkApproveLeavesMutation.mutate(selectedLeave);
                  }
                }}
                disabled={bulkApprovePettyCashMutation.isPending || bulkApproveLeavesMutation.isPending}
                className="btn btn-success text-success-content btn-sm rounded-xl font-bold gap-1 text-xs"
              >
                <Check className="w-4.5 h-4.5" />
                Approve Selected
              </button>
              <button
                onClick={() => {
                  setRejectionTarget({ type: activeTab, bulk: true });
                  setShowRejectModal(true);
                }}
                className="btn btn-error text-error-content btn-sm rounded-xl font-bold gap-1 text-xs"
              >
                <X className="w-4.5 h-4.5" />
                Reject Selected
              </button>
            </div>
          </div>
        )}

        {/* List of approvals */}
        {isCurrentListLoading ? (
          <LoadingSkeleton variant="table" count={3} />
        ) : currentList?.length > 0 ? (
          <div ref={staggerRef} className="space-y-4">
            {/* Table select-all header for bulk check */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-base-content/5 text-xs font-semibold text-base-content/40 uppercase">
              <input
                type="checkbox"
                className="checkbox checkbox-xs rounded"
                checked={
                  activeTab === 'petty_cash'
                    ? selectedPettyCash.length === pettyCashPending.length
                    : selectedLeave.length === leavePending.length
                }
                onChange={
                  activeTab === 'petty_cash' ? handleSelectAllPettyCash : handleSelectAllLeave
                }
              />
              <span>Select All Pending</span>
            </div>

            {/* List */}
            {currentList.map((item) => (
              <div 
                key={item.id} 
                className="approval-card glass-panel rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-base-content/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
              >
                <div className="flex gap-4 items-start w-full overflow-hidden">
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm rounded-lg self-center shrink-0"
                    checked={
                      activeTab === 'petty_cash' 
                        ? selectedPettyCash.includes(item.id) 
                        : selectedLeave.includes(item.uuid)
                    }
                    onChange={() => 
                      activeTab === 'petty_cash' 
                        ? handleSelectPettyCash(item.id) 
                        : handleSelectLeave(item.uuid)
                    }
                  />

                  {/* Icon */}
                  <div className={`p-3 rounded-xl shrink-0 ${
                    activeTab === 'petty_cash' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                  }`}>
                    {activeTab === 'petty_cash' ? <Wallet className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link 
                        to={activeTab === 'petty_cash' ? `/petty-cash/${item.uuid}` : `/leave/${item.uuid}`} 
                        className={`font-bold text-sm text-base-content transition-colors Outfit ${
                          activeTab === 'petty_cash' ? 'hover:text-primary' : 'hover:text-secondary'
                        }`}
                      >
                        {item.title || item.leave_type_details?.name}
                      </Link>
                      <StatusBadge state={item.state} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/50">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        {item.requester_name}
                      </span>
                      {item.department_details && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 shrink-0" />
                          {item.department_details.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-base-content/40 truncate max-w-md mt-1 leading-normal italic">
                      "{item.description || item.reason}"
                    </p>
                  </div>
                </div>

                {/* Amount / Days indicator & actions */}
                <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-6 border-t border-base-content/5 pt-3 md:border-0 md:pt-0 shrink-0">
                  <div className="text-right">
                    {activeTab === 'petty_cash' ? (
                      <>
                        <span className="text-[10px] text-base-content/40 uppercase font-black tracking-wider block">Requested</span>
                        <h4 className="text-base font-extrabold Outfit text-primary">
                          ৳{parseFloat(item.amount_requested).toLocaleString()}
                        </h4>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-base-content/40 uppercase font-black tracking-wider block">Duration</span>
                        <h4 className="text-base font-extrabold Outfit text-secondary">
                          {item.working_days_requested} Days
                        </h4>
                      </>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if (activeTab === 'petty_cash') {
                          approvePettyCashMutation.mutate(item.uuid);
                        } else {
                          approveLeaveMutation.mutate(item.uuid);
                        }
                      }}
                      className="btn btn-ghost btn-circle btn-sm text-success hover:bg-success/15 border border-success/10"
                      title="Quick Approve"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setRejectionTarget({ type: activeTab, uuid: item.uuid, id: item.id });
                        setShowRejectModal(true);
                      }}
                      className="btn btn-ghost btn-circle btn-sm text-error hover:bg-error/15 border border-error/10"
                      title="Quick Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState 
            title="Approvals queue is clear" 
            message="No leave or petty cash requests require your approval at the moment."
            icon={CheckSquare}
          />
        )}

        {/* MODAL: Rejection Reason */}
        {showRejectModal && createPortal(
          <div className="modal modal-open">
            <div className="modal-box rounded-2xl glass-panel border border-base-content/10 p-6 max-w-md">
              <h3 className="font-bold text-lg Outfit text-base-content flex items-center gap-2">
                <XCircle className="w-6 h-6 text-error" />
                Reject Requisition
              </h3>
              <p className="text-xs text-base-content/50 mt-1">
                {rejectionTarget?.bulk 
                  ? 'Please enter a rejection justification that will apply to all selected items.'
                  : 'Please enter a rejection justification. This will be shown to the applicant.'}
              </p>
              
              <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
                <div>
                  <textarea
                    rows={4}
                    className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm focus:border-error"
                    placeholder="Provide rejection reason..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-action">
                  <button 
                    type="button" 
                    onClick={() => { setShowRejectModal(false); setRejectionReason(''); }} 
                    className="btn btn-ghost rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={
                      rejectPettyCashMutation.isPending || 
                      rejectLeaveMutation.isPending ||
                      bulkRejectPettyCashMutation.isPending ||
                      bulkRejectLeavesMutation.isPending
                    }
                    className="btn btn-error rounded-xl font-bold text-xs"
                  >
                    Reject Application
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </PageTransition>
  );
}

export default ApprovalCenterPage;
