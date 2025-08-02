import { 
  TTSRequest, 
  TTSResponse, 
  TTSConfig, 
  TTSSynthesizeOptions, 
  TTSError,
  AudioEncoding,
  VoiceType 
} from '@/types/tts';

export class TTSService {
  private config: TTSConfig;
  private apiEndpoint = 'https://openspeech.bytedance.com/api/v1/tts';
  private wsEndpoint = 'wss://openspeech.bytedance.com/api/v1/tts/ws_binary';

  constructor(config: TTSConfig) {
    this.config = {
      ...config,
      cluster: config.cluster || 'volcano_tts',
      defaultVoiceType: config.defaultVoiceType || VoiceType.ZH_FEMALE_QINGXIN,
      defaultSpeedRatio: config.defaultSpeedRatio || 1.0
    };
  }

  /**
   * 生成唯一的请求ID
   */
  private generateRequestId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 将 Base64 字符串转换为 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * 将 ArrayBuffer 转换为 Base64 字符串
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }

  /**
   * 合成语音（HTTP 方式）
   */
  async synthesize(options: TTSSynthesizeOptions): Promise<{
    audio: ArrayBuffer;
    duration: number;
  }> {
    const requestData: TTSRequest = {
      app: {
        appid: this.config.appid,
        token: this.config.token,
        cluster: this.config.cluster!
      },
      user: {
        uid: options.userId || 'default_user'
      },
      audio: {
        voice_type: options.voiceType || this.config.defaultVoiceType!,
        encoding: options.encoding || AudioEncoding.MP3,
        speed_ratio: options.speedRatio || this.config.defaultSpeedRatio!
      },
      request: {
        reqid: this.generateRequestId(),
        text: options.text,
        operation: 'query'
      }
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer;${this.config.token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        // 尝试获取错误信息
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('豆包 TTS API 错误响应:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // 如果无法解析错误响应，使用默认错误信息
        }
        
        throw new TTSError(
          response.status,
          errorMessage
        );
      }

      const result: TTSResponse = await response.json();
      
      // 调试日志
      console.log('豆包 TTS API 响应:', {
        code: result.code,
        message: result.message,
        hasData: !!result.data,
        dataLength: result.data?.length
      });
      
      if (result.code !== 3000) {
        throw new TTSError(
          result.code,
          result.message || 'TTS synthesis failed'
        );
      }

      // 将 Base64 音频数据转换为 ArrayBuffer
      const audioBuffer = this.base64ToArrayBuffer(result.data);
      const duration = parseInt(result.addition.duration);

      return {
        audio: audioBuffer,
        duration
      };
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      
      throw new TTSError(
        -1,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * 合成语音并返回 Base64 编码的音频
   */
  async synthesizeToBase64(options: TTSSynthesizeOptions): Promise<{
    audio: string;
    duration: number;
  }> {
    const result = await this.synthesize(options);
    
    return {
      audio: this.arrayBufferToBase64(result.audio),
      duration: result.duration
    };
  }

  /**
   * 合成语音并返回 Blob 对象
   */
  async synthesizeToBlob(options: TTSSynthesizeOptions): Promise<{
    blob: Blob;
    duration: number;
  }> {
    const result = await this.synthesize(options);
    const mimeType = options.encoding === AudioEncoding.MP3 ? 'audio/mp3' : 'audio/mpeg';
    
    return {
      blob: new Blob([result.audio], { type: mimeType }),
      duration: result.duration
    };
  }

  /**
   * 创建音频 URL（用于在浏览器中播放）
   */
  async synthesizeToURL(options: TTSSynthesizeOptions): Promise<{
    url: string;
    duration: number;
    cleanup: () => void;
  }> {
    const { blob, duration } = await this.synthesizeToBlob(options);
    const url = URL.createObjectURL(blob);
    
    return {
      url,
      duration,
      cleanup: () => URL.revokeObjectURL(url)
    };
  }

  /**
   * 批量合成文本
   */
  async batchSynthesize(texts: string[], options?: Partial<TTSSynthesizeOptions>): Promise<Array<{
    text: string;
    audio: ArrayBuffer;
    duration: number;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      texts.map(text => 
        this.synthesize({ ...options, text })
          .then(result => ({ text, ...result }))
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          text: texts[index],
          audio: new ArrayBuffer(0),
          duration: 0,
          error: result.reason.message
        };
      }
    });
  }
}

// 导出默认实例工厂函数
export function createTTSService(config: TTSConfig): TTSService {
  return new TTSService(config);
}