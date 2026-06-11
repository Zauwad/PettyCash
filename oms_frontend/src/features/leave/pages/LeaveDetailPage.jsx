import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../api/leaveApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Ban,
  Send,
  UserCheck,
  AlignLeft
} from 'lucide-react';

export function LeaveDetailPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.profile?.role || user?.role;

  // Rejection modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Query: Leave Request details
  const { data: request, isLoading, isError } = useQuery({
    queryKey: ['leave-request-detail', uuid],
    queryFn: () => leaveApi.getRequest(uuid),
  });

  const queryParams = {
    queryKey: ['leave-request-detail', uuid],
  };

  // Mutation: Submit
  const submitMutation = useMutation({
    mutationFn: () => leaveApi.submitRequest(uuid),
    onSuccess: () => {
      toast.success('Leave request submitted!');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to submit request.');
    }
  });

  // Mutation: Approve
  const approveMutation = useMutation({
    mutationFn: () => leaveApi.approveRequest(uuid),
    onSuccess: () => {
      toast.success('Leave request approved!');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to approve request.');
    }
  });

  // Mutation: Reject
  const rejectMutation = useMutation({
    mutationFn: (reason) => leaveApi.rejectRequest(uuid, reason),
    onSuccess: () => {
      toast.success('Leave request rejected.');
      setShowRejectModal(false);
      setRejectionReason('');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject request.');
    }
  });

  // Mutation: Amend
  const amendMutation = useMutation({
    mutationFn: () => leaveApi.amendRequest(uuid),
    onSuccess: () => {
      toast.success('Request returned to draft.');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to amend request.');
    }
  });

  // Mutation: Cancel
  const cancelMutation = useMutation({
    mutationFn: () => leaveApi.cancelRequest(uuid),
    onSuccess: () => {
      toast.success('Leave request cancelled.');
      queryClient.invalidateQueries(queryParams);
      queryClient.invalidateQueries({ queryKey: ['leave-requests-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to cancel request.');
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 skeleton rounded"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-44 w-full skeleton rounded-2xl"></div>
          </div>
          <div className="h-64 w-full skeleton rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="alert alert-error rounded-2xl p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 mt-0.5 text-error-content" />
        <div>
          <h4 className="font-bold text-sm">Failed to retrieve leave request</h4>
          <p className="text-xs text-error-content/80 mt-1">Leave request may have been revoked, or you do not have permission to view it.</p>
          <Link to="/leave" className="btn btn-sm btn-outline btn-error mt-4 rounded-lg">
            Back to List
          </Link>
        </div>
      </div>
    );
  }

  // Authorization flags
  const isOwner = request.requester_name === user.first_name + ' ' + (user.last_name || '') || request.requester_name === user.username;
  const isPendingTL = request.state === 'pending_tl_approval';
  const isPendingCEO = request.state === 'pending_ceo_approval';
  
  // Can the current user approve?
  const deptName = user?.profile?.department?.name;
  const isSameDept = user?.profile?.organization?.slug === request.leave_type_details?.organization?.slug; // Simple tenant membership check
  const canApprove = (isPendingTL && role === 'TEAM_LEAD') || 
                      (isPendingCEO && role === 'CEO');

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    rejectMutation.mutate(rejectionReason);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Back Link */}
        <Link to="/leave" className="btn btn-ghost btn-xs text-base-content/60 hover:text-secondary rounded-md gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Leave list
        </Link>

        {/* Title & FSM operations */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-200/50 p-6 rounded-2xl border border-base-content/5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-extrabold Outfit text-base-content">
                {request.leave_type_details?.name} Application
              </h2>
              <StatusBadge state={request.state} />
            </div>
            <p className="text-xs text-base-content/50 font-bold uppercase tracking-wider">
              Request Ref: #{request.id} · Applied on {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Requester Submit / Cancel */}
            {isOwner && request.state === 'draft' && (
              <>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="btn btn-secondary btn-sm rounded-xl font-bold gap-1 text-xs"
                >
                  <Send className="w-4 h-4" />
                  Submit Request
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="btn btn-ghost text-error hover:bg-error/10 btn-sm rounded-xl text-xs"
                >
                  <Ban className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}

            {/* Requester Amend */}
            {isOwner && request.state === 'rejected' && (
              <button
                onClick={() => amendMutation.mutate()}
                disabled={amendMutation.isPending}
                className="btn btn-outline border-base-content/10 hover:bg-secondary/5 rounded-xl font-bold gap-1.5 text-xs"
              >
                <RotateCcw className="w-4 h-4" />
                Amend Request
              </button>
            )}

            {/* Requester Cancel Approved/Pending */}
            {isOwner && ['approved', 'pending_tl_approval', 'pending_ceo_approval'].includes(request.state) && (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="btn btn-ghost text-error hover:bg-error/10 btn-sm rounded-xl text-xs font-bold gap-1"
              >
                <Ban className="w-4 h-4" />
                Cancel Leave
              </button>
            )}

            {/* Approver Approve / Reject */}
            {canApprove && (
              <>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="btn btn-success text-success-content btn-sm rounded-xl font-bold gap-1 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Leave
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn btn-error text-error-content btn-sm rounded-xl font-bold gap-1 text-xs"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Leave
                </button>
              </>
            )}
          </div>
        </div>

        {/* Rejection Alert */}
        {request.state === 'rejected' && request.rejection_reason && (
          <div className="alert alert-error rounded-2xl flex items-start gap-4 p-5">
            <XCircle className="w-6 h-6 text-error mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Application Rejected</h4>
              <p className="text-xs text-error-content/90 mt-1 font-medium italic">
                "{request.rejection_reason}"
              </p>
              <p className="text-[10px] text-error-content/60 mt-3 font-semibold uppercase">
                Click Amend Request to return it to draft.
              </p>
            </div>
          </div>
        )}

        {/* Details Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-6">
              <h3 className="text-lg font-bold Outfit border-b border-base-content/5 pb-3">Request Overview</h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs">
                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Applicant</span>
                  <div className="flex items-center gap-1.5 font-bold text-base-content mt-1">
                    <User className="w-4 h-4 text-secondary shrink-0" />
                    <span>{request.requester_name}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Leave Duration</span>
                  <div className="flex items-center gap-1.5 font-bold text-base-content mt-1">
                    <Clock className="w-4 h-4 text-secondary shrink-0" />
                    <span>
                      {request.working_days_requested} working {request.working_days_requested === '1.0' || request.working_days_requested === 0.5 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Date Span</span>
                  <div className="flex items-center gap-1.5 font-bold text-base-content mt-1">
                    <Calendar className="w-4 h-4 text-secondary shrink-0" />
                    <span className="truncate">
                      {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {request.is_half_day && (
                <div className="bg-base-300/30 p-3 rounded-xl border border-base-content/5 text-xs font-semibold">
                  <span className="text-secondary">⚠️ Half Day Request:</span> Morning/Afternoon session ({request.half_day_period})
                </div>
              )}

              {request.delegate_name && (
                <div className="space-y-1 border-t border-base-content/5 pt-4">
                  <span className="text-xs text-base-content/40 uppercase font-bold tracking-wider">Duty Handover delegate</span>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-base-content mt-1">
                    <UserCheck className="w-4.5 h-4.5 text-secondary" />
                    <span>{request.delegate_name}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-base-content/5 pt-4">
                <span className="text-xs text-base-content/40 uppercase font-bold tracking-wider">Reason for Leave</span>
                <p className="text-sm text-base-content/85 leading-relaxed bg-base-300/20 p-4 rounded-xl border border-base-content/5 mt-1">
                  {request.reason}
                </p>
              </div>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-5">
              <h3 className="text-base font-bold Outfit">Workflow Timeline</h3>

              <div className="relative border-l border-base-content/10 pl-5 ml-2.5 space-y-6 text-xs text-left">
                {/* 1. Draft */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['draft', 'pending_tl_approval', 'pending_ceo_approval', 'approved', 'rejected', 'cancelled'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {['draft', 'pending_tl_approval', 'pending_ceo_approval', 'approved', 'rejected', 'cancelled'].indexOf(request.state) >= 0 && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Request Initiated</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Created in draft mode</p>
                  </div>
                </div>

                {/* 2. Submitted */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['pending_tl_approval', 'pending_ceo_approval', 'approved'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : request.state === 'cancelled'
                      ? 'bg-base-300 border-base-content/20'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {['pending_tl_approval', 'pending_ceo_approval', 'approved'].indexOf(request.state) >= 0 && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Submitted</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Pending Team Lead review</p>
                  </div>
                </div>

                {/* 3. Approved */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    request.state === 'approved'
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {request.state === 'approved' && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Approved</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Days deducted from balance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL: Rejection Reason */}
        {showRejectModal && (
          <div className="modal modal-open">
            <div className="modal-box rounded-2xl glass-panel border border-base-content/10 p-6 max-w-md">
              <h3 className="font-bold text-lg Outfit text-base-content flex items-center gap-2">
                <XCircle className="w-6 h-6 text-error" />
                Reject Leave Request
              </h3>
              <p className="text-xs text-base-content/50 mt-1">
                Please enter a detailed reason for rejecting this leave application. This is visible to the employee.
              </p>
              
              <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
                <div>
                  <textarea
                    rows={4}
                    className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm focus:border-error"
                    placeholder="State rejection reason..."
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
                    disabled={rejectMutation.isPending}
                    className="btn btn-error rounded-xl font-bold text-xs"
                  >
                    {rejectMutation.isPending ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      'Reject Request'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default LeaveDetailPage;
