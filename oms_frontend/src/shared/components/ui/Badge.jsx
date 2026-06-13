import React from 'react';
import { cn } from '@/shared/lib/utils';

export function Badge({ className, variant = "default", children, ...props }) {
  const variantClasses = {
    default: "bg-zinc-900 text-zinc-50 border-transparent hover:bg-zinc-900/80 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/80",
    secondary: "bg-zinc-100 text-zinc-900 border-transparent hover:bg-zinc-100/80 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800/80",
    destructive: "bg-red-500 text-zinc-50 border-transparent hover:bg-red-500/80 dark:bg-red-900 dark:text-red-50 dark:hover:bg-red-900/80",
    outline: "text-zinc-950 border-zinc-200 dark:text-zinc-50 dark:border-zinc-800 bg-transparent",
    ghost: "bg-transparent text-zinc-950 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
        variantClasses[variant] || variantClasses.default,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Badge;
