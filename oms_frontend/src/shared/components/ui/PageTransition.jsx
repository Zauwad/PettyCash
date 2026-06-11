import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Reusable PageTransition wrapper component.
 * Animates its children (fade-in + slight slide-up) on mount.
 */
export function PageTransition({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 15 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.35, 
          ease: 'power2.out' 
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return <div ref={containerRef} className="w-full">{children}</div>;
}
export default PageTransition;
