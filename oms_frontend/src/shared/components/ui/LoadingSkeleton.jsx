/**
 * Reusable LoadingSkeleton component to show themed shimmer loading states.
 * Supports 'table', 'card', and default block structures.
 */
export function LoadingSkeleton({ variant = 'table', count = 3 }) {
  const shimmerStyle = (
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes themedShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .themed-skeleton {
        background: linear-gradient(
          90deg,
          color-mix(in oklch, var(--color-base-300) 70%, transparent) 25%,
          color-mix(in oklch, var(--color-base-content) 5%, transparent) 37%,
          color-mix(in oklch, var(--color-base-300) 70%, transparent) 63%
        );
        background-size: 200% 100%;
        animation: themedShimmer 1.6s ease-in-out infinite;
      }
    `}} />
  );

  if (variant === 'table') {
    return (
      <div className="space-y-3.5 w-full">
        {shimmerStyle}
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 w-full items-center">
            <div className="themed-skeleton h-12 w-full rounded-xl"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {shimmerStyle}
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="themed-skeleton h-48 w-full rounded-2xl"></div>
        ))}
      </div>
    );
  }

  return (
    <>
      {shimmerStyle}
      <div className="themed-skeleton h-36 w-full rounded-2xl"></div>
    </>
  );
}
export default LoadingSkeleton;
