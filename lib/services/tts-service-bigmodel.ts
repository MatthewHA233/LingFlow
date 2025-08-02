import { 
  TTSRequest, 
  TTSResponse, 
  TTSConfig, 
  TTSSynthesizeOptions, 
  TTSError,
  AudioEncoding,
  VoiceType,
  ExtraParams
} from '@/types/tts';
import { BinaryProtocol } from './binary-protocol';

export class BigModelTTSService {
  private config: TTSConfig;
  private httpEndpoint = 'https://openspeech.bytedance.com/api/v1/tts';
  private wsEndpoint = 'wss://openspeech.bytedance.com/api/v1/tts/ws_binary';

  constructor(config: TTSConfig) {
    this.config = {
      ...config,
      cluster: config.cluster || 'volcano_tts',
      defaultVoiceType: config.defaultVoiceType || VoiceType.ZH_MALE_CONVERSATION,
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
   * 构建额外参数
   */
  private buildExtraParams(options: TTSSynthesizeOptions): string | undefined {
    const params: ExtraParams = {};
    
    if (options.disableMarkdownFilter !== undefined) {
      params.disable_markdown_filter = options.disableMarkdownFilter;
    }
    
    if (options.enableLatexTn !== undefined) {
      params.enable_latex_tn = options.enableLatexTn;
    }

    return Object.keys(params).length > 0 ? JSON.stringify(params) : undefined;
  }

  /**
   * 构建请求数据
   */
  private buildRequestData(options: TTSSynthesizeOptions): TTSRequest {
    const extraParam = this.buildExtraParams(options);
    
    return {
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
        speed_ratio: options.speedRatio || this.config.defaultSpeedRatio!,
        emotion: options.emotion,
        enable_emotion: options.enableEmotion,
        emotion_scale: options.emotionScale,
        rate: options.rate || 24000,
        explicit_language: options.explicitLanguage,
        context_language: options.contextLanguage,
        loudness_ratio: options.loudnessRatio
      },
      request: {
        reqid: this.generateRequestId(),
        text: options.text,
        operation: options.operation || 'query',
        text_type: options.textType === 'ssml' ? 'ssml' : undefined,
        silence_duration: options.silenceDuration,
        with_timestamp: options.withTimestamp ? 1 : undefined,
        extra_param: extraParam
      }
    };
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
   * HTTP 方式合成语音（非流式）
   */
  async synthesize(options: TTSSynthesizeOptions): Promise<{
    audio: ArrayBuffer;
    duration: number;
  }> {
    const requestData = this.buildRequestData({
      ...options,
      operation: 'query' // HTTP 只支持非流式
    });

    try {
      const response = await fetch(this.httpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer;${this.config.token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('豆包 TTS API 错误响应:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // 如果无法解析错误响应，使用默认错误信息
        }
        
        throw new TTSError(response.status, errorMessage);
      }

      const result: TTSResponse = await response.json();
      
      console.log('豆包 TTS API 响应:', {
        code: result.code,
        message: result.message,
        hasData: !!result.data,
        dataLength: result.data?.length
      });
      
      if (result.code !== 3000) {
        throw new TTSError(result.code, result.message || 'TTS synthesis failed');
      }

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
   * WebSocket 流式合成
   */
  async synthesizeStream(
    options: TTSSynthesizeOptions,
    onChunk?: (chunk: ArrayBuffer, isLast: boolean) => void
  ): Promise<{
    audio: ArrayBuffer;
    duration: number;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsEndpoint, [], {
        headers: {
          'Authorization': `Bearer;${this.config.token}`
        }
      });

      const audioChunks: ArrayBuffer[] = [];
      let totalDuration = 0;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('WebSocket 连接已建立');
        
        try {
          const requestData = this.buildRequestData({
            ...options,
            operation: 'submit' // WebSocket 使用流式
          });

          const messageBuffer = BinaryProtocol.createClientRequestMessage(
            JSON.stringify(requestData)
          );

          ws.send(messageBuffer);
        } catch (error) {
          reject(new TTSError(-1, `Failed to send request: ${error}`));
        }
      };

      ws.onmessage = (event) => {
        try {
          const response = BinaryProtocol.parseServerResponse(event.data as ArrayBuffer);
          
          if (response.audioData) {
            audioChunks.push(response.audioData);
            
            // 调用回调函数
            const isLast = response.sequence !== undefined && response.sequence < 0;
            onChunk?.(response.audioData, isLast);
            
            if (isLast) {
              // 合并所有音频片段
              const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
              const combinedAudio = new ArrayBuffer(totalLength);
              const combinedView = new Uint8Array(combinedAudio);
              
              let offset = 0;
              for (const chunk of audioChunks) {
                combinedView.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
              }

              ws.close();
              resolve({
                audio: combinedAudio,
                duration: totalDuration
              });
            }
          }
        } catch (error) {
          reject(new TTSError(-1, `Failed to parse response: ${error}`));
        }
      };

      ws.onerror = (error) => {
        reject(new TTSError(-1, `WebSocket error: ${error}`));
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          reject(new TTSError(event.code, `WebSocket closed unexpectedly: ${event.reason}`));
        }
      };

      // 设置超时
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close();
          reject(new TTSError(-1, 'WebSocket timeout'));
        }
      }, 30000); // 30秒超时
    });
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
    const mimeType = this.getMimeType(options.encoding || AudioEncoding.MP3);
    
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
   * 获取 MIME 类型
   */
  private getMimeType(encoding: AudioEncoding): string {
    switch (encoding) {
      case AudioEncoding.MP3: return 'audio/mpeg';
      case AudioEncoding.WAV: return 'audio/wav';
      case AudioEncoding.PCM: return 'audio/pcm';
      case AudioEncoding.OGG_OPUS: return 'audio/ogg';
      default: return 'audio/mpeg';
    }
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
export function createBigModelTTSService(config: TTSConfig): BigModelTTSService {
  return new BigModelTTSService(config);
}