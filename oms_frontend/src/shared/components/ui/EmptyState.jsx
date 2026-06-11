import { Inbox } from 'lucide-react';

/**
 * Reusable EmptyState card.
 * 
 * @param {string} title - Heading message
 * @param {string} message - Description message
 * @param {React.Component} icon - Lucide icon component to show
 * @param {string} actionLabel - Button label
 * @param {function} onAction - Button click callback
 */
export function EmptyState({ 
  title = 'No records found', 
  message = 'There are no items to show at the moment.', 
  icon: Icon = Inbox, 
  actionLabel, 
  onAction 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl glass-panel min-h-[280px]">
      <div className="bg-base-300 p-4 rounded-xl mb-4 border border-base-content/5 flex items-center justify-center">
        <Icon className="w-8 h-8 text-base-content/30" />
      </div>
      <h3 className="text-base font-bold text-base-content Outfit">
        {title}
      </h3>
      <p className="text-xs font-medium text-base-content/40 max-w-xs mt-2 leading-relaxed">
        {message}
      </p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="btn btn-primary btn-sm mt-6 rounded-lg font-bold text-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
export default EmptyState;
