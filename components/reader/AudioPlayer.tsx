'use client';

import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface AudioPlayerProps {
  coverUrl?: string;
  audioUrl: string;
}

export function AudioPlayer({ coverUrl, audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      {/* 圆形封面 */}
      <div className="relative w-48 h-48 mx-auto">
        <div className={`absolute inset-0 rounded-full overflow-hidden ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt="Book Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary/40">No Cover</span>
            </div>
          )}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center gap-4">
        <button className="p-2 hover:bg-primary/10 rounded-full">
          <SkipBack className="w-5 h-5" />
        </button>
        <button 
          className="p-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </button>
        <button className="p-2 hover:bg-primary/10 rounded-full">
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}