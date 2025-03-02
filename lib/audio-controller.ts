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
  play(url: string, startTime: number, endTime: number, playerId: string, callback?: () => void): boolean {
    // 防止重复调用
    if (isAudioBusy) {
      console.log('音频系统忙，忽略播放请求');
      return false;
    }
    
    // 检查URL是否有效
    if (!url || url.trim() === '') {
      console.error('无效的音频URL');
      return false;
    }
    
    try {
      // 如果是同一个播放请求但正在播放，则暂停
      if (activePlayerId === playerId && audioInstance && !audioInstance.paused) {
        this.pause();
        return false;
      }
      
      // 设置忙状态，防止短时间内重复调用
      isAudioBusy = true;
      clearBusyTimeout = setTimeout(() => { isAudioBusy = false; }, 300);
      
      // 清理之前的实例
      this.emergencyCleanup();
      
      // 创建新实例并预加载
      const audio = new Audio();
      audio.preload = 'auto'; // 强制预加载
      
      // 避免自动播放错误
      audio.muted = true;
      audio.autoplay = false;
      
      // 设置源
      audio.src = url;
      
      // 在设置事件之前先加载
      const loadPromise = new Promise((resolve) => {
        audio.addEventListener('canplaythrough', resolve, {once: true});
        audio.load();
        
        // 如果10秒内没有加载完成，也继续执行
        setTimeout(resolve, 10000);
      });
      
      loadPromise.then(() => {
        // 设置音频参数
        audio.muted = false;
        audio.currentTime = startTime / 1000;
        audioInstance = audio;
        activePlayerId = playerId;
        
        // 设置播放结束监听
        const handleEnded = () => {
          this.pause();
          if (callback) callback();
        };
        
        // 设置时间更新监听
        const handleTimeUpdate = () => {
          if (!audio) return;
          
          const currentTime = audio.currentTime * 1000;
          
          // 发送时间更新事件
          window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.TIME_UPDATE, {
            detail: { currentTime, playerId }
          }));
          
          // 检查是否到达结束时间（使用更宽松的比较以确保触发）
          if (endTime > 0 && (currentTime >= endTime - 50)) {
            const now = Date.now();
            
            // 防止短时间内多次触发结束事件
            if (now - lastEndEventTime > END_EVENT_DEBOUNCE) {
              lastEndEventTime = now;
              console.log(`音频到达结束时间: ${currentTime.toFixed(0)}/${endTime.toFixed(0)}`);
              
              // 暂停播放
              audio.pause();
              this.notifyStateChange(false, playerId);
              
              // 触发播放结束事件
              window.dispatchEvent(new CustomEvent('audio-playback-ended', {
                detail: { playerId, endTime, actualEndTime: currentTime }
              }));
              
              // 如果有回调，执行回调
              if (callback) {
                console.log('执行结束回调');
                // 使用setTimeout确保在UI更新后执行
                setTimeout(() => {
                  callback();
                }, 10);
              }
            }
          }
        };
        
        // 绑定事件
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        
        // 播放
        audio.play()
          .then(() => {
            this.notifyStateChange(true, playerId);
          })
          .catch(err => {
            console.error('播放失败', err);
            this.emergencyCleanup();
          });
      });
      
      return true;
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