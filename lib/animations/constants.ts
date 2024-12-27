// Common animation durations
export const DURATIONS = {
  fast: 0.3,
  normal: 0.8,
  slow: 1.2
} as const;

// Common animation easings
export const EASINGS = {
  smooth: 'power2.out',
  bounce: 'elastic.out(1, 0.3)',
  sharp: 'power4.out'
} as const;

// Common animation delays
export const DELAYS = {
  stagger: 0.2,
  initial: 0.1
} as const;