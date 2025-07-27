import gsap from 'gsap';

interface CreateDotsParams {
  container: HTMLDivElement;
  count?: number;
  size?: number;
}

export function createDots({ container, count = 150, size = 4 }: CreateDotsParams) {
  const dots: HTMLDivElement[] = [];
  const dotsContainer = document.createElement('div');
  
  dotsContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    pointer-events: none;
  `;

  container.appendChild(dotsContainer);

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background-color: rgba(255, 255, 255, 1);
      opacity: 0;
      border-radius: 100px;
      position: absolute;
      transform: translate(${(Math.random() - 0.5) * 600}px, ${(Math.random() - 0.5) * 600}px);
    `;
    dotsContainer.appendChild(dot);
    dots.push(dot);
  }

  dots.forEach((dot, index) => {
    gsap.timeline({ repeat: -1, delay: index * 0.08 })
      .to(dot, {
        x: () => (Math.random() - 0.5) * 30,
        y: () => (Math.random() - 0.5) * 10,
        opacity: 0.3,
        duration: 2,
        ease: 'power2.inOut'
      })
      .to(dot, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.set(dot, { 
            x: (Math.random() - 0.5) * 600, 
            y: (Math.random() - 0.5) * 600 
          });
        }
      });
  });

  return dotsContainer;
}