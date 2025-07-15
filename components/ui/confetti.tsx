import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  active: boolean;
}

export function Confetti({ active }: ConfettiProps) {
  useEffect(() => {
    if (!active) return;

    // 创建紫色系的彩带颜色
    const colors = ['#9333EA', '#A855F7', '#C084FC', '#E879F9', '#F0ABFC'];
    
    // 从左边发射
    const leftConfetti = () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.1, y: 0.5 },
        colors,
        startVelocity: 40,
        ticks: 300
      });
    };

    // 从右边发射
    const rightConfetti = () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.9, y: 0.5 },
        colors,
        startVelocity: 40,
        ticks: 300
      });
    };

    // 从中间向上发射
    const centerConfetti = () => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.7 },
        colors,
        startVelocity: 45,
        gravity: 1,
        ticks: 400,
        shapes: ['star', 'circle']
      });
    };

    // 执行动画序列
    const sequence = async () => {
      await Promise.all([
        leftConfetti(),
        rightConfetti()
      ]);
      
      setTimeout(centerConfetti, 250);
      
      setTimeout(() => {
        Promise.all([
          leftConfetti(),
          rightConfetti()
        ]);
      }, 500);
    };

    sequence();
  }, [active]);

  return null;
} 