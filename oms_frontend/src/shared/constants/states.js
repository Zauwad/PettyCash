// Request workflow states used in Petty Cash & Leave requests
export const STATES = {
  DRAFT: 'draft',
  PENDING_TL: 'pending_tl_approval',
  PENDING_GM: 'pending_gm_approval',
  PENDING_CEO: 'pending_ceo_approval',
  PENDING_HR_DISBURSEMENT: 'pending_hr_disbursement',
  APPROVED: 'approved',
  PARTIALLY_DISBURSED: 'partially_disbursed',
  DISBURSED: 'disbursed',
  REJECTED: 'rejected',
  REJECTED_BY_CEO: 'rejected_by_ceo',
  CANCELLED: 'cancelled',
};

// Friendly labels for request states
export const STATE_LABELS = {
  [STATES.DRAFT]: 'Draft',
  [STATES.PENDING_TL]: 'Pending Lead Approval',
  [STATES.PENDING_GM]: 'Pending GM Approval',
  [STATES.PENDING_CEO]: 'Pending CEO Approval',
  [STATES.PENDING_HR_DISBURSEMENT]: 'Pending Payout',
  [STATES.APPROVED]: 'Approved',
  [STATES.PARTIALLY_DISBURSED]: 'Partially Disbursed',
  [STATES.DISBURSED]: 'Disbursed',
  [STATES.REJECTED]: 'Rejected',
  [STATES.REJECTED_BY_CEO]: 'CEO Rejected',
  [STATES.CANCELLED]: 'Cancelled',
};

// CSS color badge mappings (using DaisyUI badge classes)
export const STATE_BADGE_CLASSES = {
  [STATES.DRAFT]: 'badge-ghost border-base-content/20',
  [STATES.PENDING_TL]: 'badge-info gap-1 animate-pulse',
  [STATES.PENDING_GM]: 'badge-info gap-1 animate-pulse',
  [STATES.PENDING_CEO]: 'badge-warning gap-1 animate-pulse',
  [STATES.PENDING_HR_DISBURSEMENT]: 'badge-warning gap-1',
  [STATES.APPROVED]: 'badge-success text-success-content',
  [STATES.PARTIALLY_DISBURSED]: 'badge-accent text-accent-content',
  [STATES.DISBURSED]: 'badge-success text-success-content',
  [STATES.REJECTED]: 'badge-error text-error-content',
  [STATES.REJECTED_BY_CEO]: 'badge-error text-error-content',
  [STATES.CANCELLED]: 'badge-neutral',
};
