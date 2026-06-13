import { STATE_LABELS, STATE_BADGE_CLASSES, STATES } from '@/shared/constants/states';
import { Badge } from '@/components/ui/badge';
import { Coins, Clock } from 'lucide-react';

/**
 * StatusBadge component to display color-coded status labels for requests.
 * Shows a static clock icon for pending approvals, and a static coin icon for pending payouts.
 * 
 * @param {string} state - The current workflow state of the request
 */
export function StatusBadge({ state }) {
  const label = STATE_LABELS[state] || state;
  const badgeClass = STATE_BADGE_CLASSES[state] || 'badge-ghost';
  
  const isApprovalPending = [
    STATES.PENDING_TL,
    STATES.PENDING_GM,
    STATES.PENDING_CEO
  ].includes(state);

  const isPayoutPending = state === STATES.PENDING_HR_DISBURSEMENT;

  return (
    <Badge 
      variant="ghost"
      className={`${badgeClass} font-bold py-1.5 px-3 rounded-lg border-0 text-xs gap-1.5 select-none`}
    >
      {isApprovalPending && <Clock className="w-3.5 h-3.5 text-current shrink-0" />}
      {isPayoutPending && <Coins className="w-3.5 h-3.5 text-current shrink-0" />}
      <span>{label}</span>
    </Badge>
  );
}

export default StatusBadge;

