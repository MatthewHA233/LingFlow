// 完全替换音频控制器实现为更简化的版本

// 全局单例音频实例
let audioInstance: HTMLAudioElement | null = null;
let activePlayerId: string | null = null;
let isAudioBusy = false;
let clearBusyTimeout: any = null;
let lastEndEventTime = 0;
const END_EVENT_DEBOUNCE = 500; // 毫秒

// 简化事件定义
export const AUDIO_EVENTS = {
  STATE_CHANGE: 'simple-audio-state-change',
  TIME_UPDATE: 'simple-audio-time-update'
};

// 简化的音频控制器
export const AudioController = {
  // 强制清理所有资源
  emergencyCleanup() {
    console.log('执行紧急清理...');
    
    // 清理全局变量
    if (audioInstance) {
      try {
        audioInstance.pause();
        audioInstance.src = '';
        audioInstance.load();
        audioInstance.remove?.();
      } catch (e) {
        console.error('清理音频实例失败', e);
      }
      audioInstance = null;
    }
    
    activePlayerId = null;
    isAudioBusy = false;
    
    if (clearBusyTimeout) {
      clearTimeout(clearBusyTimeout);
      clearBusyTimeout = null;
    }
    
    // 清理所有页面中的音频元素
    document.querySelectorAll('audio').forEach(audio => {
      try {
        audio.pause();
        audio.src = '';
        audio.load();
      } catch (e) {
        // 忽略错误
      }
    });
    
    // 通知所有组件
    this.notifyStateChange(false, null);
    
    console.log('紧急清理完成');
  },
  
  // 播放音频
  play(url: string, startTime: number = 0, duration?: number, playerId: string = 'default') {
    // 检查URL是否有效
    if (!url || url.trim() === '') {
      console.error('无效的音频URL');
      return false;
    }
    
    // 如果当前正在播放，先停止
    this.stop();
    
    try {
      // 创建新的音频实例
      const audio = new Audio();
      
      // 添加错误处理
      audio.onerror = (e) => {
        console.error('音频加载错误:', e);
        this.emergencyCleanup();
      };
      
      // 设置音频属性
      audio.src = url;
      audio.currentTime = startTime / 1000; // 转换为秒
      
      // 预加载音频
      return new Promise((resolve) => {
        // 添加可以播放事件监听
        audio.oncanplaythrough = () => {
          // 实际开始播放
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // 播放成功
                audioInstance = audio;
                activePlayerId = playerId;
                this.notifyStateChange(true, playerId);
                resolve(true);
              })
              .catch(error => {
                console.error('播放失败:', error);
                this.emergencyCleanup();
                resolve(false);
              });
          }
        };
        
        // 设置加载超时
        setTimeout(() => {
          if (!audioInstance) {
            console.warn('音频加载超时');
            this.emergencyCleanup();
            resolve(false);
          }
        }, 3000);
      });
    } catch (error) {
      console.error('播放出错', error);
      this.emergencyCleanup();
      return false;
    }
  },
  
  // 暂停
  pause() {
    if (audioInstance) {
      audioInstance.pause();
      this.notifyStateChange(false, activePlayerId);
    }
  },
  
  // 通知状态变更
  notifyStateChange(isPlaying: boolean, playerId: string | null) {
    window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.STATE_CHANGE, {
      detail: { isPlaying, playerId }
    }));
  },
  
  // 停止播放
  stop() {
    if (audioInstance) {
      audioInstance.pause();
      this.notifyStateChange(false, activePlayerId);
    }
  }
};

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