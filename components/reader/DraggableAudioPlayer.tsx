import { useState, useEffect, useCallback } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { GripVertical } from 'lucide-react';

interface DraggableAudioPlayerProps {
  bookId: string;
  audioUrl: string;
  currentTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
}

export function DraggableAudioPlayer({
  bookId,
  audioUrl,
  currentTime,
  onTimeUpdate
}: DraggableAudioPlayerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 初始化位置在页面左下角
    setPosition({
      x: 60, // 距离左边 60px
      y: window.innerHeight - 500 // 距离底部 500px
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = Math.max(20, Math.min(window.innerWidth - 200, e.clientX - dragStart.x));
    const newY = Math.max(20, Math.min(window.innerHeight - 200, e.clientY - dragStart.y));

    setPosition({ x: newX, y: newY });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  return (
    <div
      className="fixed z-50 shadow-lg rounded-lg"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'auto'
      }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 p-2 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </div>
      
      <div className="mt-6">
        <AudioPlayer
          bookId={bookId}
          audioUrl={audioUrl}
          currentTime={currentTime}
          onTimeUpdate={onTimeUpdate}
          compact={true}
        />
      </div>
    </div>
  );
} 