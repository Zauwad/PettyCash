import { STATE_LABELS, STATE_BADGE_CLASSES } from '@/shared/constants/states';

/**
 * StatusBadge component to display color-coded status labels for requests.
 * 
 * @param {string} state - The current workflow state of the request
 */
export function StatusBadge({ state }) {
  const label = STATE_LABELS[state] || state;
  const badgeClass = STATE_BADGE_CLASSES[state] || 'badge-ghost';

  return (
    <span className={`badge ${badgeClass} font-bold py-2.5 px-3 rounded-lg border-0 text-xs`}>
      {label}
    </span>
  );
}
export default StatusBadge;
