import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pettyCashApi } from '../api/pettyCashApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Building, 
  AlertCircle, 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Ban,
  Wallet,
  Coins,
  Send,
  MessageSquare,
  Eye
} from 'lucide-react';

export function PettyCashDetailPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.profile?.role || user?.role;

  // Active attachment preview
  const [activePreview, setActivePreview] = useState(null);

  // Rejection reason input state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Disbursement modal input states
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disburseAmount, setDisburseAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [refNumber, setRefNumber] = useState('');
  const [disburseNotes, setDisburseNotes] = useState('');

  // Query: Requisition details
  const { data: request, isLoading, isError } = useQuery({
    queryKey: ['petty-cash-detail', uuid],
    queryFn: () => pettyCashApi.get(uuid),
  });

  const queryParams = {
    queryKey: ['petty-cash-detail', uuid],
  };

  // Mutation: Submit Request
  const submitMutation = useMutation({
    mutationFn: () => pettyCashApi.submit(uuid),
    onSuccess: () => {
      toast.success('Requisition submitted for approval!');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to submit request.');
    }
  });

  // Mutation: Approve Request (Manager / CEO)
  const approveMutation = useMutation({
    mutationFn: (amount) => pettyCashApi.approve(uuid, amount),
    onSuccess: () => {
      toast.success('Request approved successfully!');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to approve request.');
    }
  });

  // Mutation: Reject Request
  const rejectMutation = useMutation({
    mutationFn: (reason) => pettyCashApi.reject(uuid, reason),
    onSuccess: () => {
      toast.success('Request rejected.');
      setShowRejectModal(false);
      setRejectionReason('');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject request.');
    }
  });

  // Mutation: Amend Request
  const amendMutation = useMutation({
    mutationFn: () => pettyCashApi.amend(uuid),
    onSuccess: () => {
      toast.success('Requisition returned to draft.');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to amend request.');
    }
  });

  // Mutation: Cancel Request
  const cancelMutation = useMutation({
    mutationFn: () => pettyCashApi.cancel(uuid),
    onSuccess: () => {
      toast.success('Requisition cancelled.');
      queryClient.invalidateQueries(queryParams);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to cancel request.');
    }
  });

  // Mutation: Payout Disbursement
  const disburseMutation = useMutation({
    mutationFn: (data) => pettyCashApi.disburse(uuid, data),
    onSuccess: () => {
      toast.success('Payout disbursed successfully!');
      setShowDisburseModal(false);
      setDisburseAmount('');
      setRefNumber('');
      setDisburseNotes('');
      queryClient.invalidateQueries(queryParams);
      queryClient.invalidateQueries({ queryKey: ['petty-cash-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to process disbursement.');
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 skeleton rounded"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-44 w-full skeleton rounded-2xl"></div>
            <div className="h-48 w-full skeleton rounded-2xl"></div>
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
          <h4 className="font-bold text-sm">Failed to retrieve requisition details</h4>
          <p className="text-xs text-error-content/80 mt-1">Requisition record may have been deleted, or you do not have permission to view it.</p>
          <Link to="/petty-cash" className="btn btn-sm btn-outline btn-error mt-4 rounded-lg">
            Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  // Authorization checks
  const isOwner = request.requester_email === user.email;
  const isPendingTL = request.state === 'pending_tl_approval';
  const isPendingCEO = request.state === 'pending_ceo_approval';
  const isApproved = request.state === 'approved';
  const isPartiallyDisbursed = request.state === 'partially_disbursed';
  const isAccounts = ['ADMIN', 'CEO'].includes(role);

  // Can the current user approve this request?
  const deptId = user?.profile?.department?.id;
  const requestDeptId = request.department_details?.id;
  const isSameDept = deptId === requestDeptId;
  const canApprove = (isPendingTL && isSameDept && role === 'TEAM_LEAD') || 
                      (isPendingCEO && role === 'CEO');

  const handleApprove = () => {
    approveMutation.mutate(request.amount_requested);
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    rejectMutation.mutate(rejectionReason);
  };

  const handleDisburseSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(disburseAmount);
    const maxDisburse = parseFloat(request.amount_approved) - parseFloat(request.amount_disbursed);

    if (isNaN(amount) || amount <= 0 || amount > maxDisburse) {
      toast.error(`Please enter a valid amount between ৳0.01 and ৳${maxDisburse.toLocaleString()}`);
      return;
    }

    disburseMutation.mutate({
      amount,
      payment_method: paymentMethod,
      reference_number: refNumber,
      notes: disburseNotes
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Back Link */}
        <Link to="/petty-cash" className="btn btn-ghost btn-xs text-base-content/60 hover:text-primary rounded-md gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Requisitions
        </Link>

        {/* Page title and state controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-200/50 p-6 rounded-2xl border border-base-content/5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-extrabold Outfit text-base-content">{request.title}</h2>
              <StatusBadge state={request.state} />
            </div>
            <p className="text-xs text-base-content/50 font-bold uppercase tracking-wider">
              Requisition Ref: #{request.id} · Created on {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* FSM Control Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Requester Actions */}
            {isOwner && request.state === 'draft' && (
              <>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="btn btn-primary btn-sm rounded-xl font-bold gap-1 text-xs"
                >
                  <Send className="w-4 h-4" />
                  Submit Voucher
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
                className="btn btn-outline border-base-content/10 hover:bg-primary/5 rounded-xl font-bold gap-1.5 text-xs"
              >
                <RotateCcw className="w-4 h-4" />
                Amend Requisition
              </button>
            )}

            {/* Approver Actions */}
            {canApprove && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="btn btn-success text-success-content btn-sm rounded-xl font-bold gap-1 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Requisition
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn btn-error text-error-content btn-sm rounded-xl font-bold gap-1 text-xs"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Requisition
                </button>
              </>
            )}

            {/* Accounts/Admin Payout Actions */}
            {(isApproved || isPartiallyDisbursed) && isAccounts && (
              <button
                onClick={() => {
                  const remaining = parseFloat(request.amount_approved) - parseFloat(request.amount_disbursed);
                  setDisburseAmount(remaining.toString());
                  setShowDisburseModal(true);
                }}
                className="btn btn-primary btn-sm rounded-xl font-bold gap-1.5 text-xs shadow-lg shadow-primary/20 animate-pulse"
              >
                <Coins className="w-4 h-4" />
                Disburse Payout
              </button>
            )}
          </div>
        </div>

        {/* Rejection Alert */}
        {request.state === 'rejected' && request.rejection_reason && (
          <div className="alert alert-error rounded-2xl flex items-start gap-4 p-5">
            <XCircle className="w-6 h-6 text-error mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Requisition Rejected</h4>
              <p className="text-xs text-error-content/90 mt-1 font-medium italic">
                "{request.rejection_reason}"
              </p>
              <p className="text-[10px] text-error-content/60 mt-3 font-semibold uppercase">
                Click Amend above to reset this requisition and edit its item details.
              </p>
            </div>
          </div>
        )}

        {/* Main Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Requisition Details & Line items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metadata Card */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5">
              <h3 className="text-lg font-bold Outfit border-b border-base-content/5 pb-3">Voucher Specifications</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Requester</span>
                  <div className="flex items-center gap-1.5 font-bold text-base-content mt-1">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <span>{request.requester_name}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Department</span>
                  <div className="flex items-center gap-1.5 font-bold text-base-content mt-1">
                    <Building className="w-4 h-4 text-primary shrink-0" />
                    <span>{request.department_details?.name}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Needed By</span>
                  <div className="flex items-center gap-1.5 font-bold text-base-content mt-1">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>{new Date(request.needed_by).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Priority</span>
                  <div className="flex items-center mt-1">
                    <span className={`badge border-0 font-bold px-2.5 rounded text-[10px] ${
                      request.priority === 'URGENT' 
                        ? 'bg-error/15 text-error' 
                        : request.priority === 'HIGH'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-base-300 text-base-content/60'
                    }`}>
                      {request.priority}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-base-content/5 pt-4">
                <span className="text-xs text-base-content/40 uppercase font-bold tracking-wider">Purpose Description</span>
                <p className="text-sm text-base-content/85 leading-relaxed bg-base-300/20 p-4 rounded-xl border border-base-content/5 mt-1">
                  {request.description}
                </p>
              </div>
            </div>

            {/* Line Items Card */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-lg font-bold Outfit">Itemized Requisitions</h3>

              <div className="overflow-x-auto w-full">
                <table className="table w-full">
                  <thead>
                    <tr className="border-b border-base-content/5">
                      <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Description</th>
                      <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3">Category</th>
                      <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3 text-right">Qty</th>
                      <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3 text-right">Unit Price</th>
                      <th className="bg-transparent text-base-content/40 font-bold text-xs uppercase px-2 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.line_items?.map((item) => (
                      <tr key={item.id} className="hover:bg-base-content/2 border-b border-base-content/5 transition-colors">
                        <td className="font-semibold text-sm px-2 py-4">{item.description}</td>
                        <td className="text-xs text-base-content/60 px-2 py-4">
                          <span className="bg-base-300 px-2.5 py-1 rounded-full border border-base-content/5">
                            {item.category}
                          </span>
                        </td>
                        <td className="text-sm px-2 py-4 text-right">{item.quantity}</td>
                        <td className="text-sm px-2 py-4 text-right">৳{parseFloat(item.unit_price).toLocaleString()}</td>
                        <td className="font-bold text-sm text-primary px-2 py-4 text-right">
                          ৳{parseFloat(item.total_price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attachments Card */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-lg font-bold Outfit">Receipt Attachments</h3>

              {request.attachments?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {request.attachments.map((file) => {
                    const isImage = file.content_type.startsWith('image/');
                    return (
                      <div 
                        key={file.id} 
                        className="flex flex-col bg-base-300/40 p-4 rounded-xl border border-base-content/5 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-5 h-5 text-primary shrink-0" />
                            <div className="overflow-hidden">
                              <h4 className="font-bold truncate max-w-[140px]">{file.original_filename}</h4>
                              <p className="text-[9px] text-base-content/40 font-semibold uppercase mt-0.5">
                                {file.content_type.split('/')[1]} · {(file.file_size_bytes / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setActivePreview(file)}
                              className="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                              title="Preview inline"
                            >
                              <Eye className="w-4.5 h-4.5" />
                            </button>
                            <a 
                              href={file.download_url} 
                              download 
                              className="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                            >
                              <Download className="w-4.5 h-4.5" />
                            </a>
                          </div>
                        </div>

                        {/* Mini thumbnail if image */}
                        {isImage && (
                          <div className="mt-3 overflow-hidden rounded-lg border border-base-content/10 h-28 bg-base-100 flex items-center justify-center cursor-pointer" onClick={() => setActivePreview(file)}>
                            <img 
                              src={file.download_url} 
                              alt={file.original_filename} 
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 border border-dashed border-base-content/10 rounded-2xl text-xs text-base-content/40 font-medium">
                  No attachments uploaded for this requisition.
                </div>
              )}

              {/* Inline active preview overlay */}
              {activePreview && (
                <div className="border border-base-content/10 p-4 rounded-xl bg-base-200/60 relative">
                  <button 
                    onClick={() => setActivePreview(null)}
                    className="btn btn-ghost btn-circle btn-sm absolute top-3 right-3 text-base-content/60"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                  <h4 className="text-xs font-bold text-base-content mb-3 truncate pr-10">Previewing: {activePreview.original_filename}</h4>
                  
                  {activePreview.content_type.startsWith('image/') ? (
                    <div className="flex items-center justify-center bg-base-100 rounded-lg p-2 max-h-96 overflow-hidden border border-base-content/10">
                      <img 
                        src={activePreview.download_url} 
                        alt="receipt preview" 
                        className="object-contain max-h-80"
                      />
                    </div>
                  ) : activePreview.content_type === 'application/pdf' ? (
                    <iframe 
                      src={activePreview.download_url} 
                      className="w-full h-[450px] rounded-lg border border-base-content/10 bg-white"
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-base-content/40 font-medium bg-base-100 rounded-lg">
                      Inline preview is not supported for this file type. Please click the download icon to save it locally.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar details: budget summary + timeline */}
          <div className="space-y-6">
            {/* Cash totals card */}
            <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-base font-bold Outfit">Requisition Financials</h3>

              <div className="space-y-4 pt-2">
                <div className="space-y-2 border-b border-base-content/5 pb-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-base-content/40 uppercase">Requested</span>
                    <span className="font-bold text-sm">৳{parseFloat(request.amount_requested).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-base-content/40 uppercase">Approved Limit</span>
                    <span className="font-bold text-sm text-success">৳{parseFloat(request.amount_approved).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-base-content/40 uppercase">Paid Out</span>
                    <span className="font-bold text-sm text-primary">৳{parseFloat(request.amount_disbursed).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-base-content/50 uppercase">Disbursement Progress</span>
                  <span>
                    {((parseFloat(request.amount_disbursed) / (parseFloat(request.amount_approved) || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
                <progress 
                  className="progress progress-primary w-full h-2 rounded-full" 
                  value={parseFloat(request.amount_disbursed)} 
                  max={parseFloat(request.amount_approved) || 1}
                ></progress>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-5">
              <h3 className="text-base font-bold Outfit">Process Pipeline</h3>

              <div className="relative border-l border-base-content/10 pl-5 ml-2.5 space-y-6 text-xs text-left">
                {/* 1. Draft */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['draft', 'pending_tl_approval', 'pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed', 'rejected', 'cancelled'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {['draft', 'pending_tl_approval', 'pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed', 'rejected', 'cancelled'].indexOf(request.state) >= 0 && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Voucher Created</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Created in draft mode</p>
                  </div>
                </div>

                {/* 2. Submitted */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['pending_tl_approval', 'pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : request.state === 'cancelled'
                      ? 'bg-base-300 border-base-content/20'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {['pending_tl_approval', 'pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed'].indexOf(request.state) >= 0 && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Submitted for Approval</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Pending Team Lead routing</p>
                  </div>
                </div>

                {/* 3. CEO Escalation (Optional) */}
                {request.amount_approved > request.department_details?.tl_approval_limit && (
                  <div className="relative">
                    <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                      ['pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed'].includes(request.state)
                        ? 'bg-success border-success text-success-content'
                        : 'bg-base-200 border-base-content/20'
                    }`}>
                      {['pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed'].indexOf(request.state) >= 0 && '✓'}
                    </div>
                    <div>
                      <h4 className="font-bold text-base-content">Escalated to CEO</h4>
                      <p className="text-[10px] text-base-content/40 mt-0.5">Amount above TL threshold</p>
                    </div>
                  </div>
                )}

                {/* 4. Approved */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['approved', 'partially_disbursed', 'disbursed'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {['approved', 'partially_disbursed', 'disbursed'].indexOf(request.state) >= 0 && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Voucher Approved</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Cleared for cash payouts</p>
                  </div>
                </div>

                {/* 5. Disbursed */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    request.state === 'disbursed'
                      ? 'bg-success border-success text-success-content'
                      : request.state === 'partially_disbursed'
                      ? 'bg-accent border-accent text-accent-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {request.state === 'disbursed' && '✓'}
                    {request.state === 'partially_disbursed' && '◷'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Disbursed Payout</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Voucher locked, paid out</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payout History timeline */}
            {request.disbursements?.length > 0 && (
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-base font-bold Outfit">Disbursement Journal</h3>

                <div className="space-y-4 text-xs">
                  {request.disbursements.map((d) => (
                    <div key={d.id} className="p-3 bg-base-300/30 rounded-xl border border-base-content/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-primary text-sm">৳{parseFloat(d.amount).toLocaleString()}</span>
                          <span className="block text-[10px] text-base-content/40 font-semibold uppercase mt-0.5">
                            Method: {d.payment_method}
                          </span>
                        </div>
                        <span className="text-[9px] text-base-content/50 font-bold bg-base-300 px-2 py-0.5 rounded">
                          {new Date(d.disbursed_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {d.reference_number && (
                        <p className="text-[10px] font-bold text-base-content/75 truncate">
                          Ref: {d.reference_number}
                        </p>
                      )}
                      
                      {d.notes && (
                        <p className="text-[10px] text-base-content/60 leading-normal italic mt-1 bg-base-100 p-2 rounded">
                          "{d.notes}"
                        </p>
                      )}
                      
                      <p className="text-[9px] text-base-content/40 font-bold text-right">
                        Issued by: {d.disbursed_by_name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: Rejection Reason */}
        {showRejectModal && createPortal(
          <div className="modal modal-open">
            <div className="modal-box rounded-2xl glass-panel border border-base-content/10 p-6 max-w-md">
              <h3 className="font-bold text-lg Outfit text-base-content flex items-center gap-2">
                <XCircle className="w-6 h-6 text-error" />
                Reject Requisition
              </h3>
              <p className="text-xs text-base-content/50 mt-1">
                Please provide a detailed justification for rejecting this voucher. This explanation will be visible to the requester.
              </p>
              
              <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
                <div>
                  <textarea
                    rows={4}
                    className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm focus:border-error"
                    placeholder="Provide a clear rejection reason..."
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
                      'Reject Voucher'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* MODAL: Payout Disbursement */}
        {showDisburseModal && createPortal(
          <div className="modal modal-open">
            <div className="modal-box rounded-2xl glass-panel border border-base-content/10 p-6 max-w-md">
              <h3 className="font-bold text-lg Outfit text-base-content flex items-center gap-2">
                <Coins className="w-6 h-6 text-primary" />
                Log Cash Disbursement
              </h3>
              <p className="text-xs text-base-content/50 mt-1">
                Specify payout parameters to record the cash release. This locks the request balance.
              </p>

              <form onSubmit={handleDisburseSubmit} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Disbursement Amount (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                    value={disburseAmount}
                    onChange={(e) => setDisburseAmount(e.target.value)}
                    required
                  />
                  <span className="text-[10px] text-base-content/40 mt-1 block">
                    Remaining limit: ৳{(parseFloat(request.amount_approved) - parseFloat(request.amount_disbursed)).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Payment Method</label>
                    <select
                      className="select select-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">CASH</option>
                      <option value="BANK_TRANSFER">BANK TRANSFER</option>
                      <option value="CHEQUE">CHEQUE</option>
                    </select>
                  </div>

                  <div>
                    <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Reference No.</label>
                    <input
                      type="text"
                      className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                      placeholder="e.g. TXN-12345"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Journal Notes</label>
                  <textarea
                    rows={2}
                    className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                    placeholder="Optional details (e.g. paid in hand to employee)..."
                    value={disburseNotes}
                    onChange={(e) => setDisburseNotes(e.target.value)}
                  />
                </div>

                <div className="modal-action">
                  <button 
                    type="button" 
                    onClick={() => { setShowDisburseModal(false); }} 
                    className="btn btn-ghost rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={disburseMutation.isPending}
                    className="btn btn-primary rounded-xl font-bold text-xs"
                  >
                    {disburseMutation.isPending ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      'Record Payout'
                    )}
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

export default PettyCashDetailPage;
