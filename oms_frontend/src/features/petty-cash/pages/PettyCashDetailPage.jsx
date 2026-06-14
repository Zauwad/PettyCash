import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pettyCashApi } from '../api/pettyCashApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { toast } from 'sonner';
import { Select } from '@/shared/components/ui/Select';
import { Badge } from '@/components/ui/badge';

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
  Coins,
  Send,
  Eye,
  X,
  History
} from 'lucide-react';

export function PettyCashDetailPage() {
  const { uuid } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.profile?.role || user?.role;

  // Active attachment preview
  const [activePreview, setActivePreview] = useState(null);

  // Rejection reason input state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Approval modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveNeededBy, setApproveNeededBy] = useState('');
  const [approvePriority, setApprovePriority] = useState('MEDIUM');
  const [approveNote, setApproveNote] = useState('');

  // Resubmit inline form states
  const [resubmitAmount, setResubmitAmount] = useState('');
  const [resubmitNeededBy, setResubmitNeededBy] = useState('');

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

  const invalidatePettyCash = () => {
    queryClient.invalidateQueries(queryParams);
    ['pending-petty-cash', 'petty-cash-list', 'analytics-summary', 'analytics-spending-trends', 'analytics-burn-rate', 'dashboard-petty-cash', 'dashboard-activities'].forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  // Pre-fill states when request is loaded
  useEffect(() => {
    if (request) {
      setResubmitAmount(request.amount_requested);
      setResubmitNeededBy(request.needed_by);
      setApproveAmount(request.amount_approved && parseFloat(request.amount_approved) > 0 ? request.amount_approved : request.amount_requested);
      setApproveNeededBy(request.needed_by);
      setApprovePriority(request.priority);
    }
  }, [request]);

  // Mutation: Submit Request
  const submitMutation = useMutation({
    mutationFn: () => pettyCashApi.submit(uuid),
    onSuccess: () => {
      toast.success('Requisition submitted for approval!');
      invalidatePettyCash();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to submit request.');
    }
  });

  // Mutation: Approve Request (Manager / CEO)
  const approveMutation = useMutation({
    mutationFn: (data) => pettyCashApi.approve(uuid, data),
    onSuccess: () => {
      toast.success('Request approved successfully!');
      setShowApproveModal(false);
      setApproveNote('');
      invalidatePettyCash();
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
      invalidatePettyCash();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject request.');
    }
  });

  // Mutation: Resubmit Request (from rejected_by_ceo fallback)
  const resubmitMutation = useMutation({
    mutationFn: (data) => pettyCashApi.resubmit(uuid, data),
    onSuccess: () => {
      toast.success('Voucher resubmitted directly to CEO!');
      invalidatePettyCash();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to resubmit request.');
    }
  });

  // Mutation: Amend Request
  const amendMutation = useMutation({
    mutationFn: () => pettyCashApi.amend(uuid),
    onSuccess: () => {
      toast.success('Requisition returned to draft.');
      invalidatePettyCash();
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
      invalidatePettyCash();
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
      invalidatePettyCash();
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
  const isPendingHR = request.state === 'pending_hr_disbursement';
  const isPartiallyDisbursed = request.state === 'partially_disbursed';
  
  const isCEO = role === 'CEO' || role === 'ADMIN';
  const isTL = role === 'TEAM_LEAD';
  const isHR = role === 'HR' || role === 'ADMIN';

  // Can current user approve?
  const canApprove = (isPendingTL && isTL) || 
                      (isPendingCEO && isCEO) ||
                      (['draft', 'pending_tl_approval', 'pending_ceo_approval'].includes(request.state) && isCEO);

  // Can current user reject?
  const canReject = (isPendingTL && (isTL || isCEO)) || 
                     (isPendingCEO && isCEO);

  // Can current user disburse?
  const canDisburse = (isPendingHR || isPartiallyDisbursed) && isHR;

  const handleApproveSubmit = (e) => {
    e.preventDefault();
    if (!approveNote.trim()) {
      toast.error('Approval note is required.');
      return;
    }
    const payload = {
      note: approveNote,
      amount: parseFloat(approveAmount),
    };
    if (!isCEO) {
      payload.needed_by = approveNeededBy;
      payload.priority = approvePriority;
    }
    approveMutation.mutate(payload);
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    rejectMutation.mutate(rejectionReason);
  };

  const handleResubmitSubmit = (e) => {
    e.preventDefault();
    if (!resubmitAmount || !resubmitNeededBy) {
      toast.error('Amount and date are required.');
      return;
    }
    resubmitMutation.mutate({
      amount: parseFloat(resubmitAmount),
      needed_by: resubmitNeededBy
    });
  };

  const handleDisburseSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(disburseAmount);
    const maxDisburse = parseFloat(request.amount_approved) - parseFloat(request.amount_disbursed);

    if (isNaN(amount) || amount <= 0 || amount > maxDisburse) {
      toast.error(`Please enter a valid amount between ৳0.01 and ৳${maxDisburse.toLocaleString()}`);
      return;
    }

    if (!disburseNotes.trim()) {
      toast.error('Disbursement note is required.');
      return;
    }

    disburseMutation.mutate({
      amount,
      payment_method: paymentMethod,
      reference_number: refNumber,
      note: disburseNotes
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6 text-left">
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
              <button
                onClick={() => setShowApproveModal(true)}
                className="btn btn-success text-success-content btn-sm rounded-xl font-bold gap-1 text-xs"
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
                Approve Requisition
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="btn btn-error text-error-content btn-sm rounded-xl font-bold gap-1 text-xs"
              >
                <XCircle className="w-4.5 h-4.5" />
                Reject Requisition
              </button>
            )}

            {/* Accounts/Admin Payout Actions */}
            {canDisburse && (
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

        {/* CEO Rejection Alert / Fallback form */}
        {request.state === 'rejected_by_ceo' && (
          <div className="space-y-4">
            <div className="alert alert-error rounded-2xl flex items-start gap-4 p-5">
              <XCircle className="w-6 h-6 text-error mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Voucher Rejected by CEO</h4>
                <p className="text-xs text-error-content/90 mt-1 font-medium italic text-left">
                  "{request.rejection_reason}"
                </p>
              </div>
            </div>

            {isOwner && (
              <div className="glass-panel p-6 rounded-2xl shadow-xl border border-warning/20 bg-warning/5 space-y-4">
                <h4 className="font-bold text-sm text-warning flex items-center gap-1.5">
                  <AlertCircle className="w-5 h-5" />
                  Fallback Correction Form
                </h4>
                <p className="text-xs text-base-content/70">
                  Please update the requisition parameters below. Re-submitting will route the request directly back to the CEO.
                </p>
                <form onSubmit={handleResubmitSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-base-content/60">Adjusted Voucher Amount (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-xs focus:border-warning"
                      value={resubmitAmount}
                      onChange={(e) => setResubmitAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-base-content/60">Needed By Date</label>
                    <input
                      type="date"
                      className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-xs focus:border-warning"
                      value={resubmitNeededBy}
                      onChange={(e) => setResubmitNeededBy(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 mt-2">
                    <button
                      type="submit"
                      disabled={resubmitMutation.isPending}
                      className="btn btn-warning text-warning-content btn-sm rounded-xl font-bold text-xs"
                    >
                      {resubmitMutation.isPending ? 'Resubmitting...' : 'Resubmit to CEO'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TL Rejection Alert */}
        {request.state === 'rejected' && request.rejection_reason && (
          <div className="alert alert-error rounded-2xl flex items-start gap-4 p-5 text-left">
            <XCircle className="w-6 h-6 text-error mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Requisition Rejected</h4>
              <p className="text-xs text-error-content/90 mt-1 font-medium italic">
                "{request.rejection_reason}"
              </p>
              <p className="text-[10px] text-error-content/60 mt-3 font-semibold uppercase">
                Click Amend Requisition to reset it to draft.
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
                    <Badge 
                      variant={
                        request.priority === 'URGENT' || request.priority === 'HIGH'
                          ? 'destructive' 
                          : request.priority === 'MEDIUM'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="font-bold text-[10px] px-2 py-0.5 rounded"
                    >
                      {request.priority}
                    </Badge>
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
                        <div className="flex items-start justify-between gap-2 text-xs text-left">
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
                    ['draft', 'pending_tl_approval', 'pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed', 'disbursed', 'rejected', 'rejected_by_ceo', 'cancelled'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Voucher Created</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Created in draft mode</p>
                  </div>
                </div>

                {/* 2. Submitted */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed', 'disbursed'].includes(request.state) || !!request.tl_approval_note
                      ? 'bg-success border-success text-success-content'
                      : request.state === 'cancelled'
                      ? 'bg-base-300 border-base-content/20'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {(['pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed', 'disbursed'].includes(request.state) || !!request.tl_approval_note) && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Team Lead Approval</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">TL reviews and sets priority/amounts</p>
                  </div>
                </div>

                {/* 3. CEO Approval */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['pending_hr_disbursement', 'partially_disbursed', 'disbursed'].includes(request.state) || !!request.ceo_approval_note
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {(['pending_hr_disbursement', 'partially_disbursed', 'disbursed'].includes(request.state) || !!request.ceo_approval_note) && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">CEO Approval</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">CEO approval required for payout routing</p>
                  </div>
                </div>

                {/* 4. Pending Disbursement */}
                <div className="relative">
                  <div className={`absolute top-0.5 -left-[27px] w-4 h-4 rounded-full border-2 flex items-center justify-center font-bold ${
                    ['pending_hr_disbursement', 'partially_disbursed', 'disbursed'].includes(request.state)
                      ? 'bg-success border-success text-success-content'
                      : 'bg-base-200 border-base-content/20'
                  }`}>
                    {['pending_hr_disbursement', 'partially_disbursed', 'disbursed'].includes(request.state) && '✓'}
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Pending Payout</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Approved, waiting for HR disbursement</p>
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
                    <h4 className="font-bold text-base-content">Disbursed</h4>
                    <p className="text-[10px] text-base-content/40 mt-0.5">Paid out and locked</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity History Logs */}
            {request.activity_log && request.activity_log.length > 0 && (
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-base font-bold Outfit flex items-center gap-2">
                  <History className="w-5 h-5 text-secondary" />
                  Activity History
                </h3>
                <div className="space-y-4 text-xs">
                  {request.activity_log.map((log) => (
                    <div key={log.id} className="flex gap-3 text-xs border-b border-base-content/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex-1 space-y-1 text-left">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-base-content">
                            {log.action} by {log.actor_name || log.actor_username || 'System'}
                          </span>
                          <span className="text-[10px] text-base-content/40">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.old_state && log.new_state && (
                          <div className="text-[10px] text-base-content/60">
                            Transition: <span className="font-semibold">{log.old_state}</span> → <span className="font-semibold text-secondary">{log.new_state}</span>
                          </div>
                        )}
                        {log.reason && (
                          <p className="text-xs italic text-base-content/70 mt-1 bg-base-300/20 p-2 rounded-lg border border-base-content/5">
                            "{log.reason}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payout History timeline */}
            {request.disbursements?.length > 0 && (
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-base font-bold Outfit">Disbursement Journal</h3>

                <div className="space-y-4 text-xs">
                  {request.disbursements.map((d) => (
                    <div key={d.id} className="p-3 bg-base-300/30 rounded-xl border border-base-content/5 space-y-2">
                      <div className="flex justify-between items-start text-left">
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
                        <p className="text-[10px] font-bold text-base-content/75 truncate text-left">
                          Ref: {d.reference_number}
                        </p>
                      )}
                      
                      {d.notes && (
                        <p className="text-[10px] text-base-content/60 leading-normal italic mt-1 bg-base-100 p-2 rounded text-left">
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

        {/* MODAL: Approve Requisition Modal */}
        {showApproveModal && createPortal(
          <div className="modal modal-open">
            <div className="modal-box rounded-2xl glass-panel border border-base-content/10 p-6 max-w-md">
              <h3 className="font-bold text-lg Outfit text-base-content flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-success" />
                Approve Requisition
              </h3>
              <p className="text-xs text-base-content/50 mt-1">
                {isCEO 
                  ? 'CEO direct approval requires setting the approved amount and note.' 
                  : 'Adjust request details before routing. Note is mandatory.'}
              </p>
              
              <form onSubmit={handleApproveSubmit} className="mt-4 space-y-4 text-xs text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Approved Amount (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm focus:border-success"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    required
                  />
                </div>

                {!isCEO && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Needed By Date</label>
                      <input
                        type="date"
                        className="input input-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-xs focus:border-success"
                        value={approveNeededBy}
                        onChange={(e) => setApproveNeededBy(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Priority</label>
                      <Select
                        value={approvePriority}
                        onChange={setApprovePriority}
                        options={[
                          { value: 'LOW', label: 'LOW' },
                          { value: 'MEDIUM', label: 'MEDIUM' },
                          { value: 'HIGH', label: 'HIGH' },
                          { value: 'URGENT', label: 'URGENT' },
                        ]}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Approval Note</label>
                  <textarea
                    rows={3}
                    className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm focus:border-success"
                    placeholder="Provide details about modifications or approvals..."
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-action">
                  <button 
                    type="button" 
                    onClick={() => { setShowApproveModal(false); setApproveNote(''); }} 
                    className="btn btn-ghost rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={approveMutation.isPending}
                    className="btn btn-success text-success-content rounded-xl font-bold text-xs"
                  >
                    {approveMutation.isPending ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      'Approve Voucher'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
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
                Please provide a detailed justification for rejecting this voucher. This explanation will be visible to the requester.
              </p>
              
              <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4 text-left">
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

              <form onSubmit={handleDisburseSubmit} className="mt-4 space-y-4 text-xs text-left">
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
                    <Select
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={[
                        { value: 'CASH', label: 'CASH' },
                        { value: 'BANK_TRANSFER', label: 'BANK TRANSFER' },
                        { value: 'CHEQUE', label: 'CHEQUE' },
                      ]}
                    />
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
                  <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Disbursement Reason / Notes</label>
                  <textarea
                    rows={2}
                    className="textarea textarea-bordered w-full rounded-xl bg-base-100 border-base-content/10 text-sm"
                    placeholder="Enter disbursement notes (mandatory)..."
                    value={disburseNotes}
                    onChange={(e) => setDisburseNotes(e.target.value)}
                    required
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
