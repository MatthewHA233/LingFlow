/**
 * 全局音频控制器 - 单例模式
 * 统一管理所有音频操作，解决冲突问题
 */

import { AudioRangeLoader } from './audio-range-loader';

// 定义事件类型
export const AUDIO_EVENTS = {
  STATE_CHANGE: 'audio-state-change',
  TIME_UPDATE: 'audio-time-update',
  SOURCE_CHANGE: 'audio-source-change',
  DURATION_CHANGE: 'audio-duration-change',
  ERROR: 'audio-error',
  END: 'audio-end',
  CONTEXT_CHANGE: 'audio-context-change'
};

// 播放上下文类型
export type PlayContext = 'main' | 'sentence' | 'alignment' | 'word';

// 播放模式
export type PlayMode = 'continuous' | 'sentence' | 'block' | 'none';

// 添加 SpeechResult 接口
interface SpeechResult {
  id: string;
  audio_url: string;
}

// 统一的时间格式 - 全部使用毫秒
interface AudioState {
  url: string;                 // 当前音频URL
  isPlaying: boolean;          // 是否正在播放
  currentTime: number;         // 当前时间(毫秒)
  duration: number;            // 总时长(毫秒)
  volume: number;              // 音量(0-1)
  playbackRate: number;        // 播放速度
  context: PlayContext;        // 当前播放上下文
  mode: PlayMode;              // 当前播放模式
  loop: {                      // 循环播放设置
    active: boolean;           // 是否循环
    start: number;             // 循环开始时间(毫秒)
    end: number;               // 循环结束时间(毫秒)
  };
  // 添加新字段
  speechId?: string;           // 当前播放的 speech_id
}

class AudioControllerClass {
  private audio: HTMLAudioElement | null = null;
  private state: AudioState = {
    url: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    playbackRate: 1,
    context: 'main',
    mode: 'continuous',
    loop: {
      active: false,
      start: 0,
      end: 0
    }
  };
  
  private loopCheckInterval: any = null;
  private timeUpdateInterval: any = null;
  private callbacks: Record<string, Set<Function>> = {};
  
  private playbackTimeout: any = null;
  private isInitialized = false;
  
  // 添加语音缓存
  private speechCache: Map<string, SpeechResult> = new Map();
  
  // 添加播放请求队列管理
  private currentPlayPromise: Promise<void> | null = null;
  private isPlayRequested = false;
  private playRequestId = 0; // 添加请求ID来跟踪最新的播放请求
  
  // Range分片加载器
  private rangeLoader: AudioRangeLoader = new AudioRangeLoader({
    chunkSize: 512 * 1024, // 512KB 分片大小，匹配CDN配置
    maxCacheSize: 50 * 1024 * 1024, // 最大缓存50MB
    preloadStrategy: 'adaptive', // 自适应预加载策略
    maxRetries: 3, // 最大重试次数
    retryDelay: 1000 // 重试延迟
  });
  
  constructor() {
    // 检查是否在浏览器环境
    if (typeof window !== 'undefined') {
      // 推迟初始化到下一个事件循环，确保在DOM完全加载后
      setTimeout(() => {
        this.initializeAudio();
      }, 0);
    }
  }
  
  // 安全地初始化音频
  private initializeAudio() {
    if (this.isInitialized) return;
    
    try {
      // 初始化音频元素
      this.audio = new Audio();
      this.initAudioEvents();
      this.isInitialized = true;
      console.log('音频控制器初始化成功');
    } catch (error) {
      console.error('初始化音频控制器失败:', error);
    }
  }
  
  // 初始化音频事件监听
  private initAudioEvents() {
    if (!this.audio) return;
    
    console.log('[AudioController] 初始化音频事件监听器');
    
    this.audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);
    this.audio.addEventListener('play', () => {
      console.log('[AudioController] 音频开始播放');
      this.updateState({ isPlaying: true });
    });
    this.audio.addEventListener('pause', () => {
      console.log('[AudioController] 音频暂停');
      this.updateState({ isPlaying: false });
    });
    
    // 清除旧的定时器
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    
    // 设置新的定时器检查循环状态
    this.timeUpdateInterval = setInterval(() => {
      if (this.audio && this.state.isPlaying) {
        // 检查循环边界
        this.checkLoopBoundaries();
        
        // 广播时间更新
        this.broadcastTimeUpdate();
      }
    }, 20); // 更高频率检查，确保不会错过循环点
    
