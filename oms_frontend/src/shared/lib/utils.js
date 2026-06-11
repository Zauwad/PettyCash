import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind classes conditionally and merges them cleanly
 * to avoid style conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
