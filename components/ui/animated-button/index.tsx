'use client';

import { useButtonAnimation } from './use-button-animation';
import { useRouter } from 'next/navigation';
import './styles.css';

export function AnimatedButton() {
  const { btnAreaRef, btnRef, overlayRef } = useButtonAnimation();
  const router = useRouter();

  const handleClick = () => {
    router.push('/context-library');
  };

  return (
    <div className="btn-area" ref={btnAreaRef}>
      <div 
        className="btn-container" 
        ref={btnRef}
        onClick={handleClick}
      >
        <div className="overlay" ref={overlayRef} />
        <h1 className="gradient-text">开始构建</h1>
      </div>
    </div>
  );
}