    console.log('[AudioController] 循环检测定时器已设置，间隔: 20ms');
  }
  
  // 修改检查循环边界的方法
  private checkLoopBoundaries() {
    if (!this.audio || !this.state.loop.active) return;
    
    const currentTimeSec = this.audio.currentTime;
    const currentTimeMs = Math.floor(currentTimeSec * 1000);
    const loopEndMs = this.state.loop.end;
    
    // 每秒记录一次当前状态(调试用)
    if (currentTimeMs % 1000 < 50) {
      console.log(`[AudioController] 循环状态:`, {
        当前时间: currentTimeMs,
        循环终点: loopEndMs,
        循环起点: this.state.loop.start,
        剩余时间: loopEndMs - currentTimeMs
      });
    }
    
    // 当到达循环终点时
    if (currentTimeMs >= loopEndMs) {
      console.log(`[AudioController] 检测到循环点!`, {
        当前时间: currentTimeMs,
        循环终点: loopEndMs,
        时间差: currentTimeMs - loopEndMs
      });
      
      // 1. 暂停
      this.audio.pause();
      
      // 2. 重置到开始位置
      const startTimeSec = this.state.loop.start / 1000;
      console.log(`[AudioController] 重置到开始位置: ${startTimeSec}秒`);
      this.audio.currentTime = startTimeSec;
      
      // 3. 100ms后恢复播放(给一个明显的暂停感)
      setTimeout(() => {
        console.log('[AudioController] 恢复播放');
        this.audio?.play().catch(err => {
          console.error('[AudioController] 循环播放失败:', err);
        });
      }, 100);
    }
  }
  
  // 播放状态更新并广播
  private updateState(partialState: Partial<AudioState>) {
    this.state = { ...this.state, ...partialState };
    
    // 广播状态变更事件
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.STATE_CHANGE, {
      detail: this.state
    }));
    
    // 如果是上下文变更，单独广播
    if (partialState.context !== undefined) {
      window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.CONTEXT_CHANGE, {
        detail: { context: this.state.context }
      }));
    }
  }
  
  // 时间更新广播
  private broadcastTimeUpdate() {
    if (!this.audio) return;
    
    const currentTimeMs = this.audio.currentTime * 1000;
    this.state.currentTime = currentTimeMs;
    
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.TIME_UPDATE, {
      detail: { 
        currentTime: currentTimeMs,
        context: this.state.context
      }
    }));
  }
  
  // 元数据加载完成处理
  private handleLoadedMetadata = () => {
    if (!this.audio) return;
    
    const durationMs = this.audio.duration * 1000;
    this.updateState({ duration: durationMs });
    
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.DURATION_CHANGE, {
      detail: { duration: durationMs }
    }));
  };
  
  // 时间更新处理
  private handleTimeUpdate = () => {
    // 处理时间更新
    this.broadcastTimeUpdate();
    
    // 在这里也检查循环边界(双重保障)
    if (this.state.loop.active) {
      this.checkLoopBoundaries();
    }
    
    // 播放过程中的智能预加载
    if (this.audio && this.state.url && this.state.isPlaying) {
      const currentTimeMs = this.audio.currentTime * 1000;
      const durationMs = this.audio.duration * 1000;
      
      // 每5秒检查一次预加载需求（避免过于频繁）
      if (Math.floor(currentTimeMs / 5000) !== Math.floor((currentTimeMs - 100) / 5000)) {
        this.triggerSmartPreload(currentTimeMs, durationMs)
          .catch((err: Error) => {
            console.warn('[AudioController] 播放中预加载失败:', err);
          });
      }
    }
  };
  
  // 播放结束处理
  private handleEnded = () => {
    this.updateState({ isPlaying: false });
    
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.END, {
      detail: { context: this.state.context }
    }));
  };
  
  // 错误处理
  private handleError = (e: ErrorEvent) => {
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.ERROR, {
      detail: { error: e, context: this.state.context }
    }));
  };
  
  // 紧急停止和清理所有音频
  emergencyCleanup(): void {
    console.log('[AudioController] 执行紧急清理');
    
    // 取消所有播放请求
    this.playRequestId++;
    this.isPlayRequested = false;
    this.currentPlayPromise = null;
    
    if (this.audio) {
      try {
      this.audio.pause();
      this.audio.currentTime = 0;
      } catch (error) {
        console.warn('[AudioController] 紧急清理时暂停音频失败:', error);
      }
    }
    
    // 清除所有定时器
    if (this.loopCheckInterval) {
      clearInterval(this.loopCheckInterval);
      this.loopCheckInterval = null;
    }
    
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
    
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    
    // 重置状态
    this.updateState({
      isPlaying: false,
      currentTime: 0,
      loop: { active: false, start: 0, end: 0 }
    });
    
    // 清理Range分片缓存
    this.rangeLoader.clear();
    console.log('[AudioController] Range分片缓存已清理');
  }
  
  // 清理资源
  private cleanup() {
      this.emergencyCleanup();
      
    // 移除所有事件监听器
    if (this.audio) {
      this.audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
      this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
      this.audio.removeEventListener('ended', this.handleEnded);
      this.audio.removeEventListener('error', this.handleError);
    }
  }
  
  // 添加预加载方法
  async preloadAudio(url: string): Promise<void> {
    if (!url) return;
    
    try {
      // 创建一个临时的 Audio 元素来预加载
      const tempAudio = new Audio();
      tempAudio.preload = 'auto';
      tempAudio.src = url;
      
      // 等待加载元数据
      await new Promise((resolve) => {
        tempAudio.addEventListener('loadedmetadata', resolve, { once: true });
      });
      
      console.log('音频预加载完成:', url);
    } catch (err) {
      console.error('音频预加载失败:', err);
    }
  }

  // 触发智能预加载
  private async triggerSmartPreload(currentTimeMs: number, durationMs: number): Promise<void> {
    if (!this.state.url || !this.audio) return;
    
    const fileSize = await this.rangeLoader.getFileSize(this.state.url);
    if (fileSize === 0) return;
    
    await this.rangeLoader.preloadChunks(
      this.state.url, 
      currentTimeMs, 
      durationMs, 
      fileSize
    );
  }
  
  // 启动智能预加载
  private async startIntelligentPreloading(): Promise<void> {
    if (!this.audio || !this.state.url) return;
    
    // 等待音频元数据加载完成
    if (this.audio.duration) {
      const durationMs = this.audio.duration * 1000;
      const currentTimeMs = this.audio.currentTime * 1000;
      
      // 开始预加载当前位置附近的分片
      await this.triggerSmartPreload(currentTimeMs, durationMs);
    }
  }
  
  // 修改缓存方法，添加预加载
  async cacheSpeechResult(result: SpeechResult) {
    this.speechCache.set(result.id, result);
    
    // 如果URL存在，预加载音频
    if (result.audio_url) {
      await this.preloadAudio(result.audio_url);
    }
  }

  // 获取缓存的音频URL
  getCachedAudioUrl(speechId: string): string | undefined {
    return this.speechCache.get(speechId)?.audio_url;
  }
  
  // 设置音频源
  async setSource(url: string, speechId?: string): Promise<void> {
    if (!this.audio) {
      throw new Error('音频控制器未初始化');
    }

    // 如果提供了 speechId，先检查缓存
    if (speechId) {
      const cachedUrl = this.getCachedAudioUrl(speechId);
      if (cachedUrl) {
        url = cachedUrl;
      }
      
      // 缓存新的结果
      this.cacheSpeechResult({
        id: speechId,
        audio_url: url
      });
    }

    // 如果是同一URL，不需要重新加载
    if (this.state.url === url) {
      return;
    }

    console.log('[AudioController] 设置音频源', { url, speechId });

    // 先暂停当前播放
    this.audio.pause();
    
    // 重置状态
    this.updateState({
      url,
      speechId,
      isPlaying: false,
      currentTime: 0,
      loop: { active: false, start: 0, end: 0 }
    });
    
    // 异步检测Range支持（不阻塞主流程）
    this.rangeLoader.checkRangeSupport(url).then(supportsRange => {
      if (supportsRange) {
        console.log('[AudioController] ✅ 检测到CDN支持Range请求，将启用智能分片加载');
      } else {
        console.log('[AudioController] ❌ CDN不支持Range请求，使用传统加载方式');
      }
    }).catch(err => {
      console.warn('[AudioController] Range支持检测异常:', err);
    });
    
    // 设置新源
    this.audio.src = url;
    
    // 广播源变更事件
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.SOURCE_CHANGE, {
      detail: { url }
    }));
    
    // 使用 Promise 来处理加载
    return new Promise((resolve, reject) => {
      const handleCanPlay = () => {
        if (!this.audio) return;
        this.audio.removeEventListener('canplay', handleCanPlay);
        this.audio.removeEventListener('error', handleError);
        console.log('[AudioController] 音频加载完成');
        
        // 音频加载完成后，开始智能预加载
        this.startIntelligentPreloading().catch((err: Error) => {
          console.warn('[AudioController] 智能预加载启动失败:', err);
        });
        
        resolve();
      };
      
      const handleError = (e: Event) => {
        if (!this.audio) return;
        this.audio.removeEventListener('canplay', handleCanPlay);
        this.audio.removeEventListener('error', handleError);
        console.error('[AudioController] 音频加载失败:', e);
        // 不抛出错误，而是静默处理
        resolve();
      };
      
      if (!this.audio) {
        resolve();
        return;
      }
      
      this.audio.addEventListener('canplay', handleCanPlay);
      this.audio.addEventListener('error', handleError);
      
      // 开始加载
      this.audio.load();
      
      // 设置超时，避免无限等待
      setTimeout(() => {
        if (!this.audio) return;
        this.audio.removeEventListener('canplay', handleCanPlay);
        this.audio.removeEventListener('error', handleError);
        console.log('[AudioController] 音频加载超时，继续执行');
        resolve();
      }, 5000);
    });
  }
  
  // 修改 setPlayMode 方法
  setPlayMode(mode: PlayMode, currentTimeMs?: number, endTimeMs?: number): void {
    console.log('[AudioController] 设置播放模式', {
      mode,
      currentTimeMs,
      endTimeMs,
      currentState: {
        currentTime: this.audio?.currentTime,
        isPlaying: this.state.isPlaying,
        loop: this.state.loop,
        currentMode: this.state.mode
      }
    });

    // 更新状态
    this.state.mode = mode;

    switch (mode) {
      case 'sentence':
      case 'block':
        if (currentTimeMs !== undefined && endTimeMs !== undefined) {
          // 如果当前已经在循环，且范围相同，不需要重新设置
          if (this.state.loop.active &&
              this.state.loop.start === currentTimeMs &&
              this.state.loop.end === endTimeMs) {
            return;
          }

          console.log('[AudioController] 启用循环模式', {
            start: currentTimeMs,
            end: endTimeMs,
            mode
          });
          
          this.state.loop.active = true;
          this.state.loop.start = currentTimeMs;
          this.state.loop.end = endTimeMs;

          // 如果当前时间不在循环范围内，立即调整
          if (this.audio) {
            const currentTime = this.audio.currentTime * 1000;
            if (currentTime < currentTimeMs || currentTime > endTimeMs) {
              console.log('[AudioController] 调整当前时间到循环范围内', {
                from: currentTime,
                to: currentTimeMs
              });
              this.audio.currentTime = currentTimeMs / 1000;
            }
          }
        }
        break;

      case 'continuous':
      case 'none':
        // 禁用循环
        if (this.state.loop.active) {
          console.log('[AudioController] 禁用循环模式');
          this.state.loop.active = false;
          this.state.loop.start = 0;
          this.state.loop.end = 0;
        }
        break;
    }

    // 广播模式变更事件
    window.dispatchEvent(new CustomEvent('play-mode-changed', {
      detail: { 
        mode,
        loop: this.state.loop
      }
    }));
  }
  
  // seek操作时也触发预加载
  private async triggerSeekPreload(timeMs: number): Promise<void> {
    if (!this.audio || !this.state.url) return;
    
    const durationMs = this.audio.duration * 1000;
    if (durationMs > 0) {
      await this.triggerSmartPreload(timeMs, durationMs);
    }
  }
  
  // 修改 play 方法
  async play(options: {
    url?: string;
    startTime?: number;
    endTime?: number;
    context?: PlayContext;
    loop?: boolean;
    speechId?: string;
    onEnd?: () => void;
  } = {}): Promise<void> {
    // 生成新的请求ID
    const requestId = ++this.playRequestId;
    
    console.log('[AudioController] 播放请求', {
      requestId,
      options,
      currentState: {
        url: this.state.url,
        isPlaying: this.state.isPlaying,
        currentTime: this.audio?.currentTime,
        mode: this.state.mode,
        loop: this.state.loop
      }
    });

    // 取消之前的播放请求
    if (this.currentPlayPromise) {
      console.log('[AudioController] 取消之前的播放请求');
      this.isPlayRequested = false;
      
      // 不等待之前的请求完成，直接继续
    }

    // 创建新的播放请求
    this.currentPlayPromise = this.executePlay(options, requestId);
    
    try {
      await this.currentPlayPromise;
    } catch (error) {
      // 如果是 AbortError 且不是当前最新的请求，忽略错误
      if (error instanceof DOMException && 
          error.name === 'AbortError' && 
          requestId !== this.playRequestId) {
        console.log('[AudioController] 忽略过期请求的 AbortError');
        return;
      }
      
      console.error('[AudioController] 播放失败:', error);
      throw error;
    } finally {
      // 只有当前请求才清理
      if (requestId === this.playRequestId) {
      this.currentPlayPromise = null;
      }
    }
  }

  private async executePlay(options: {
    url?: string;
    startTime?: number;
    endTime?: number;
    context?: PlayContext;
    loop?: boolean;
    speechId?: string;
    onEnd?: () => void;
  }, requestId: number): Promise<void> {
    try {
      // 检查请求是否还有效
      if (requestId !== this.playRequestId) {
        console.log('[AudioController] 请求已过期，取消执行');
        return;
      }

      // 如果提供了新的URL，设置新的音频源
      if (options.url && options.url !== this.state.url) {
        console.log('[AudioController] 设置新的音频源', {
          url: options.url
        });
        await this.setSource(options.url, options.speechId);
        
        // 再次检查请求是否还有效
        if (requestId !== this.playRequestId) {
          console.log('[AudioController] 设置音频源后请求已过期');
          return;
        }
      }

      if (!this.audio) {
        throw new Error('音频实例未初始化');
      }

      // 先暂停当前播放（安全操作）
      if (!this.audio.paused) {
        console.log('[AudioController] 暂停当前播放以准备新的播放');
        this.audio.pause();
      }

      // 设置开始时间
      if (options.startTime !== undefined) {
        console.log('[AudioController] 设置开始时间', {
          startTime: options.startTime
        });
        this.audio.currentTime = options.startTime / 1000;
      }

      // 再次检查请求是否还有效
      if (requestId !== this.playRequestId) {
        console.log('[AudioController] 设置时间后请求已过期');
        return;
      }

      // 设置循环
      if (options.loop && options.startTime !== undefined && options.endTime !== undefined) {
        console.log('[AudioController] 设置循环范围', {
          start: options.startTime,
          end: options.endTime
        });
        this.state.loop.active = true;
        this.state.loop.start = options.startTime;
        this.state.loop.end = options.endTime;
      }

      // 设置上下文
      if (options.context) {
        console.log('[AudioController] 设置播放上下文', {
          context: options.context
        });
        this.state.context = options.context;
      }

      // 设置结束回调
      if (options.onEnd) {
        const handleEnd = () => {
          console.log('[AudioController] 播放结束，执行回调');
          options.onEnd?.();
          this.audio?.removeEventListener('ended', handleEnd);
        };
        this.audio.addEventListener('ended', handleEnd);
      }

      // 最后检查请求是否还有效
      if (requestId !== this.playRequestId) {
        console.log('[AudioController] 播放前请求已过期');
        return;
      }

      // 开始播放
      console.log('[AudioController] 开始播放');
      this.isPlayRequested = true;
      
      try {
        await this.audio.play();
        
        // 检查播放是否成功且请求仍然有效
        if (requestId === this.playRequestId && !this.audio.paused) {
          console.log('[AudioController] 播放成功');
          this.updateState({
            isPlaying: true,
            currentTime: this.audio.currentTime * 1000
          });
        }
      } catch (error) {
        // 如果是AbortError且不是当前请求，忽略
        if (error instanceof DOMException && 
            error.name === 'AbortError' && 
            requestId !== this.playRequestId) {
          console.log('[AudioController] 忽略过期请求的AbortError');
          return;
        }
        
        // 如果是AbortError且音频仍在播放状态，也忽略错误
        if (error instanceof DOMException && 
            error.name === 'AbortError' && 
            !this.audio.paused) {
          console.log('[AudioController] 忽略AbortError，音频正在播放');
          return;
        }
        
          throw error;
        }

    } catch (error) {
      console.error('[AudioController] 播放执行失败:', error);
      this.isPlayRequested = false;
      
      // 只有当前请求才抛出错误
      if (requestId === this.playRequestId) {
      throw error;
      }
    } finally {
      this.isPlayRequested = false;
    }
  }
  
  // 暂停播放
  pause(): void {
    if (!this.audio) return;
    
    console.log('[AudioController] 暂停播放');
    
    // 取消当前的播放请求
    this.isPlayRequested = false;
    this.playRequestId++; // 增加请求ID，使之前的请求失效
    
    try {
    this.audio.pause();
    this.updateState({ isPlaying: false });
    } catch (error) {
      console.warn('[AudioController] 暂停时出错:', error);
    }
  }
  
  // 跳转到指定时间
  seek(timeMs: number): void {
    if (!this.audio) return;
    
    console.log('[AudioController] 跳转到时间:', timeMs);
    
    // 取消当前的播放请求
    this.playRequestId++;
    this.isPlayRequested = false;
    
    try {
      const timeSec = timeMs / 1000;
      this.audio.currentTime = timeSec;
      this.updateState({ currentTime: timeMs });
      
      // 跳转时触发预加载
      this.triggerSeekPreload(timeMs).catch(err => {
        console.warn('[AudioController] Seek预加载失败:', err);
      });
    } catch (error) {
      console.warn('[AudioController] 跳转时间失败:', error);
    }
  }
  
  // 设置音量
  setVolume(volume: number): void {
    if (!this.audio) return;
    
    // 确保音量在0-1范围内
    const safeVolume = Math.max(0, Math.min(1, volume));
    this.audio.volume = safeVolume;
    this.updateState({ volume: safeVolume });
  }
  
  // 设置播放速度
  setPlaybackRate(rate: number): void {
    if (!this.audio) return;
    
    this.audio.playbackRate = rate;
    this.updateState({ playbackRate: rate });
  }
  
  // 获取当前状态
  getState(): AudioState {
    return { ...this.state };
  }
  
  // 播放特定单词
  playWord(startTimeMs: number, endTimeMs?: number): Promise<void> {
    return this.play({
      startTime: startTimeMs,
      endTime: endTimeMs,
      context: 'word',
      loop: false
    });
  }
  
  // 播放特定句子
  playSentence(startTimeMs: number, endTimeMs?: number): Promise<void> {
    console.log('[AudioController] 播放句子:', { startTimeMs, endTimeMs });
    
    // 先清除现有的定时器
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    
    return this.play({
      startTime: startTimeMs,
      endTime: endTimeMs,
      context: 'sentence',
      loop: false // 显式设置为不循环，交由外部控制循环逻辑
    });
  }
  
  // 播放特定段落
  playBlock(startTimeMs: number, endTimeMs?: number): Promise<void> {
    console.log('[AudioController] 播放段落:', { startTimeMs, endTimeMs });
    
    return this.play({
      startTime: startTimeMs,
      endTime: endTimeMs,
      context: 'main',
      loop: this.state.mode === 'block'
    });
  }
  
  // 停止所有播放
  stop(): void {
    if (!this.audio) return;
    
    console.log('[AudioController] 停止播放');
    
    // 取消所有播放请求
    this.playRequestId++;
    this.isPlayRequested = false;
    this.currentPlayPromise = null;
    
    try {
    // 彻底停止播放并清理
    this.audio.pause();
    this.audio.currentTime = 0;
    } catch (error) {
      console.warn('[AudioController] 停止播放时出错:', error);
    }
    
    // 清除所有定时器
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    
    if (this.loopCheckInterval) {
      clearInterval(this.loopCheckInterval);
    }
    
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    
    // 发送结束事件
    try {
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.END, {
      detail: { context: this.state.context, playerId: 'stopped' }
    }));
    } catch (error) {
      console.warn('[AudioController] 发送结束事件失败:', error);
    }
    
    // 更新状态
    this.updateState({ 
      isPlaying: false,
      currentTime: 0,
      loop: { active: false, start: 0, end: 0 }
    });
  }
  
  // 销毁控制器
  destroy() {
    this.cleanup();
    this.audio = null;
  }

  // 添加 getter 方法
  get isPlaying(): boolean {
    return this.state.isPlaying;
  }

  get playing(): boolean {  // 为了向后兼容
    return this.state.isPlaying;
  }
  
  // 获取Range分片加载状态信息
  getRangeLoadingStatus() {
    return this.rangeLoader.getStatus();
  }
}

// 导出单例实例
export const AudioController = new AudioControllerClass();

// 页面加载时自动清理
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    AudioController.emergencyCleanup();
  });
  
  // 页面卸载前清理
  window.addEventListener('beforeunload', () => {
    AudioController.emergencyCleanup();
  });
} 