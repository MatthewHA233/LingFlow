/**
 * 全局键盘控制器 - 直接触发现有的点击事件
 */

import { toast } from 'sonner';
import { AudioController } from '@/lib/audio-controller';

class KeyboardControllerClass {
  private isActive = false;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    if (this.isInitialized) return;
    
    window.addEventListener('keydown', this.handleKeyDown);
    this.isInitialized = true;
    console.log('键盘控制器已初始化');
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // 检查是否按下 Ctrl+Alt+A 来切换键盘控制模式
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.toggleKeyboardControlMode();
      return;
    }

    // 如果不在键盘控制模式下，忽略其他快捷键
    if (!this.isActive) return;

    // 检查是否在输入框中，如果是则忽略快捷键
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).contentEditable === 'true'
    )) {
      return;
    }

    // 处理音频控制快捷键
    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        this.clickVinylDisc();
        break;
      
      case 'w':
        e.preventDefault();
        this.triggerPreviousSentence();
        break;
      
      case 's':
        e.preventDefault();
        this.triggerNextSentence();
        break;
      
      case 'a':
        e.preventDefault();
        this.fastRewind();
        break;
      
      case 'd':
        e.preventDefault();
        this.fastForward();
        break;
      
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
        e.preventDefault();
        this.setPlaybackRate(parseInt(e.key));
        break;
      
      case 'q':
        e.preventDefault();
        this.clickLoopModeButton();
        break;
    }
  };

  private toggleKeyboardControlMode() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      // 进入键盘控制模式 - 增强唱片光晕
      this.enhanceVinylGlow(true);
      toast.success('音频快捷控制已开启', {
        description: '空格:播放/暂停 | WS:上下句 | AD:快退/快进 | 1-6:倍速 | Q:循环模式',
        duration: 3000,
      });
    } else {
      // 退出键盘控制模式 - 恢复正常光晕
      this.enhanceVinylGlow(false);
      toast.info('音频快捷控制已关闭');
    }
  }

  private enhanceVinylGlow(enhance: boolean) {
    const recordDisc = document.getElementById('record-disc');
    if (recordDisc) {
      const glowElement = recordDisc.querySelector('.absolute.inset-0.rounded-full') as HTMLElement;
      if (glowElement) {
        if (enhance) {
          glowElement.style.boxShadow = `
            0 0 30px 4px rgba(147, 51, 234, 0.4),
            0 0 20px 2px rgba(168, 85, 247, 0.5),
            0 0 10px 1px rgba(139, 92, 246, 0.6),
            0 4px 6px rgba(0, 0, 0, 0.3)
          `;
        } else {
          glowElement.style.boxShadow = `
            0 0 20px 2px rgba(147, 51, 234, 0.1),
            0 0 10px 1px rgba(168, 85, 247, 0.15),
            0 0 5px 0 rgba(139, 92, 246, 0.2),
            0 4px 6px rgba(0, 0, 0, 0.3)
          `;
        }
        glowElement.style.transition = 'box-shadow 0.3s ease-in-out';
      }
    }
  }

  private clickVinylDisc() {
    const recordDisc = document.getElementById('record-disc');
    if (recordDisc) {
      recordDisc.click();
    }
  }

  private fastRewind() {
    // 快退1.5秒
    const currentTime = AudioController.getState().currentTime;
    AudioController.seek(currentTime - 1500);
    toast.success('快退1.5秒', {
      position: 'bottom-right',
      duration: 1000,
    });
  }

  private fastForward() {
    // 快进0.7秒
    const currentTime = AudioController.getState().currentTime;
    AudioController.seek(currentTime + 700);
    toast.success('快进0.7秒', {
      position: 'bottom-right',
      duration: 1000,
    });
  }

  private setPlaybackRate(rate: number) {
    // 直接设置倍速
    const speedMapping = {
      1: 0.5,
      2: 0.75,
      3: 1.0,
      4: 1.25,
      5: 1.5,
      6: 2.0
    };
    
    const targetSpeed = speedMapping[rate as keyof typeof speedMapping];
    if (targetSpeed) {
      // 派发自定义事件来触发DraggableAudioPlayer的动画效果
      window.dispatchEvent(new CustomEvent('keyboard-playback-rate-change', {
        detail: { rate: targetSpeed }
      }));
    }
  }

  private clickLoopModeButton() {
    // 找到循环模式按钮（唱片中心的按钮）
    const recordDisc = document.getElementById('record-disc');
    if (recordDisc) {
      const centerButtons = recordDisc.querySelectorAll('div[class*="absolute"][class*="left-1/2"][class*="top-1/2"]');
      centerButtons.forEach(button => {
        if (button.classList.contains('z-50')) {
          (button as HTMLElement).click();
        }
      });
    }
  }

  private triggerPreviousSentence() {
    // 触发上一句播放事件
    window.dispatchEvent(new CustomEvent('keyboard-previous-sentence'));
  }

  private triggerNextSentence() {
    // 触发下一句播放事件
    window.dispatchEvent(new CustomEvent('keyboard-next-sentence'));
  }

  // 获取当前状态
  getState() {
    return { isActive: this.isActive };
  }

  // 销毁控制器
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
    this.isInitialized = false;
  }
}

// 导出单例实例
export const KeyboardController = new KeyboardControllerClass();

// 页面卸载前清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    KeyboardController.destroy();
  });
} 