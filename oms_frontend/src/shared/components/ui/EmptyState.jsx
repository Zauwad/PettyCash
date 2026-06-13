import { Inbox } from 'lucide-react';

const SVG_ILLUSTRATIONS = {
  wallet: (
    <svg className="w-28 h-28 text-primary animate-float-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="32" width="70" height="48" rx="10" className="fill-base-300/60 stroke-primary" strokeWidth="2" />
      <path d="M15 44H85" className="stroke-primary" strokeWidth="2" />
      <rect x="56" y="46" width="30" height="20" rx="5" className="fill-base-200 stroke-primary" strokeWidth="1.5" />
      <circle cx="71" cy="56" r="2.5" className="fill-primary" />
      {/* Floating Coins */}
      <circle cx="28" cy="18" r="4.5" className="fill-primary/20 stroke-primary animate-float-2" strokeWidth="1" />
      <circle cx="50" cy="12" r="5.5" className="fill-primary/30 stroke-primary animate-float-1" strokeWidth="1" />
      <circle cx="72" cy="22" r="4" className="fill-primary/25 stroke-primary animate-float-2" strokeWidth="1" />
    </svg>
  ),
  calendar: (
    <svg className="w-28 h-28 text-secondary animate-float-2" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="24" width="64" height="58" rx="12" className="fill-base-300/60 stroke-secondary" strokeWidth="2" />
      <line x1="18" y1="40" x2="82" y2="40" className="stroke-secondary" strokeWidth="2" />
      <rect x="28" y="14" width="6" height="14" rx="3" className="fill-secondary" />
      <rect x="66" y="14" width="6" height="14" rx="3" className="fill-secondary" />
      {/* Grid Dots */}
      <circle cx="32" cy="52" r="3" className="fill-secondary/20" />
      <circle cx="50" cy="52" r="3" className="fill-secondary/20" />
      <circle cx="68" cy="52" r="3" className="fill-secondary/20" />
      <circle cx="32" cy="68" r="3" className="fill-secondary/20" />
      <circle cx="50" cy="68" r="4" className="fill-secondary/70 animate-pulse-glow" />
      <circle cx="68" cy="68" r="3" className="fill-secondary/20" />
    </svg>
  ),
  inbox: (
    <svg className="w-28 h-28 text-primary animate-float-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 72L22 42H78L85 72" className="stroke-base-content/10" strokeWidth="1.5" />
      <rect x="15" y="52" width="70" height="28" rx="8" className="fill-base-300/60 stroke-base-content/30" strokeWidth="2" />
      <path d="M40 52C40 57.5 44.5 62 50 62C55.5 62 60 57.5 60 52" className="stroke-base-content/30" strokeWidth="2" />
      <path d="M32 34L50 16L68 34" className="stroke-primary/60 animate-pulse-glow" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="50" y1="16" x2="50" y2="44" className="stroke-primary/60 animate-pulse-glow" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
};

/**
 * Reusable EmptyState card featuring modern CSS animated SVGs.
 */
export function EmptyState({ 
  title = 'No records found', 
  message = 'There are no items to show at the moment.', 
  icon: Icon = Inbox, 
  actionLabel, 
  onAction 
}) {
  // Select illustration based on icon / context
  let illustration = SVG_ILLUSTRATIONS.inbox;
  const lowerTitle = title.toLowerCase();
  
  if (Icon.name === 'Wallet' || lowerTitle.includes('cash') || lowerTitle.includes('requisition') || lowerTitle.includes('budget')) {
    illustration = SVG_ILLUSTRATIONS.wallet;
  } else if (Icon.name === 'Calendar' || Icon.name === 'CalendarDays' || lowerTitle.includes('leave') || lowerTitle.includes('calendar')) {
    illustration = SVG_ILLUSTRATIONS.calendar;
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl glass-panel min-h-[320px] relative overflow-hidden">
      {/* Styles Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatIllust {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1.5deg); }
        }
        @keyframes pulseGlowIllust {
          0%, 100% { opacity: 0.3; transform: scale(0.97); }
          50% { opacity: 0.7; transform: scale(1.03); }
        }
        .animate-float-1 { animation: floatIllust 3s ease-in-out infinite; }
        .animate-float-2 { animation: floatIllust 2.6s ease-in-out infinite 0.4s; }
        .animate-pulse-glow { animation: pulseGlowIllust 2s ease-in-out infinite; }
      `}} />

      <div className="mb-4 flex items-center justify-center">
        {illustration}
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
          className="btn btn-primary btn-sm mt-6 rounded-lg font-bold text-xs shadow-md transition-all duration-200 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
export default EmptyState;
