import React from 'react';
import { cn } from '@/shared/lib/utils';

export function SpotlightNew({ className }) {
  return (
    <div className={cn("fixed inset-0 overflow-hidden pointer-events-none z-0", className)}>
      {/* Left Spotlight Beam - Adjusted to top */}
      <svg
        className="absolute top-[-40%] left-[-80%] w-[120%] h-[80%] md:top-[-60%] md:left-[-20%] md:w-[80%] md:h-[150%] opacity-15 md:opacity-20 animate-pulse "
        style={{ animationDuration: '8s' }}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 3787 2842"
        fill="none"
      >
        <g filter="url(#filter-left)">
          <ellipse
            cx="1924.57"
            cy="273.89"
            rx="1924.57"
            ry="273.89"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill="var(--color-primary)"
            fillOpacity="0.8"
          />
        </g>
        <defs>
          <filter
            id="filter-left"
            x="0.860352"
            y="-938.343"
            width="3778.26"
            height="4051.63"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="180" result="effect1_foregroundBlur_1065_8" />
          </filter>
        </defs>
      </svg>

      {/* Right Spotlight Beam - Adjusted to top */}
      <svg
        className="absolute top-[-40%] right-[-80%] w-[120%] h-[80%] md:top-[-60%] md:right-[-20%] md:w-[80%] md:h-[150%] opacity-10 md:opacity-15 animate-pulse scale-x-[-1]"
        style={{ animationDuration: '12s' }}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 3787 2842"
        fill="none"
      >
        <g filter="url(#filter-right)">
          <ellipse
            cx="1924.57"
            cy="273.89"
            rx="1924.57"
            ry="273.89"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill="var(--color-secondary)"
            fillOpacity="0.8"
          />
        </g>
        <defs>
          <filter
            id="filter-right"
            x="0.860352"
            y="-938.343"
            width="3778.26"
            height="4051.63"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="180" result="effect1_foregroundBlur_1065_8" />
          </filter>
        </defs>
      </svg>

      {/* Ambient Grid overlay */}
      <div className="absolute inset-0 bg-grid-black opacity-15 mix-blend-overlay dark:opacity-[0.05]" />
    </div>
  );
}

export default SpotlightNew;