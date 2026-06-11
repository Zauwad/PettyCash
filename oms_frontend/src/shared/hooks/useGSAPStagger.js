import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * Custom React hook to trigger staggered entrance animations.
 * 
 * @param {string} selector - CSS selector targeting children to animate
 * @param {Array} deps - Dependency list to re-trigger the animation
 * @param {Object} options - Custom animation config
 */
export function useGSAPStagger(selector, deps = [], options = {}) {
  const containerRef = useRef(null);
  
  const {
    y = 20,
    opacity = 0,
    stagger = 0.06,
    duration = 0.45,
    ease = 'power3.out',
    delay = 0,
  } = options;

  useGSAP(() => {
    const elements = containerRef.current?.querySelectorAll(selector);
    if (!elements?.length) return;

    gsap.fromTo(
      elements,
      { y, opacity, filter: 'blur(4px)' },
      { 
        y: 0, 
        opacity: 1, 
        filter: 'blur(0px)', 
        stagger, 
        duration, 
        ease, 
        delay 
      }
    );
  }, { scope: containerRef, dependencies: deps });

  return containerRef;
}
