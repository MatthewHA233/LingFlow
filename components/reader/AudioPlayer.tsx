'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase-client';

interface AudioPlayerProps {
  bookId: string;
  audioUrl: string;
  currentTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
}

export function AudioPlayer({ 
  bookId,
  audioUrl,
  currentTime: externalTime,
  onTimeUpdate,
  onDurationChange 
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);

  // 处理外部时间更新
  useEffect(() => {
    if (!audioRef.current || isSeekingRef.current || externalTime === undefined) return;
    
    const currentTimeMs = audioRef.current.currentTime * 1000;
    if (Math.abs(externalTime - currentTimeMs) > 100) {  // 减小时间差异阈值
      console.log('跳转到时间:', externalTime);
      isSeekingRef.current = true;
      audioRef.current.currentTime = externalTime / 1000;
      setCurrentTime(externalTime);
      isSeekingRef.current = false;
      
      // 确保音频播放
      if (!isPlaying) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    }
  }, [externalTime]);

  // 获取书籍封面
  useEffect(() => {
    async function fetchBookCover() {
      try {
        const { data: book, error } = await supabase
          .from('books')
          .select('cover_url')
          .eq('id', bookId)
          .single();

        if (error) throw error;
        if (book?.cover_url) {
          setCoverUrl(book.cover_url);
        }
      } catch (err) {
        console.error('获取书籍封面失败:', err);
      }
    }

    if (bookId) {
      fetchBookCover();
    }
  }, [bookId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isSeekingRef.current) {
      const time = Math.floor(audioRef.current.currentTime * 1000);
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration * 1000; // 转换为毫秒
      setDuration(audioDuration);
      onDurationChange?.(audioDuration);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      isSeekingRef.current = true;
      const newTime = value[0];
      audioRef.current.currentTime = newTime / 1000;
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime);
      isSeekingRef.current = false;
    }
  };

  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration,
        audioRef.current.currentTime + 10
      );
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', () => setIsPlaying(false));
      
      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', () => setIsPlaying(false));
      };
    }
  }, []);

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      {/* 音频元素 */}
      <audio 
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
      />
      
      {/* 圆形封面 */}
      <div className="relative w-48 h-48 mx-auto">
        <div 
          className={`absolute inset-0 rounded-full overflow-hidden ${
            isPlaying ? 'animate-spin' : ''
          }`} 
          style={{ animationDuration: '3s' }}
        >
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

      {/* 进度条 */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration}
          step={1}
          onValueChange={handleSeek}
          className="w-full"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center gap-4">
        <button 
          className="p-2 hover:bg-primary/10 rounded-full"
          onClick={handleSkipBack}
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button 
          className="p-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </button>
        <button 
          className="p-2 hover:bg-primary/10 rounded-full"
          onClick={handleSkipForward}
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* 音量控制 */}
      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4" />
        <Slider
          value={[volume * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={(value) => setVolume(value[0] / 100)}
          className="w-24"
        />
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}