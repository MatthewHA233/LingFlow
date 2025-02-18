'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';

interface AudioPlayerProps {
  bookId: string;
  audioUrl: string;
  currentTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  compact?: boolean;
}

export function AudioPlayer({ 
  bookId,
  audioUrl,
  currentTime: externalTime,
  onTimeUpdate,
  onDurationChange,
  compact = false
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);

  // 处理外部时间更新
  useEffect(() => {
    if (!audioRef.current || externalTime === undefined) return;

    const currentTimeMs = audioRef.current.currentTime * 1000;
    if (Math.abs(externalTime - currentTimeMs) > 100) {
      audioRef.current.currentTime = externalTime / 1000;
      setCurrentTime(externalTime);
      
      // 确保音频播放
      if (!isPlaying) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    }
  }, [externalTime, isPlaying]);

  // 监听音频时间更新
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeekingRef.current) {
        // 使用 requestAnimationFrame 限制更新频率
        requestAnimationFrame(() => {
          const time = Math.floor(audio.currentTime * 1000);
          // 只有当时间差异超过 100ms 时才更新
          if (Math.abs(time - currentTime) > 100) {
            setCurrentTime(time);
            onTimeUpdate?.(time);
          }
        });
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [onTimeUpdate, currentTime]);

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

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration * 1000;
      setDuration(audioDuration);
      onDurationChange?.(audioDuration);
    }
  }, [onDurationChange]);

  const handlePlayPause = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          await audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
        console.error('播放控制失败:', error);
      }
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
      const newTime = Math.max(0, audioRef.current.currentTime - 10);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime * 1000);
      onTimeUpdate?.(newTime * 1000);
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(
        audioRef.current.duration,
        audioRef.current.currentTime + 10
      );
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime * 1000);
      onTimeUpdate?.(newTime * 1000);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [handleLoadedMetadata]);

  return (
    <div className={`bg-card rounded-lg ${compact ? 'p-4' : 'p-6'} space-y-4`}>
      {/* 音频元素 */}
      <audio 
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
      />
      
      {/* 展开/收起按钮 */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-accent rounded-md text-muted-foreground"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* 圆形封面 */}
      <div className={`relative mx-auto transition-all duration-300 ${
        compact ? 'w-32 h-32' : 'w-48 h-48'
      }`}>
        <button 
          className={`absolute inset-0 rounded-full overflow-hidden ${
            isPlaying ? 'animate-spin' : ''
          }`} 
          style={{ animationDuration: '3s' }}
          onClick={handlePlayPause}
        >
          {coverUrl ? (
            <Image 
              src={coverUrl} 
              alt="Book Cover" 
              className="w-full h-full object-cover"
              width={500}
              height={500}
            />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary/40">No Cover</span>
            </div>
          )}
        </button>
      </div>

      {isExpanded && (
        <>
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-2">
            <button 
              className="p-1.5 hover:bg-accent rounded-full"
              onClick={handleSkipBack}
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button 
              className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button 
              className="p-1.5 hover:bg-accent rounded-full"
              onClick={handleSkipForward}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* 音量控制 */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3" />
            <Slider
              value={[volume * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => setVolume(value[0] / 100)}
              className="w-20"
            />
          </div>
        </>
      )}
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