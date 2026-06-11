/**
 * Reusable LoadingSkeleton component to show shimmer loading states.
 * Supports 'table', 'card', and default block structures.
 * 
 * @param {string} variant - 'table' | 'card' | 'block'
 * @param {number} count - Number of skeleton items to render
 */
export function LoadingSkeleton({ variant = 'table', count = 3 }) {
  if (variant === 'table') {
    return (
      <div className="space-y-3 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 w-full items-center">
            <div className="skeleton h-12 w-full rounded-xl"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton h-44 w-full rounded-2xl"></div>
        ))}
      </div>
    );
  }

  return <div className="skeleton h-36 w-full rounded-2xl"></div>;
}
export default LoadingSkeleton;
