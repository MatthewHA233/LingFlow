import { useEffect, useRef } from 'react';
import { fadeInUp, fadeInScale } from '@/lib/animations/scroll-animations';

type AnimationType = 'fadeInUp' | 'fadeInScale';

export function useScrollAnimation<T extends HTMLElement>(
  type: AnimationType = 'fadeInUp',
  delay: number = 0
) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const animation = type === 'fadeInUp' 
      ? fadeInUp(element, delay)
      : fadeInScale(element, delay);

    return () => {
      animation.kill();
    };
  }, [type, delay]);

  return elementRef;
}