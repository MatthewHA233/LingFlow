'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';

interface AudioPlayerProps {
  bookId: string;
  audioUrl: string;
  currentTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  compact?: boolean;
  passiveMode?: boolean;
  playMode?: 'sentence' | 'block' | 'continuous';
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);
  const [loopMode, setLoopMode] = useState(playMode || 'none');
  const [isReplaying, setIsReplaying] = useState(false);

  // 处理外部时间更新
  useEffect(() => {
    if (!audioRef.current || externalTime === undefined) return;

    const currentTimeMs = audioRef.current.currentTime * 1000;
    if (Math.abs(externalTime - currentTimeMs) > 100) {
      audioRef.current.currentTime = externalTime / 1000;
      setCurrentTime(externalTime);
      
      // 只有在非被动模式下才自动播放
      if (!isPlaying && !passiveMode) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    }
  }, [externalTime, isPlaying, passiveMode]);

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

  useEffect(() => {
    // 监听状态变更
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying } = e.detail;
      setIsPlaying(newIsPlaying);
    };
    
    // 监听时间更新，但限制更新频率
    let lastTimeUpdate = 0;
    const handleTimeUpdate = (e: CustomEvent) => {
      const now = Date.now();
      if (now - lastTimeUpdate > 100) { // 限制更新频率
        lastTimeUpdate = now;
        const { currentTime } = e.detail;
        setCurrentTime(currentTime);
        onTimeUpdate?.(currentTime);
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    window.addEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
      window.removeEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    };
  }, [onTimeUpdate]);

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      // 同步到全局控制器
      if (isPlaying) {
        AudioController.play(
          audioUrl,
          newTime * 1000,
          duration * 1000,
          'main-audio-player'
        );
      }
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

  const togglePlay = () => {
    if (isPlaying) {
      AudioController.pause();
    } else {
      // 添加调试日志
      console.log('播放音频:', {
        audioUrl,
        startTime: currentTime,
        endTime: duration,
        playerId: 'main-audio-player'
      });
      
      // 确保设置了endTime
      const endTimeToUse = duration > 0 ? duration : 9999999; // 如果没有duration则使用一个大值
      
      AudioController.play(
        audioUrl,
        currentTime,
        endTimeToUse,
        'main-audio-player'
      );
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => {
        setIsPlaying(false);
        // 在被动模式下，发送播放结束通知
        if (passiveMode) {
          // 发送自定义事件通知ContentBlock播放结束
          const event = new CustomEvent('audio-playback-ended');
          window.dispatchEvent(event);
        }
      };
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [handleLoadedMetadata, passiveMode]);

  // 修改音频播放循环功能实现

  // 添加对循环模式的处理
  useEffect(() => {
    // 监听音频完成事件
    const handleAudioEnd = (e: CustomEvent) => {
      const { playerId } = e.detail;
      
      // 只处理主播放器的结束事件
      if (playerId === 'main-audio-player' && !isReplaying) {
        // 根据循环模式决定行为
        if (loopMode === 'sentence' || loopMode === 'block') {
          // 防止重入
          setIsReplaying(true);
          
          // 延迟播放下一个片段
          setTimeout(() => {
            // 重新播放当前音频
            const success = AudioController.play(
              audioUrl,
              0, // 从头开始
              duration,
              'main-audio-player'
            );
            
            console.log('尝试循环播放:', success);
            
            // 解除重入锁
            setTimeout(() => {
              setIsReplaying(false);
            }, 500);
          }, 200);
        }
      }
    };
    
    window.addEventListener('audio-playback-ended', handleAudioEnd as EventListener);
    
    return () => {
      window.removeEventListener('audio-playback-ended', handleAudioEnd as EventListener);
    };
  }, [audioUrl, duration, loopMode, isReplaying]);

  // 当循环模式改变时，发送全局事件
  useEffect(() => {
    if (loopMode !== 'none') {
      // 广播循环模式变更
      window.dispatchEvent(new CustomEvent('global-loop-mode-change', {
        detail: { mode: loopMode }
      }));
    }
  }, [loopMode]);

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
              onValueChange={(value) => setVolume(value[0] / 100)}
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

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}