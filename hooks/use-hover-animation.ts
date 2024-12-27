import { useEffect, useRef } from 'react';
import { createGlowEffect } from '@/lib/animations/hover-animations';

export function useHoverAnimation<T extends HTMLElement>() {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const cleanup = createGlowEffect(element);
    return cleanup;
  }, []);

  return elementRef;
}