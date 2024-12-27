import gsap from 'gsap';
import { DURATIONS, EASINGS } from './constants';

export const createGlowEffect = (element: HTMLElement) => {
  const glow = document.createElement('div');
  glow.className = 'absolute inset-0 opacity-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 blur-xl';
  element.style.position = 'relative';
  element.appendChild(glow);

  const enter = () => {
    gsap.to(glow, {
      opacity: 1,
      duration: DURATIONS.fast,
      ease: EASINGS.smooth
    });
    gsap.to(element, {
      scale: 1.02,
      duration: DURATIONS.fast,
      ease: EASINGS.smooth
    });
  };

  const leave = () => {
    gsap.to(glow, {
      opacity: 0,
      duration: DURATIONS.fast,
      ease: EASINGS.smooth
    });
    gsap.to(element, {
      scale: 1,
      duration: DURATIONS.fast,
      ease: EASINGS.smooth
    });
  };

  element.addEventListener('mouseenter', enter);
  element.addEventListener('mouseleave', leave);

  return () => {
    element.removeEventListener('mouseenter', enter);
    element.removeEventListener('mouseleave', leave);
  };
};