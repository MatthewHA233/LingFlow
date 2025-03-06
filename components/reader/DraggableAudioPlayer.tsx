import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioController } from '@/lib/audio-controller';
import { ChevronRight, SkipBack, SkipForward, Volume2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { supabase } from '@/lib/supabase-client';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { updateBookCover } from '@/lib/book-cover-utils';

interface DraggableAudioPlayerProps {
  bookId: string;
  audioUrl: string;
  currentTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  passiveMode?: boolean;
}

// 修改物理参数 - 基础值
const BASE_ROTATION_SPEED = 90; // 基础最大转速
const BASE_ACCELERATION = 120; // 基础加速度
const BASE_DECELERATION = 180; // 基础减速度
const MIN_ROTATION_SPEED = 0.1; // 最小转速

// 添加倍速选项
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function DraggableAudioPlayer({
  bookId,
  audioUrl,
  currentTime,
  onTimeUpdate
}: DraggableAudioPlayerProps) {
  // 将useState钩子移到组件函数内部
  const [isAudioLoaded, setIsAudioLoaded] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [loopMode, setLoopMode] = useState<'continuous' | 'sentence' | 'block'>('continuous');
  const [volume, setVolume] = useState<number>(0.7);
  const [currentTime1, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isProgressHovered, setIsProgressHovered] = useState<boolean>(false);
  const [lastNonZeroVolume, setLastNonZeroVolume] = useState<number | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  
  // refs - 确保所有 useRef 都有初始值
  const isRotating = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const speedRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const playbackRateRef = useRef<number>(1);
  
  // 添加播放速率状态
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  
  // 动画函数
  const animate = useCallback((time: number) => {
    // 第一帧初始化
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // 根据播放速率调整物理参数
    const currentMaxSpeed = BASE_ROTATION_SPEED * playbackRateRef.current;
    const currentAcceleration = BASE_ACCELERATION * playbackRateRef.current;
    const currentDeceleration = BASE_DECELERATION * playbackRateRef.current;

    // 计算目标速度
    const targetSpeed = isRotating.current ? currentMaxSpeed : 0;

    // 更新速度
    if (speedRef.current < targetSpeed) {
      speedRef.current = Math.min(
        targetSpeed,
        speedRef.current + currentAcceleration * deltaTime
      );
    } else if (speedRef.current > targetSpeed) {
      speedRef.current = Math.max(
        targetSpeed,
        speedRef.current - currentDeceleration * deltaTime
      );
    }

    // 应用旋转
    setRotation(prev => (prev + speedRef.current * deltaTime) % 360);

    // 继续动画或停止
    if (speedRef.current > MIN_ROTATION_SPEED || isRotating.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // 完全停止
      speedRef.current = 0;
      lastTimeRef.current = 0;
      animationFrameRef.current = null;
    }
  }, [playbackRateRef]);

  // 开始旋转
  const startRotation = useCallback(() => {
    isRotating.current = true;
    if (!animationFrameRef.current) {
      lastTimeRef.current = 0;
      speedRef.current = speedRef.current || 0; // 保持现有速度或从0开始
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  // 停止旋转
  const stopRotation = useCallback(() => {
    isRotating.current = false;
  }, []);
  
  // 监听播放状态变化
  useEffect(() => {
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying } = e.detail;
      setIsPlaying(newIsPlaying);
      
      if (newIsPlaying) {
        startRotation();
      } else {
        stopRotation();
      }
    };
    
    window.addEventListener('audio-state-change', handleStateChange as EventListener);
    return () => {
      window.removeEventListener('audio-state-change', handleStateChange as EventListener);
      // 完全清理
      isRotating.current = false;
      speedRef.current = 0;
      lastTimeRef.current = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [startRotation, stopRotation]);

  // 初始播放状态处理
  useEffect(() => {
    if (isPlaying) {
      startRotation();
    }
  }, [isPlaying, startRotation]);

  // 获取书籍封面
  useEffect(() => {
    async function fetchBookCover() {
      if (!bookId) return;
      
      try {
        const { data: book, error } = await supabase
          .from('books')
          .select('*')
          .eq('id', bookId)
          .single();

        if (error) throw error;
        
        if (book) {
          // 如果没有封面，尝试更新
          const updatedBook = await updateBookCover(book);
          if (updatedBook.cover_url) {
            setCoverUrl(updatedBook.cover_url);
          }
        }
      } catch (err) {
        console.error('获取书籍封面失败:', err);
      }
    }

    fetchBookCover();
  }, [bookId]);

  useEffect(() => {
    // 初始化位置
    setPosition({
      x: window.innerWidth - 1450,
      y: window.innerHeight / 2 - 20
    });
  }, []);

  // 监听音频加载完成事件
  useEffect(() => {
    if (!audioUrl) return;
    
    const handleMetadataLoaded = (e: CustomEvent) => {
      console.log('音频元数据已加载', e.detail);
      setIsAudioLoaded(true);
    };
    
    // 添加duration事件处理，确保无论元数据事件是否触发，都能正确显示时长
    const handleDurationChange = (e: CustomEvent) => {
      const { duration: newDuration } = e.detail;
      console.log('音频时长已更新:', newDuration);
      if (newDuration > 0) {
        setIsAudioLoaded(true);
        setDuration(newDuration);
      }
    };
    
    window.addEventListener('audio-metadata-loaded', handleMetadataLoaded as EventListener);
    window.addEventListener('audio-duration-change', handleDurationChange as EventListener);
    
    // 使用正确的setSource方法
    AudioController.setSource(audioUrl);
    
    // 添加备用方案：如果5秒内元数据事件未触发，强制设置为已加载
    const timeoutId = setTimeout(() => {
      setIsAudioLoaded(true);
    }, 5000);
    
    return () => {
      window.removeEventListener('audio-metadata-loaded', handleMetadataLoaded as EventListener);
      window.removeEventListener('audio-duration-change', handleDurationChange as EventListener);
      clearTimeout(timeoutId);
      AudioController.pause();
    };
  }, [audioUrl]);

  // 监听音频时间更新
  useEffect(() => {
    const handleTimeUpdate = (e: CustomEvent) => {
      const { currentTime: newTime } = e.detail;
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime);
    };

    const handleDurationChange = (e: CustomEvent) => {
      const { duration: newDuration } = e.detail;
      setDuration(newDuration);
    };

    const handleVolumeChange = (e: CustomEvent) => {
      const { volume: newVolume } = e.detail;
      setVolume(newVolume);
    };

    // 添加事件监听
    window.addEventListener('audio-time-update', handleTimeUpdate as EventListener);
    window.addEventListener('audio-duration-change', handleDurationChange as EventListener);
    window.addEventListener('audio-volume-change', handleVolumeChange as EventListener);

    return () => {
      // 移除事件监听
      window.removeEventListener('audio-time-update', handleTimeUpdate as EventListener);
      window.removeEventListener('audio-duration-change', handleDurationChange as EventListener);
      window.removeEventListener('audio-volume-change', handleVolumeChange as EventListener);
    };
  }, [onTimeUpdate]);

  // 当组件挂载时设置初始音量
  useEffect(() => {
    AudioController.setVolume(0.7);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 检查点击的元素是否在进度条区域内
    const progressArea = document.querySelector('.progress-area');
    if (progressArea?.contains(e.target as Node)) {
      return; // 如果在进度条区域内，不启动拖拽
    }

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 播放/暂停切换
  const togglePlayPause = () => {
    if (isPlaying) {
      AudioController.pause();
    } else {
      AudioController.play();
    }
  };

  // 处理前进/后退
  const handleSkipForward = () => {
    const newTime = Math.min(currentTime1 + 5, duration);
    AudioController.seek(newTime);
    setCurrentTime(newTime);
  };
  
  const handleSkipBack = () => {
    const newTime = Math.max(currentTime1 - 5, 0);
    AudioController.seek(newTime);
    setCurrentTime(newTime);
  };
  
  // 处理音量
  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0] / 100;
    AudioController.setVolume(newVolume);
    setVolume(newVolume);
    
    if (newVolume > 0) {
      setLastNonZeroVolume(newVolume);
    }
  };
  
  const handleSeek = (values: number[]) => {
    const newTime = values[0];
    AudioController.seek(newTime);
    setCurrentTime(newTime);
    onTimeUpdate?.(newTime);
  };

  // 处理进度条点击
  const handleProgressBarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * (duration || 0);
    
    AudioController.seek(newTime);
    setCurrentTime(newTime);
    onTimeUpdate?.(newTime);
  };

  // 监听播放速率变化
  useEffect(() => {
    const handlePlaybackRateChange = (e: CustomEvent) => {
      const { playbackRate: newRate } = e.detail;
      setPlaybackRate(newRate);
      playbackRateRef.current = newRate;
    };

    window.addEventListener('audio-playback-rate-change', handlePlaybackRateChange as EventListener);
    return () => {
      window.removeEventListener('audio-playback-rate-change', handlePlaybackRateChange as EventListener);
    };
  }, []);

  // 处理倍速变化
  const handlePlaybackRateChange = (newRate: number) => {
    AudioController.setPlaybackRate(newRate);
    setPlaybackRate(newRate);
    playbackRateRef.current = newRate;
    
    // 添加 toast 提示
    toast.success(`已切换到播放速度: ${newRate}x`, {
      position: 'bottom-right',
      duration: 1500,
    });
  };

  // 处理循环模式变化
  const handleLoopModeChange = () => {
    const modes = ['continuous', 'sentence', 'block'] as const;
    const currentIndex = modes.indexOf(loopMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const newMode = modes[nextIndex];
    setLoopMode(newMode);
    AudioController.setPlayMode(newMode);
    
    // 添加 toast 提示
    const modeText = {
      continuous: '已切换到顺序播放',
      sentence: '已切换到单句循环',
      block: '已切换到语境块循环'
    }[newMode];
    
    toast.success(`切换到${modeText}`, {
      position: 'bottom-right',
      duration: 1500,
    });
  };

  // 格式化时间函数
  const formatTime = (ms: number): string => {
    if (isNaN(ms) || ms === 0) {
      return isAudioLoaded ? '00:00' : '--:--'; // 未加载时显示--:--
    }
    
    // 将毫秒转换为秒
    const totalSeconds = ms / 1000;
    
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="fixed z-[9999]"
      style={{
        top: position.y,
        left: position.x,
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.3 }
      }}
    >
      {/* 大型唱片指针 - 添加点击事件和平滑过渡 */}
      <div 
        className={cn(
          "absolute -top-6 left-1/2 z-30 transform-gpu cursor-pointer", 
          isPlaying ? "rotate-[-20deg]" : "rotate-[-45deg]"
        )}
        style={{ 
          transformOrigin: "90% 75%", 
          transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)" // 修改过渡效果
        }}
        onClick={(e) => {
          e.stopPropagation(); // 防止事件冒泡到唱片
          togglePlayPause();
        }}
      >
        <svg 
          width="160" 
          height="120" 
          viewBox="0 0 180 120"
          style={{
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" // 添加阴影效果
          }}
        >
          {/* 支架底座 */}
          <rect x="145" y="90" width="30" height="10" rx="3" fill="#333" />
          
          {/* 唱臂支柱 */}
          <rect x="155" y="40" width="10" height="55" rx="2" fill="#444" />
          
          {/* 唱臂平衡部分 */}
          <rect x="140" y="40" width="40" height="8" rx="2" fill="#333" />
          <circle cx="160" cy="44" r="6" fill="#222" />
          <circle cx="160" cy="44" r="3" fill="#111" />
          
          {/* 唱臂主体 */}
          <rect 
            x="20" 
            y="41" 
            width="130" 
            height="6" 
            rx="3" 
            fill="#333"
          />
          
          {/* 唱臂头部 */}
          <rect 
            x="15" 
            y="39" 
            width="20" 
            height="10" 
            rx="2" 
            fill="#222"
          />
          
          {/* 唱针 - 增加了红色部分的尺寸 */}
          <rect 
            x="18" 
            y="47" 
            width="10" 
            height="15" 
            rx="1" 
            fill="#d32f2f"
          />
          <rect 
            x="22" 
            y="60" 
            width="2" 
            height="5" 
            fill="#111"
          />
          
          {/* 状态灯 - 添加过渡效果 */}
          <circle 
            cx="160" 
            cy="30" 
            r="4" 
            fill={isPlaying ? "#4caf50" : "#d32f2f"}
            style={{
              transition: "fill 0.3s ease-in-out",
              filter: "drop-shadow(0 0 3px rgba(0,0,0,0.3))"
            }}
          />
        </svg>
      </div>
      
      {/* 唱片主体部分 */}
      <div className="relative">
        {/* 倍速控制 - 放在唱片上方 */}
        <div 
          className="absolute top-8 left-1/2 -translate-x-1/2 z-30 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
            const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
            handlePlaybackRateChange(PLAYBACK_RATES[nextIndex]);
          }}
        >
          <span className="text-xs font-medium text-white/90 drop-shadow-lg">
            {playbackRate}x
          </span>
        </div>

        {/* 实际唱片圆盘 */}
        <div 
          id="record-disc"
          className="relative w-[180px] h-[180px] rounded-full overflow-visible cursor-pointer"
          onClick={togglePlayPause}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'none',
          }}
        >
          {/* 唱片内容容器 - 添加溢出隐藏 */}
          <div className="absolute inset-0 rounded-full overflow-hidden border-8 border-black">
            {/* 唱片封面图 */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-indigo-900">
              {coverUrl && (
                <Image
                  src={coverUrl}
                  alt="Album cover"
                  fill
                  className="object-cover"
                />
              )}
            </div>
          </div>

          {/* 外部光晕效果 */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `
                0 0 20px 2px rgba(147, 51, 234, 0.1),
                0 0 10px 1px rgba(168, 85, 247, 0.15),
                0 0 5px 0 rgba(139, 92, 246, 0.2),
                0 4px 6px rgba(0, 0, 0, 0.3)
              `
            }}
          />

          {/* 其他内容（中心孔等）保持不变 */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* 黑色圆环背景 */}
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
              {/* 白色中心孔 */}
              <div className="absolute w-4 h-4 rounded-full bg-white/20 pointer-events-none" />
              
              {/* 循环模式控制 - 放在中心孔位置 */}
              <div 
                className="w-4 h-4 rounded-full cursor-pointer z-30 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoopModeChange();
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="opacity-90"
                >
                  {loopMode === 'continuous' ? (
                    // 顺序播放图标 - 单箭头
                    <>
                      <path d="M4 12h16" />
                      <path d="M16 6l6 6-6 6" />
                    </>
                  ) : loopMode === 'sentence' ? (
                    // 单曲循环图标
                    <>
                      <path d="M17 2l4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                      <path d="M7 22l-4-4 4-4" />
                      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                      <path d="M11 12h2" />
                    </>
                  ) : (
                    // 段落循环图标
                    <>
                      <path d="M17 2l4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                      <path d="M7 22l-4-4 4-4" />
                      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                    </>
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* 科技感控制区 - 修复点击和展开方向问题 */}
        <div className="absolute bottom-0 left-0 w-full z-50">
          <div 
            className="mx-auto overflow-hidden"
            style={{
              width: isProgressHovered ? '164px' : '120px',
              borderBottomLeftRadius: isProgressHovered ? '12px' : '60px',
              borderBottomRightRadius: isProgressHovered ? '12px' : '60px',
              boxShadow: isProgressHovered ? 
                '0 0 0 1px rgba(56, 182, 255, 0.6), 0 4px 8px rgba(0, 0, 0, 0.3)' : 
                '0 0 0 1px rgba(56, 182, 255, 0.3)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={() => setIsProgressHovered(true)}
            onMouseLeave={() => setIsProgressHovered(false)}
          >
            {/* 控制区背景 */}
            <div 
              className="relative bg-black/80 backdrop-blur-lg pt-1 pb-1.5 px-2 overflow-hidden"
              style={{
                position: 'relative',
                top: 0,
                height: isProgressHovered ? '55px' : '24px',
                transition: 'height 0.4s cubic-bezier(0.21, 1, 0.36, 1)'
              }}
            >
              {/* 科技感边框 */}
              {isProgressHovered && (
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                  <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-blue-400 to-transparent" />
                  <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-blue-400 to-transparent" />
                </div>
              )}
              
              {/* 给进度条区域添加类名 */}
              <div className="progress-area">
                {/* 时间和音量显示 */}
                <div className="text-center text-white text-xs font-medium mb-0.5 flex justify-center items-center gap-2">
                  {isProgressHovered ? (
                    <>
                      <div className="flex items-center">
                        <span className="text-blue-300/90">{formatTime(currentTime1)}</span>
                        <span className="mx-1 text-[10px] text-white/50">/</span>
                        <span className="text-white/70">{formatTime(duration)}</span>
                      </div>
                      <span className="text-[10px] text-blue-200/90 font-medium">
                        {Math.round(volume * 100)}%
                      </span>
                    </>
                  ) : (
                    formatTime(currentTime1)
                  )}
                </div>
                
                {/* 进度条 */}
                <div 
                  className="w-full cursor-pointer relative z-10"
                  onClick={handleProgressBarClick}
                >
                  <div className="w-full h-1 rounded-full overflow-hidden bg-[#0a2e47]">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-400 via-fuchsia-500 to-violet-600"
                      style={{ width: `${(currentTime1 / (duration || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* 控制区底部 */}
                <AnimatePresence>
                  {isProgressHovered && (
                    <motion.div 
                      className="mt-1"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-center justify-between">
                        {/* 左侧按钮组 */}
                        <div className="flex items-center gap-1.5">
                          {/* 倍速按钮 */}
                          <button 
                            className="w-5 h-5 rounded-full bg-blue-900/30 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
                              const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
                              handlePlaybackRateChange(PLAYBACK_RATES[nextIndex]);
                            }}
                          >
                            <span className="text-[10px] text-blue-300 translate-y-px -translate-x-[0.5px]">
                              {playbackRate}x
                            </span>
                          </button>
                          
                          {/* 循环模式按钮 */}
                          <button 
                            className="w-5 h-5 rounded-full bg-blue-900/30 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoopModeChange();
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                              className="text-blue-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {loopMode === 'continuous' ? (
                                // 顺序播放图标 - 修改为图片中的样式
                                <>
                                  <path d="M4 12h16" />
                                  <path d="M16 6l6 6-6 6" />
                                </>
                              ) : loopMode === 'sentence' ? (
                                // 单曲循环图标
                                <>
                                  <path d="M17 2l4 4-4 4" />
                                  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                                  <path d="M7 22l-4-4 4-4" />
                                  <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                                  <path d="M11 12h2" />
                                </>
                              ) : (
                                // 段落循环图标
                                <>
                                  <path d="M17 2l4 4-4 4" />
                                  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                                  <path d="M7 22l-4-4 4-4" />
                                  <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                                </>
                              )}
                            </svg>
                          </button>
                        </div>
                        
                        {/* 中间音量控制面板 */}
                        <div className="flex flex-col gap-[3px]">
                          {/* 第一行 - 1-5档位 */}
                          <div className="flex gap-[3px]">
                            {[...Array(5)].map((_, i) => {
                              const volumeLevel = (i + 1) * 10; // 10%, 20%, 30%, 40%, 50%
                              const isActive = Math.round(volume * 100) >= volumeLevel;
                              
                              return (
                                <div 
                                  key={`top-${i}`}
                                  className="relative group"
                                >
                                  {/* 提示工具提示 - 增加 z-index 确保在进度条上方 */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    <span className="text-[8px] text-white/90 bg-black/70 px-1 py-0.5 rounded whitespace-nowrap">
                                      {volumeLevel}%
                                    </span>
                                  </div>
                                  
                                  <div 
                                    className="w-2 h-2 rounded-full cursor-pointer transition-all duration-150"
                                    style={{
                                      backgroundColor: isActive 
                                        ? `rgba(${56 + i*20}, ${182 - i*10}, ${255 - i*20}, 0.9)` 
                                        : 'rgba(10, 46, 71, 0.5)',
                                      transform: isActive ? 'scale(1)' : 'scale(0.8)'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVolumeChange([volumeLevel]);
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* 第二行 - 6-10档位 */}
                          <div className="flex gap-[3px]">
                            {[...Array(5)].map((_, i) => {
                              const volumeLevel = (i + 6) * 10; // 60%, 70%, 80%, 90%, 100%
                              const isActive = Math.round(volume * 100) >= volumeLevel;
                              
                              return (
                                <div 
                                  key={`bottom-${i}`}
                                  className="relative group"
                                >
                                  {/* 提示工具提示 - 增加 z-index 确保在进度条上方 */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    <span className="text-[8px] text-white/90 bg-black/70 px-1 py-0.5 rounded whitespace-nowrap">
                                      {volumeLevel}%
                                    </span>
                                  </div>
                                  
                                  <div 
                                    className="w-2 h-2 rounded-full cursor-pointer transition-all duration-150"
                                    style={{
                                      backgroundColor: isActive 
                                        ? `rgba(${56 + (i+5)*20}, ${182 - (i+5)*10}, ${255 - (i+5)*20}, 0.9)` 
                                        : 'rgba(10, 46, 71, 0.5)',
                                      transform: isActive ? 'scale(1)' : 'scale(0.8)'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVolumeChange([volumeLevel]);
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* 右侧按钮组 */}
                        <div className="flex items-center gap-1.5">
                          {/* 音量按钮 - 替换原来的音频按钮 */}
                          <button 
                            className="w-5 h-5 rounded-full bg-blue-900/30 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newVolume = volume > 0 ? 0 : lastNonZeroVolume || 0.7;
                              handleVolumeChange([newVolume * 100]);
                            }}
                          >
                            {volume === 0 ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                                className="text-blue-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                <line x1="17" y1="9" x2="23" y2="15"></line>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                                className="text-blue-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                              </svg>
                            )}
                          </button>
                          
                          {/* 详情按钮 */}
                          <button 
                            className="w-5 h-5 rounded-full bg-blue-900/30 flex items-center justify-center"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                              className="text-blue-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="16" x2="12" y2="12"></line>
                              <line x1="12" y1="8" x2="12" y2="8"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 