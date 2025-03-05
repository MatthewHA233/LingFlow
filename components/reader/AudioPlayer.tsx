'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AudioController, AUDIO_EVENTS, PlayMode } from '@/lib/audio-controller';

interface AudioPlayerProps {
  bookId: string;
  audioUrl: string;
  currentTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  compact?: boolean;
  passiveMode?: boolean;
  playMode?: PlayMode;
}

export function AudioPlayer({ 
  bookId,
  audioUrl,
  currentTime: externalTime,
  onTimeUpdate,
  onDurationChange,
  compact = false,
  passiveMode = false,
  playMode
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [loopMode, setLoopMode] = useState<PlayMode>(playMode || 'continuous');
  const isSeekingRef = useRef(false);

  // 初始化音频源
  useEffect(() => {
    if (audioUrl) {
      AudioController.setSource(audioUrl).catch(console.error);
    }
  }, [audioUrl]);

  // 监听音频控制器事件
  useEffect(() => {
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying, volume: newVolume } = e.detail;
      setIsPlaying(newIsPlaying);
      setVolume(newVolume);
    };
    
    const handleTimeUpdate = (e: CustomEvent) => {
      if (!isSeekingRef.current) {
        const { currentTime: newTime } = e.detail;
        setCurrentTime(newTime);
        onTimeUpdate?.(newTime);
      }
    };
    
    const handleDurationChange = (e: CustomEvent) => {
      const { duration: newDuration } = e.detail;
      setDuration(newDuration);
      onDurationChange?.(newDuration);
    };
    
    window.addEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    window.addEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    window.addEventListener(AUDIO_EVENTS.DURATION_CHANGE, handleDurationChange as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
      window.removeEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
      window.removeEventListener(AUDIO_EVENTS.DURATION_CHANGE, handleDurationChange as EventListener);
    };
  }, [onTimeUpdate, onDurationChange]);

  // 处理外部时间更新
  useEffect(() => {
    if (externalTime === undefined) return;
    
    const currentState = AudioController.getState();
    if (Math.abs(externalTime - currentState.currentTime) > 100) {
      AudioController.seek(externalTime);
      
      // 只有在非被动模式下才自动播放
      if (!isPlaying && !passiveMode) {
        AudioController.play().catch(console.error);
      }
    }
  }, [externalTime, isPlaying, passiveMode]);

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

  // 当循环模式改变时，通知控制器
  useEffect(() => {
    AudioController.setPlayMode(loopMode);
    
    // 广播循环模式变更
    window.dispatchEvent(new CustomEvent('global-loop-mode-change', {
      detail: { mode: loopMode }
    }));
  }, [loopMode]);

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    isSeekingRef.current = true;
    
    // 立即更新UI，减少延迟感
    setCurrentTime(newTime);
    
    // 防抖处理，减少频繁更新
    setTimeout(() => {
      AudioController.seek(newTime);
      isSeekingRef.current = false;
    }, 50);
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 10000); // 回退10秒
    AudioController.seek(newTime);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 10000); // 前进10秒
    AudioController.seek(newTime);
  };

  const togglePlay = () => {
    if (isPlaying) {
      AudioController.pause();
    } else {
      AudioController.play().catch(console.error);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    AudioController.setVolume(newVolume);
  };

  // 格式化时间显示
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
  };

  return (
    <div className={`bg-card rounded-lg ${compact ? 'p-4' : 'p-6'} space-y-4`}>
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
          onClick={togglePlay}
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
              onClick={(e) => {
                // 阻止事件冒泡，防止与其他点击逻辑冲突
                e.preventDefault();
                e.stopPropagation();
                togglePlay();
              }}
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
              onValueChange={handleVolumeChange}
              className="w-20"
            />
          </div>

          {/* 循环模式控制 */}
          <div className="mt-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">循环模式:</span>
              <div className="flex rounded-md overflow-hidden border divide-x">
                <button 
                  className={cn(
                    "px-2 py-1 text-xs transition-colors",
                    loopMode === 'sentence' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background hover:bg-accent/30"
                  )}
                  onClick={() => setLoopMode('sentence')}
                  title="句子循环"
                >
                  单句
                </button>
                <button 
                  className={cn(
                    "px-2 py-1 text-xs transition-colors",
                    loopMode === 'block' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background hover:bg-accent/30"
                  )}
                  onClick={() => setLoopMode('block')}
                  title="段落循环"
                >
                  段落
                </button>
                <button 
                  className={cn(
                    "px-2 py-1 text-xs transition-colors",
                    loopMode === 'continuous' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background hover:bg-accent/30"
                  )}
                  onClick={() => setLoopMode('continuous')}
                  title="连续播放"
                >
                  连续
                </button>
              </div>
            </div>
            
            {loopMode !== 'none' && (
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('set-play-mode', {
                    detail: { mode: loopMode }
                  }));
                }}
                className="mt-1 text-xs text-emerald-500 hover:text-emerald-600 hover:underline flex items-center justify-center w-full"
              >
                应用到全局 <ArrowRight className="w-3 h-3 ml-1" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}