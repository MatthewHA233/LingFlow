import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  isVisible?: boolean;
}

// 修改物理参数 - 基础值
const BASE_ROTATION_SPEED = 90; // 基础最大转速
const BASE_ACCELERATION = 120; // 基础加速度
const BASE_DECELERATION = 130; // 基础减速度
const MIN_ROTATION_SPEED = 0.1; // 最小转速

// 添加倍速选项
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

// 添加以下全局样式到组件顶部
const globalStyles = `
  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
`;

// 在组件顶部添加新的常量
const VINYL_POSITION_KEY = 'vinyl_player_position';

// 修改边界检查函数
const checkBoundaries = (pos: { x: number; y: number }) => {
  if (typeof window === 'undefined') return pos;

  const playerWidth = 180; // 唱片宽度
  const playerHeight = 240; // 唱片高度（包括唱针）
  const bottomBarHeight = 60; // 底部控制栏高度
  const allowedOverflow = 100; // 允许超出屏幕的距离（约半个唱片直径多一点）

  return {
    x: Math.min(
      Math.max(-allowedOverflow, pos.x), 
      window.innerWidth - playerWidth + allowedOverflow
    ),
    y: Math.min(
      Math.max(-allowedOverflow, pos.y), 
      window.innerHeight - playerHeight - bottomBarHeight + allowedOverflow
    )
  };
};

