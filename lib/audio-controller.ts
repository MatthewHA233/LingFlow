/**
 * 全局音频控制器 - 单例模式
 * 统一管理所有音频操作，解决冲突问题
 */

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
    volume: 1,
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
  
  // 添加缓存存储
  private speechCache: Map<string, SpeechResult> = new Map();
  
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
    
    this.audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);
    this.audio.addEventListener('play', () => this.updateState({ isPlaying: true }));
    this.audio.addEventListener('pause', () => this.updateState({ isPlaying: false }));
    
    // 定期检查循环状态
    this.timeUpdateInterval = setInterval(() => {
      if (this.audio && this.state.isPlaying) {
        this.checkLoopBoundaries();
        this.broadcastTimeUpdate();
      }
    }, 50); // 更新频率更高，以确保UI流畅
  }
  
  // 检查是否需要循环
  private checkLoopBoundaries() {
    if (!this.audio || !this.state.loop.active) return;
    
    const currentTimeSec = this.audio.currentTime;
    const currentTimeMs = currentTimeSec * 1000;
    
    // 如果超出循环范围，重置到开始位置
    if (currentTimeMs >= this.state.loop.end) {
      this.audio.currentTime = this.state.loop.start / 1000;
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
    this.broadcastTimeUpdate();
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
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    
    // 清除所有定时器
    if (this.loopCheckInterval) {
      clearInterval(this.loopCheckInterval);
    }
    
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    
    this.updateState({
      isPlaying: false,
      currentTime: 0,
      loop: { active: false, start: 0, end: 0 }
    });
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
    
    // 设置新源
    this.audio.src = url;
    this.audio.load();
    
    // 广播源变更事件
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.SOURCE_CHANGE, {
      detail: { url }
    }));
    
    // 加载完成后解析Promise
    const handleCanPlay = () => {
      this.audio?.removeEventListener('canplay', handleCanPlay);
    };
    
    const handleError = (e: ErrorEvent) => {
      this.audio?.removeEventListener('error', handleError);
      throw new Error('加载音频失败');
    };
    
    this.audio.addEventListener('canplay', handleCanPlay);
    this.audio.addEventListener('error', handleError);
  }
  
  // 播放音频
  async play(options: {
    url?: string;
    startTime?: number;
    endTime?: number;
    context?: PlayContext;
    loop?: boolean;
    speechId?: string;
    onEnd?: () => void;
  } = {}): Promise<void> {
    try {
      // 检查是否需要切换音频
      if (options.speechId && options.speechId !== this.state.speechId) {
        const cachedUrl = this.getCachedAudioUrl(options.speechId);
        
        if (cachedUrl) {
          // 如果已经预加载过，切换会更快
          await this.setSource(cachedUrl, options.speechId);
        }
      }
      
      // 确保在浏览器环境且已初始化
      if (typeof window === 'undefined' || !this.audio) {
        return Promise.resolve();
      }
      
      // 如果提供了URL且与当前不同，或者提供了新的speechId
      if ((options.url && options.url !== this.state.url) || 
          (options.speechId && options.speechId !== this.state.speechId)) {
        await this.setSource(options.url || this.state.url, options.speechId);
      }
      
      // 设置上下文
      if (options.context) {
        this.updateState({ context: options.context });
      }
      
      // 设置开始时间
      if (options.startTime !== undefined) {
        this.audio.currentTime = options.startTime / 1000; // 转换为秒
      }
      
      // 设置循环
      if (options.endTime !== undefined) {
        this.updateState({
          loop: {
            active: !!options.loop,
            start: options.startTime || 0,
            end: options.endTime
          }
        });
      } else if (options.loop !== undefined) {
        this.updateState({
          loop: {
            ...this.state.loop,
            active: options.loop
          }
        });
      }
      
      // 开始播放
      await this.audio.play();
      this.updateState({ isPlaying: true });
      
      // 在播放结束时调用 onEnd
      this.audio.addEventListener('ended', () => {
        options.onEnd?.();
      }, { once: true });  // 使用 once 确保只触发一次
      
      return Promise.resolve();
    } catch (error) {
      console.error('播放失败:', error);
      return Promise.reject(error);
    }
  }
  
  // 暂停播放
  pause(): void {
    if (!this.audio) return;
    
    this.audio.pause();
    this.updateState({ isPlaying: false });
  }
  
  // 跳转到指定时间
  seek(timeMs: number): void {
    if (!this.audio) return;
    
    const timeSec = timeMs / 1000;
    this.audio.currentTime = timeSec;
    this.updateState({ currentTime: timeMs });
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
  
  // 设置播放模式
  setPlayMode(mode: PlayMode): void {
    this.updateState({ mode });
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
    
    // 彻底停止播放并清理
    this.audio.pause();
    this.audio.currentTime = 0;
    
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
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.END, {
      detail: { context: this.state.context, playerId: 'stopped' }
    }));
    
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