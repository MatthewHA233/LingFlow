'use client';

import { useEffect, useRef } from 'react';
import { useMatrix } from './useMatrix';
import { config } from './config';

export function MatrixBackground() {
  const { canvasRef, streams } = useMatrix();
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.fillStyle = config.colors.trail;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      streams.forEach(stream => {
        stream.chars.forEach((char, i) => {
          const fadeRatio = (stream.chars.length - i) / config.fadeLength;
          const alpha = Math.min(1, fadeRatio);
          
          const shouldFlicker = Math.random() < config.flickerRate;
          const isHead = i === 0;
          
          ctx.fillStyle = shouldFlicker 
            ? config.colors.bright
            : isHead 
              ? config.colors.primary
              : `rgba(140, 255, 140, ${alpha * 0.2})`;

          ctx.font = `${config.charSize}px "SF Mono", monospace`;
          ctx.fillText(char.value, char.x, char.y);

          char.y += char.speed;
          
          if (char.y > canvas.height) {
            char.y = char.y - (canvas.height + stream.chars.length * config.charSize);
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [streams]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10 bg-black"
    />
  );
}