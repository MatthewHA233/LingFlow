import { MNAPILLM } from './providers/mnapi';
import { BaseLLM, LLMOptions } from './base';
import { ChatLogger } from './chat-logger';

// 动态导入，防止构建错误
let OpenAILLM: any;
let AnthropicLLM: any;

// 尝试导入各个提供商的模块，避免构建错误
try {
  const openaiModule = require('./providers/openai');
  OpenAILLM = openaiModule.OpenAILLM;
} catch (error) {
  ChatLogger.error('无法加载OpenAI模块，可能缺少依赖', error);
}

export class LLMFactory {
  static create(provider: string, options: LLMOptions): BaseLLM {
    try {
      ChatLogger.log(`创建LLM实例: 提供商=${provider}, 模型=${options.modelName}`);
      
      // 规范化提供商名称
      const normalizedProvider = provider.toLowerCase().trim();
      
      switch (normalizedProvider) {
        case 'openai':
          if (!OpenAILLM) {
            ChatLogger.error('OpenAI模块未加载，回退到MNAPI');
            return new MNAPILLM(options);
          }
          return new OpenAILLM(options);
        case 'deepseek':
        case 'mnapi':
          return new MNAPILLM(options);
        default:
          ChatLogger.log(`未知提供商: ${provider}，使用MNAPI`);
          return new MNAPILLM(options);
      }
    } catch (error: any) {
      ChatLogger.error(`创建LLM实例失败: ${error.message}`, error);
      return new MNAPILLM(options);
    }
  }
} 