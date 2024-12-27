'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { createDots } from './dots';

export function useButtonAnimation() {
  const btnAreaRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dotsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!btnAreaRef.current || !btnRef.current || !overlayRef.current) return;

    const btnArea = btnAreaRef.current;
    const btn = btnRef.current;
    const overlay = overlayRef.current;
    let isMouseEnter = false;

    // Create dots
    if (!dotsContainerRef.current) {
      dotsContainerRef.current = createDots({ container: btn });
    }

    const handleBtnAreaMouseEnter = () => {
      isMouseEnter = true;
    };

    const handleBtnAreaMouseMove = (e: MouseEvent) => {
      if (!isMouseEnter) return;
      const rect = btnArea.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      overlay.style.transform = `translate(${x}px, ${y}px)`;
    };

    const handleBtnAreaMouseLeave = () => {
      isMouseEnter = false;
    };

    const handleBtnMouseEnter = () => {
      const newShadow = '0px -40px 52.4px -40px rgba(139, 98, 255, 0.5)';
      const newShadowTop = '0px 30px 52.4px -40px rgba(139, 98, 255, 0.2)';
      document.documentElement.style.setProperty('--purple-shadow', newShadow);
      document.documentElement.style.setProperty('--purple-shadow-top', newShadowTop);
      
      if (dotsContainerRef.current) {
        gsap.to(dotsContainerRef.current, {
          opacity: 1,
          duration: 0.5,
          ease: 'power2.inOut'
        });
      }
    };

    const handleBtnMouseLeave = () => {
      const originalShadow = '0px -20px 52.4px -40px rgba(139, 98, 255, 0.3)';
      const originalShadowTop = '0px 20px 52.4px -40px rgba(139, 98, 255, 0.1)';
      document.documentElement.style.setProperty('--purple-shadow', originalShadow);
      document.documentElement.style.setProperty('--purple-shadow-top', originalShadowTop);
      
      if (dotsContainerRef.current) {
        gsap.to(dotsContainerRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.inOut'
        });
      }
    };

    btnArea.addEventListener('mouseenter', handleBtnAreaMouseEnter);
    btnArea.addEventListener('mousemove', handleBtnAreaMouseMove);
    btnArea.addEventListener('mouseleave', handleBtnAreaMouseLeave);
    btn.addEventListener('mouseenter', handleBtnMouseEnter);
    btn.addEventListener('mouseleave', handleBtnMouseLeave);

    return () => {
      btnArea.removeEventListener('mouseenter', handleBtnAreaMouseEnter);
      btnArea.removeEventListener('mousemove', handleBtnAreaMouseMove);
      btnArea.removeEventListener('mouseleave', handleBtnAreaMouseLeave);
      btn.removeEventListener('mouseenter', handleBtnMouseEnter);
      btn.removeEventListener('mouseleave', handleBtnMouseLeave);
    };
  }, []);

  return { btnAreaRef, btnRef, overlayRef };
}