export function DraggableAudioPlayer({
  bookId,
  audioUrl,
  currentTime,
  onTimeUpdate,
  passiveMode,
  isVisible = true
}: DraggableAudioPlayerProps) {
  // 将useState钩子移到组件函数内部
  const [isAudioLoaded, setIsAudioLoaded] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem(VINYL_POSITION_KEY);
      if (savedPosition) {
        try {
          const pos = JSON.parse(savedPosition);
          // 检查保存的位置是否在有效范围内
          return checkBoundaries(pos);
        } catch (e) {
          console.error('解析保存的位置失败:', e);
        }
      }
    }
    // 默认位置
    const defaultPos = {
      x: window.innerWidth - 1450,
      y: window.innerHeight / 2 - 20
    };
    return checkBoundaries(defaultPos);
  });
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
  
  // 添加设备检测状态
  const [isMobile, setIsMobile] = useState<boolean>(false);
  // 修改展开控制逻辑，在移动端使用点击而非悬停
  const [isControlExpanded, setIsControlExpanded] = useState<boolean>(false);
  
  // 首先添加状态来控制动画触发
  const [slowdownAnimation, setSlowdownAnimation] = useState(false);
  const [speedupAnimation, setSpeedupAnimation] = useState(false);
  
  // 首先添加两个ref来跟踪动画定时器
  const slowdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speedupTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加循环模式动画的状态
  const [loopAnimation, setLoopAnimation] = useState<'none' | 'green' | 'orange' | 'scale'>('none');
  const loopAnimationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加快捷键弹窗状态
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const keyboardHelpTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // 检测设备类型
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px是常用的移动设备断点
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  // 修改位置保存效果
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 保存前进行边界检查
      const checkedPosition = checkBoundaries(position);
      if (checkedPosition.x !== position.x || checkedPosition.y !== position.y) {
        setPosition(checkedPosition);
      }
      localStorage.setItem(VINYL_POSITION_KEY, JSON.stringify(checkedPosition));
    }
  }, [position]);

  // 修改设置初始位置的逻辑
  useEffect(() => {
    if (isMobile) {
      const savedPosition = localStorage.getItem(VINYL_POSITION_KEY);
      if (!savedPosition) {
        // 移动设备的默认位置
        const defaultMobilePos = {
          x: window.innerWidth / 2 - 90,
          y: window.innerHeight - 150
        };
        setPosition(checkBoundaries(defaultMobilePos));
      }
    }
  }, [isMobile]);

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

    const newPosition = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };

    // 应用边界检查
    const checkedPosition = checkBoundaries(newPosition);
    setPosition(checkedPosition);
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

  // 然后修改处理播放速率变化的函数
  const handlePlaybackRateChange = useCallback((newRate: number) => {
    // 清除所有现有的动画状态和定时器
    if (slowdownTimerRef.current) {
      clearTimeout(slowdownTimerRef.current);
      slowdownTimerRef.current = null;
    }
    if (speedupTimerRef.current) {
      clearTimeout(speedupTimerRef.current);
      speedupTimerRef.current = null;
    }
    
    // 重置动画状态
    setSlowdownAnimation(false);
    setSpeedupAnimation(false);
    
    // 设置微小延迟后再触发新动画，确保DOM完全重置
    setTimeout(() => {
      // 检测速度变化方向来触发相应动画
      if (newRate < playbackRate) {
        setSlowdownAnimation(true);
        slowdownTimerRef.current = setTimeout(() => {
          setSlowdownAnimation(false);
          slowdownTimerRef.current = null;
        }, 600);
      } else if (newRate > playbackRate) {
        setSpeedupAnimation(true);
        speedupTimerRef.current = setTimeout(() => {
          setSpeedupAnimation(false);
          speedupTimerRef.current = null;
        }, 600);
      }
    }, 10);
    
    // 设置新速度
    AudioController.setPlaybackRate(newRate);
    setPlaybackRate(newRate);
    playbackRateRef.current = newRate;
    
    // 添加 toast 提示
    toast.success(`已切换到播放速度: ${newRate}x`, {
      position: 'bottom-right',
      duration: 1500,
    });
  }, [playbackRate]);

  // 监听键盘控制器倍速设置事件 - 移到handlePlaybackRateChange定义之后
  useEffect(() => {
    const handleKeyboardPlaybackRate = (e: CustomEvent) => {
      const { rate } = e.detail;
      // 直接调用handlePlaybackRateChange来触发动画效果
      handlePlaybackRateChange(rate);
    };

    window.addEventListener('keyboard-playback-rate-change', handleKeyboardPlaybackRate as EventListener);
    return () => {
      window.removeEventListener('keyboard-playback-rate-change', handleKeyboardPlaybackRate as EventListener);
    };
  }, [handlePlaybackRateChange]);

  // 清理定时器 - 添加到组件卸载时
  useEffect(() => {
    return () => {
      if (slowdownTimerRef.current) clearTimeout(slowdownTimerRef.current);
      if (speedupTimerRef.current) clearTimeout(speedupTimerRef.current);
    };
  }, []);

  // 修改处理循环模式变化函数
  const handleLoopModeChange = () => {
    // 清除现有动画状态和定时器
    if (loopAnimationTimerRef.current) {
      clearTimeout(loopAnimationTimerRef.current);
      loopAnimationTimerRef.current = null;
    }
    
    const modes: ('continuous' | 'sentence' | 'block')[] = ['continuous', 'sentence', 'block'];
    const currentIndex = modes.indexOf(loopMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    // 设置新的循环模式
    setLoopMode(nextMode);
    AudioController.setPlayMode(nextMode);
    
    // 根据新模式设置不同的动画状态 - 不再使用定时器清除
    if (nextMode === 'sentence') {
      setLoopAnimation('green'); // 句子循环使用绿色动画
    } else if (nextMode === 'block') {
      setLoopAnimation('orange'); // 语境块循环使用橙色动画
    } else {
      setLoopAnimation('scale'); // 顺序播放时无荧光
      
      // 对于顺序播放模式，我们仍然使用短暂动画然后恢复
      loopAnimationTimerRef.current = setTimeout(() => {
        setLoopAnimation('none');
        loopAnimationTimerRef.current = null;
      }, 600);
    }
    
    // 提示消息
    toast.success(`已切换到${nextMode === 'continuous' ? '顺序播放' : 
      nextMode === 'sentence' ? '句子循环' : '语境块循环'}`);
  };

  // 组件卸载时清理循环动画定时器
  useEffect(() => {
    return () => {
      if (loopAnimationTimerRef.current) {
        clearTimeout(loopAnimationTimerRef.current);
      }
      if (keyboardHelpTimerRef.current) {
        clearTimeout(keyboardHelpTimerRef.current);
      }
    };
  }, []);

  // 处理快捷键弹窗显示
  const handleKeyboardHelpMouseEnter = (e: React.MouseEvent) => {
    const buttonRect = e.currentTarget.getBoundingClientRect();
    // 找到控制面板容器
    const controlPanel = e.currentTarget.closest('.progress-area');
    const panelRect = controlPanel?.getBoundingClientRect();
    
    // 如果找到了控制面板，相对于面板居中；否则相对于按钮居中
    const centerX = panelRect ? 
      panelRect.left + panelRect.width / 2 - 15 : // 稍微靠左15px
      buttonRect.left + buttonRect.width / 2 - 15;
    
    setMousePosition({
      x: centerX,
      y: buttonRect.bottom + 8
    });
    
    console.log('Button rect:', buttonRect);
    console.log('Panel rect:', panelRect);
    console.log('Popup position:', { x: centerX, y: buttonRect.bottom + 8 });
    
    // 清除之前的定时器
    if (keyboardHelpTimerRef.current) {
      clearTimeout(keyboardHelpTimerRef.current);
    }
    
    // 延迟显示弹窗
    keyboardHelpTimerRef.current = setTimeout(() => {
      setShowKeyboardHelp(true);
    }, 300);
  };

  const handleKeyboardHelpMouseLeave = () => {
    // 清除定时器
    if (keyboardHelpTimerRef.current) {
      clearTimeout(keyboardHelpTimerRef.current);
    }
    
    // 延迟隐藏弹窗
    keyboardHelpTimerRef.current = setTimeout(() => {
      setShowKeyboardHelp(false);
    }, 100);
  };

  // 处理弹窗鼠标事件
  const handlePopupMouseEnter = () => {
    // 鼠标进入弹窗时，清除隐藏定时器
    if (keyboardHelpTimerRef.current) {
      clearTimeout(keyboardHelpTimerRef.current);
    }
  };

  const handlePopupMouseLeave = () => {
    // 鼠标离开弹窗时，延迟隐藏
    keyboardHelpTimerRef.current = setTimeout(() => {
      setShowKeyboardHelp(false);
    }, 100);
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

  // 修改控制栏交互 - 在移动设备上使用点击切换控制栏展开状态
  const handleControlAreaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      setIsControlExpanded(!isControlExpanded);
    }
  };

  // 添加触摸事件处理 - 修复移动端拖拽问题
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // 检查触摸的元素是否在进度条区域内
    const progressArea = document.querySelector('.progress-area');
    if (progressArea?.contains(e.target as Node)) {
      return; // 如果在进度条区域内，不启动拖拽
    }

    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;

    const newPosition = {
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    };

    // 应用边界检查
    const checkedPosition = checkBoundaries(newPosition);
    setPosition(checkedPosition);
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加触摸事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  // 添加窗口大小变化监听
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => checkBoundaries(prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 计算实际位置 - 当不可见时放到屏幕外
  const actualPosition = useMemo(() => {
    if (isVisible) {
      return position; // 正常位置
    } else {
      // 移到屏幕外，但保持组件实例活跃
      return { 
        x: -2000, 
        y: -2000 
      };
    }
  }, [position, isVisible]);

  return (
    <>
      {/* 添加全局样式 */}
      <style jsx global>{globalStyles}</style>
      
      <motion.div
        className="fixed z-[9999] select-none touch-manipulation"
        style={{
          top: actualPosition.y,
          left: actualPosition.x,
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          transform: 'none',
          transformOrigin: 'center center',
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        whileHover={{
          scale: isMobile ? 1 : 1.02,
          transition: { duration: 0.3 }
        }}
      >
        {/* 唱片主体部分 */}
        <div className="relative select-none">
          {/* 左侧减速箭头 - 优化点击区域 */}
          <div 
            className="absolute z-30 cursor-pointer select-none transition-transform hover:scale-110"
            style={{ 
              top: '75px',
              left: '30px',
              transform: 'rotate(-90deg)',
              width: '40px', // 减小容器尺寸
              height: '30px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
              if (currentIndex > 0) {
                handlePlaybackRateChange(PLAYBACK_RATES[currentIndex - 1]);
              }
            }}
          >
            <svg 
              width="40" 
              height="30" 
              viewBox="0 0 50 40" 
              fill="none" 
              strokeWidth="2"
              style={{ pointerEvents: 'none' }} // 禁用SVG内部的点击事件，只在父div上响应
              className={`
                transition-all duration-200 
                stroke-white 
                ${!slowdownAnimation && 'hover:stroke-red-400'} 
                active:scale-90 
                ${slowdownAnimation ? 'animate-energy-flow-red' : ''}
              `}
            >
              <path d="M45,35 Q25,15 5,35" strokeLinecap="round"/>  
              <path d="M10,35 L5,35 L5,30" strokeLinecap="round" strokeLinejoin="round"/>  
            </svg>
          </div>

          {/* 倍速显示 */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 z-30 cursor-pointer select-none"
            style={{ 
              top: '58px',
              width: '48px', // 限制点击区域宽度
              height: '24px', // 限制点击区域高度
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
              const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
              handlePlaybackRateChange(PLAYBACK_RATES[nextIndex]);
            }}
          >
            <div className={cn(
              "flex flex-col items-center",
              "mechanical-font",
              playbackRate < 1 && "speed-state-slow",
              playbackRate > 1 && "speed-state-fast",
              slowdownAnimation && "animate-flash-red", 
              speedupAnimation && "animate-flash-blue"
            )}
            style={{
              clipPath: playbackRate !== 1 ? 'polygon(0 0, 100% 0, 95% 50%, 100% 100%, 0 100%, 5% 50%)' : undefined,
              padding: playbackRate !== 1 ? '0 12px' : undefined,
            }}
            >
              {/* 速度数值 */}
              <span 
                className={cn(
                  "text-sm drop-shadow-lg select-none transition-colors text-white/90",
                  playbackRate !== 1 ? "font-extrabold" : "font-medium"
                )}
              >
                {playbackRate}x
              </span>
            </div>

            {/* 将图标移到外层，但仍然保持相对定位 */}
            {playbackRate !== 1 && (
              <div 
                className="relative"
                style={{
                  marginTop: '-3rem',
                  pointerEvents: 'none',
                  position: 'absolute',
                  left: '35%',
                  transform: 'translateX(-50%)',
                  width: '150px',
                  height: '150px',
                  overflow: 'visible',
                  zIndex: 50
                }}
              >
                {/* 乌龟图标 */}
                {playbackRate < 1 && (
                  <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      animation: 'custom-turtle-slide 1s forwards, turtle-crawl 12s ease-in-out infinite 1s'
                    }}
                  >
                    <svg 
                      width="14" 
                      height="14"
                      viewBox="0 0 26 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="opacity-90 red-glow"
                    >
                      <path d="M13 8a6 8 0 1 0 0 12 6 8 0 0 0 0-12" transform="rotate(90 12 14)" />
                      <path d="M12 10a4 6 0 1 0 0 8 4 6 0 0 0 0-8" transform="rotate(90 12 14)" />
                      <path d="M9 10v9" transform="rotate(90 12 14)" strokeWidth="1" />
                      <path d="M6 13q3-4 6 0" transform="rotate(90 12 14)" strokeWidth="1" />
                      <path d="M6 15q3+4 6 0" transform="rotate(90 12 14)" strokeWidth="1" />
                      <path d="M8 5c-1-1-1-2-0.5-2.5" strokeWidth="1.8" />
                      <path d="M8 17c-1 1-1 2-0.5 2.5" strokeWidth="1.8" />
                      <path d="M16 5c1-1 1-2 0.5-2.5" strokeWidth="1.8" />
                      <path d="M16 17c1 1 1 2 0.5 2.5" strokeWidth="1.8" />
                      <path d="M18 11c3.5 0 5.5-1.5 6-3" strokeWidth="2.8" />
                      <path d="M6 11c-2.5 0-4-1-4.5-2.5" strokeWidth="1.8" />
                    </svg>
                  </div>
                )}
                
                {/* 火箭图标 */}
                {playbackRate > 1 && (
                  <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      animation: 'custom-rocket-slide 1s forwards, rocket-float 1.4s ease-in-out infinite 1s'
                    }}
                  >
                    <svg 
                      width="14" 
                      height="14"
                      viewBox="0 0 26 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="opacity-90 blue-glow"
                    >
                      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧加速箭头 - 优化点击区域 */}
          <div 
            className="absolute z-30 cursor-pointer select-none transition-transform hover:scale-110"
            style={{ 
              top: '75px',
              right: '30px',
              transform: 'rotate(90deg)',
              width: '40px', // 减小容器尺寸
              height: '30px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
              if (currentIndex < PLAYBACK_RATES.length - 1) {
                handlePlaybackRateChange(PLAYBACK_RATES[currentIndex + 1]);
              }
            }}
          >
            <svg 
              width="40" 
              height="30" 
              viewBox="0 0 50 40" 
              fill="none" 
              strokeWidth="2"
              style={{ pointerEvents: 'none' }} // 禁用SVG内部的点击事件，只在父div上响应
              className={`
                transition-all duration-200 
                stroke-white 
                ${!speedupAnimation && 'hover:stroke-blue-400'} 
                active:scale-90 
                ${speedupAnimation ? 'animate-energy-flow-blue' : ''}
              `}
            >
              <path d="M5,35 Q25,15 45,35" strokeLinecap="round"/>  
              <path d="M40,35 L45,35 L45,30" strokeLinecap="round" strokeLinejoin="round"/>  
            </svg>
          </div>

          {/* 实际唱片圆盘 */}
          <div 
            id="record-disc"
            className="relative w-[180px] h-[180px] rounded-full overflow-visible cursor-pointer select-none"
            onClick={togglePlayPause}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'none',
            }}
          >
            {/* 唱片内容容器 */}
            <div className="absolute inset-0 rounded-full overflow-hidden border-8 border-black select-none">
              {/* 唱片封面图 */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-indigo-900 select-none">
                {coverUrl && (
                  <Image
                    src={coverUrl}
                    alt="Album cover"
                    fill
                    className="object-cover select-none"
                    unselectable="on"
                    draggable={false}
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

            {/* 中心区域 - 移除倍速按钮 */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
              {/* 黑色圆环背景 */}
              <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                {/* 白色中心孔 */}
                <div className="absolute w-4 h-4 rounded-full bg-white/20 pointer-events-none" />
              </div>
            </div>

            {/* 循环模式按钮 */}
            <div 
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();  // 已有这个，很好
                e.preventDefault();    // 添加这个以确保完全阻止事件
                handleLoopModeChange();
              }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={cn(
                    "opacity-90",
                    loopMode === 'sentence' && 'glow-green',
                    loopMode === 'block' && 'glow-orange',
                    loopAnimation === 'green' && 'animate-loop-green',
                    loopAnimation === 'orange' && 'animate-loop-orange',
                    loopAnimation === 'scale' && 'animate-loop-scale'
                  )}
                >
                  {/* 保持现有的循环模式图标不变 */}
                  {loopMode === 'continuous' ? (
                    <>
                      <path d="M4 12h16" />
                      <path d="M16 6l6 6-6 6" />
                    </>
                  ) : loopMode === 'sentence' ? (
                    <>
                      <path d="M17 2l4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                      <path d="M7 22l-4-4 4-4" />
                      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                      <path d="M11 12h2" />
                    </>
                  ) : (
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
          
          {/* 科技感控制区 - 修改交互方式 */}
          <div className="absolute bottom-0 left-0 w-full z-50">
            <div 
              className="mx-auto overflow-hidden"
              style={{
                width: (isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) ? '164px' : '120px',
                borderBottomLeftRadius: (isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) ? '12px' : '60px',
                borderBottomRightRadius: (isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) ? '12px' : '60px',
                boxShadow: (isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) ? 
                  '0 0 0 1px rgba(56, 182, 255, 0.6), 0 4px 8px rgba(0, 0, 0, 0.3)' : 
                  '0 0 0 1px rgba(56, 182, 255, 0.3)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onClick={isMobile ? handleControlAreaClick : undefined}
              onMouseEnter={!isMobile ? () => setIsProgressHovered(true) : undefined}
              onMouseLeave={!isMobile ? () => setIsProgressHovered(false) : undefined}
            >
              {/* 控制区背景 */}
              <div 
                className="relative bg-black/80 backdrop-blur-lg pt-1 pb-1.5 px-2 overflow-hidden progress-area"
                style={{
                  position: 'relative',
                  top: 0,
                  height: (isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) ? '55px' : '24px',
                  transition: 'height 0.4s cubic-bezier(0.21, 1, 0.36, 1)'
                }}
              >
                {/* 科技感边框 */}
                {(isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) && (
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
                    {(isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) ? (
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
                    {(isMobile ? isControlExpanded : (isProgressHovered || showKeyboardHelp)) && (
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
                                // 静音图标
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                                  className="text-blue-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                    <line x1="23" y1="9" x2="17" y2="15"></line>
                                    <line x1="17" y1="9" x2="23" y2="15"></line>
                                  </svg>
                              ) : (
                                // 音量图标
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
                              className="w-5 h-5 rounded-full bg-blue-900/30 flex items-center justify-center relative"
                              onMouseEnter={handleKeyboardHelpMouseEnter}
                              onMouseLeave={handleKeyboardHelpMouseLeave}
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
        
        {/* 大型唱片指针 */}
        <div 
          className={cn(
            "absolute -top-8 left-1/3 z-40 transform-gpu cursor-pointer select-none",
            isPlaying ? "rotate-[15deg]" : "rotate-[-10deg]"
          )}
          style={{ 
            transformOrigin: "90% 75%", 
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isPlaying ? 'rotate(15deg)' : 'rotate(-10deg)',
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation();
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
      </motion.div>
      
      {/* 快捷键弹窗 */}
      <AnimatePresence>
        {showKeyboardHelp && (
          <motion.div
            className="fixed z-[10000] pointer-events-auto"
            style={{
              left: mousePosition.x,
              top: mousePosition.y,
              transform: 'translateX(-50%)'
            }}
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onMouseEnter={handlePopupMouseEnter}
            onMouseLeave={handlePopupMouseLeave}
          >
            <div className="bg-black/90 backdrop-blur-lg rounded-lg p-3 shadow-2xl border border-blue-400/30"
                 style={{
                   boxShadow: `
                     0 0 20px 2px rgba(56, 182, 255, 0.2),
                     0 0 10px 1px rgba(147, 51, 234, 0.15),
                     0 4px 20px rgba(0, 0, 0, 0.5)
                   `
                 }}>
              {/* 弹窗标题 */}
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-blue-400/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                  className="text-blue-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <path d="M6 8h.01"></path>
                  <path d="M10 8h.01"></path>
                  <path d="M14 8h.01"></path>
                  <path d="M18 8h.01"></path>
                  <path d="M8 12h.01"></path>
                  <path d="M12 12h.01"></path>
                  <path d="M16 12h.01"></path>
                  <path d="M7 16h10"></path>
                </svg>
                <span className="text-xs font-medium text-blue-300">快捷键控制</span>
              </div>
              
              {/* 快捷键列表 */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/80">开关快捷控制</span>
                  <kbd 
                    className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 模拟 Ctrl+Alt+S 按键
                      const event = new KeyboardEvent('keydown', {
                        key: 's',
                        ctrlKey: true,
                        altKey: true,
                        bubbles: true
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    Ctrl+Alt+S
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/80">播放/暂停</span>
                  <kbd 
                    className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const event = new KeyboardEvent('keydown', {
                        key: ' ',
                        bubbles: true
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    Space
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/80">上一句/下一句</span>
                  <div className="flex gap-1">
                    <kbd 
                      className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const event = new KeyboardEvent('keydown', {
                          key: 'w',
                          bubbles: true
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      W
                    </kbd>
                    <kbd 
                      className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const event = new KeyboardEvent('keydown', {
                          key: 's',
                          bubbles: true
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      S
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/80">快退/快进</span>
                  <div className="flex gap-1">
                    <kbd 
                      className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const event = new KeyboardEvent('keydown', {
                          key: 'a',
                          bubbles: true
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      A
                    </kbd>
                    <kbd 
                      className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const event = new KeyboardEvent('keydown', {
                          key: 'd',
                          bubbles: true
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      D
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/80">播放倍速</span>
                  <div className="flex gap-1">
                    <kbd 
                      className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // 循环触发1-6按键
                        const keys = ['1', '2', '3', '4', '5', '6'];
                        let currentIndex = 0;
                        const triggerNext = () => {
                          const event = new KeyboardEvent('keydown', {
                            key: keys[currentIndex],
                            bubbles: true
                          });
                          window.dispatchEvent(event);
                          currentIndex = (currentIndex + 1) % keys.length;
                        };
                        triggerNext();
                      }}
                    >
                      1-6
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/80">循环模式</span>
                  <kbd 
                    className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const event = new KeyboardEvent('keydown', {
                        key: 'q',
                        bubbles: true
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    Q
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/80">翻译显隐</span>
                  <kbd 
                    className="px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-300 font-mono text-[10px] cursor-pointer hover:bg-blue-800/60 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const event = new KeyboardEvent('keydown', {
                        key: 'e',
                        bubbles: true
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    E
                  </kbd>
                </div>
              </div>
              
              {/* 底部提示 */}
              <div className="mt-2 pt-1.5 border-t border-blue-400/20">
                <p className="text-[9px] text-white/60 text-center">
                  先按 <kbd 
                    className="px-1 py-0.5 bg-blue-900/30 rounded text-blue-300 font-mono text-[9px] cursor-pointer hover:bg-blue-800/40 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const event = new KeyboardEvent('keydown', {
                        key: 's',
                        ctrlKey: true,
                        altKey: true,
                        bubbles: true
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    Ctrl+Alt+S
                  </kbd> 开启控制模式
                </p>
              </div>
            </div>
            
            {/* 弹窗箭头 */}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <div className="w-4 h-4 bg-black/90 border-l border-t border-blue-400/30 transform rotate-45"
                   style={{
                     boxShadow: `
                       0 0 10px 1px rgba(56, 182, 255, 0.1),
                       0 0 5px 0 rgba(147, 51, 234, 0.1)
                     `
                   }}></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 