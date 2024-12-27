'use client';

import { useEffect, useRef, useState } from 'react';
import { config, greetings } from './config';
import type { Stream } from './types';

export function useMatrix() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  
  // 创建新的字符流
  const createStream = (x: number): Stream => {
    const text = Math.random() > 0.7 
      ? greetings[Math.floor(Math.random() * greetings.length)]
      : Array(5).fill(0).map(() => config.chars[Math.floor(Math.random() * config.chars.length)]).join('');
    
    return {
      chars: text.split('').map((char, i) => ({
        value: char,
        x,
        y: -i * config.charSize * 1.5, // 让字符初始位置在屏幕上方
        speed: config.baseSpeed + Math.random() * config.speedVariation
      }))
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createStreams = () => {
      const columns = Math.floor(window.innerWidth / config.charSize);
      const newStreams: Stream[] = [];
      
      for (let i = 0; i < columns; i++) {
        if (Math.random() < config.density) {
          newStreams.push(createStream(i * config.charSize));
        }
      }
      setStreams(newStreams);
    };

    resizeCanvas();
    createStreams();
    
    const handleResize = () => {
      resizeCanvas();
      createStreams();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { canvasRef, streams };
}