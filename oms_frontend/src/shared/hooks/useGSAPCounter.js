import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * Custom React hook to animate numerical statistics from 0 to target value on mount.
 * 
 * @param {number} targetValue - The number to count to
 * @param {Array} deps - Extra trigger dependencies
 * @param {Object} options - Custom duration, prefix/suffix labels
 */
export function useGSAPCounter(targetValue, deps = [], options = {}) {
  const elementRef = useRef(null);
  const { 
    duration = 1.0, 
    ease = 'power2.out', 
    prefix = '', 
    suffix = '' 
  } = options;

  useGSAP(() => {
    const obj = { val: 0 };
    
    gsap.to(obj, {
      val: targetValue,
      duration,
      ease,
      onUpdate: () => {
        if (elementRef.current) {
          // Format with local commas (e.g. 100,000)
          elementRef.current.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
        }
      },
    });
  }, { dependencies: [targetValue, ...deps] });

  return elementRef;
}
