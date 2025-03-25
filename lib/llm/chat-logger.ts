// 简单的日志系统用于调试
export class ChatLogger {
  static log(message: string, data?: any) {
    console.log(`[LLM Chat] ${message}`, data || '');
  }

  static error(message: string, error?: any) {
    console.error(`[LLM Chat Error] ${message}`, error || '');
  }
} 