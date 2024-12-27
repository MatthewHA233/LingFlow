import gsap from 'gsap';
import { DURATIONS, EASINGS } from './constants';

export const fadeInUp = (element: HTMLElement, delay: number = 0) => {
  return gsap.fromTo(element,
    { y: 50, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: DURATIONS.normal,
      delay,
      ease: EASINGS.smooth,
      scrollTrigger: {
        trigger: element,
        start: 'top bottom-=100',
        toggleActions: 'play none none reverse'
      }
    }
  );
};

export const fadeInScale = (element: HTMLElement, delay: number = 0) => {
  return gsap.fromTo(element,
    { scale: 0.9, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: DURATIONS.normal,
      delay,
      ease: EASINGS.smooth,
      scrollTrigger: {
        trigger: element,
        start: 'top bottom-=100',
        toggleActions: 'play none none reverse'
      }
    }
  );
};