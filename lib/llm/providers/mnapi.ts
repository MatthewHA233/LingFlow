import { OpenAI } from 'openai';
import { BaseLLM, LLMMessage, LLMResponse, LLMTool } from '../base';
import { ChatLogger } from '../chat-logger';

interface ModelAPIConfig {
  key: string;
  baseURL: string;
  modelId: string;
}

// 模型API配置映射
const MODEL_CONFIGS: Record<string, ModelAPIConfig> = {
  'deepseek-v3': {
    key: process.env.DEEPSEEK_API_KEY || 'sk-MZIjyym9OIvdrKOIXfH0dr9CVWafmgbZ6R8yCvMGnPkvtMO2',
    baseURL: process.env.DEEPSEEK_API_BASE || 'https://api.mnapi.com/v1',
    modelId: process.env.DEEPSEEK_MODEL || 'deepseek-v3'
  },
  'deepseek-r1': {
    key: process.env.DEEPSEEK_API_KEY || 'sk-MZIjyym9OIvdrKOIXfH0dr9CVWafmgbZ6R8yCvMGnPkvtMO2',
    baseURL: process.env.DEEPSEEK_API_BASE || 'https://api.mnapi.com/v1',
    modelId: process.env.DEEPSEEK_MODEL2 || 'deepseek-r1'
  },
  'gpt-4o': {
    key: 'sk-B5TaU88ciVTIUw7kQ4HxpwUcxMeFptPYBP2fcn4aZu7J0epG',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'gpt-4o'
  },
  'gpt-4o-mini': {
    key: 'sk-B5TaU88ciVTIUw7kQ4HxpwUcxMeFptPYBP2fcn4aZu7J0epG',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'gpt-4o-mini'
  },
  'claude-3.5-sonnet': {
    key: 'sk-A10lXF9TftfDcp2KKeiZMnOjAoeYBlHbjjqDLxlr7KabqTlH',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'claude-3-5-sonnet-20241022'
  },
  'claude-3.7-sonnet': {
    key: 'sk-A10lXF9TftfDcp2KKeiZMnOjAoeYBlHbjjqDLxlr7KabqTlH',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'claude-3-7-sonnet-20250219'
  },
  'claude-3.7-thinking': {
    key: 'sk-A10lXF9TftfDcp2KKeiZMnOjAoeYBlHbjjqDLxlr7KabqTlH',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'claude-3-7-sonnet-20250219-thinking'
  },
  'gemini-2.0-flash': {
    key: 'sk-rJBYjRrDbySViSs8MbXF0raV4HeqHq4adVUZaEth4ggHctVY',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'gemini-2.0-flash'
  },
  'gemini-2.0-flash-thinking': {
    key: 'sk-rJBYjRrDbySViSs8MbXF0raV4HeqHq4adVUZaEth4ggHctVY',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'gemini-2.0-flash-thinking-exp'
  },
  'gemini-2.0-pro': {
    key: 'sk-rJBYjRrDbySViSs8MbXF0raV4HeqHq4adVUZaEth4ggHctVY',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'gemini-2.0-pro-exp-02-05'
  },
  'command-r': {
    key: 'sk-JLQZx7fOViLpdwoWE2wdTf69waiOq5kmmIqFGDBYs4SuPBf7',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'command-r7b-12-2024'
  },
  'grok-3': {
    key: 'sk-GYxV5rjVngL08g9QjSmrpg4b4qvCQyHcG28iwNJxGOsxyRrN',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'grok-3'
  },
  'grok-3-deepsearch': {
    key: 'sk-GYxV5rjVngL08g9QjSmrpg4b4qvCQyHcG28iwNJxGOsxyRrN',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'grok-3-deepsearch'
  },
  'grok-3-reasoner': {
    key: 'sk-GYxV5rjVngL08g9QjSmrpg4b4qvCQyHcG28iwNJxGOsxyRrN',
    baseURL: 'https://api.mnapi.com/v1',
    modelId: 'grok-3-reasoner'
  }
};

export class MNAPILLM extends BaseLLM {
  private client: OpenAI | null = null;
  private apiKey: string;
  private currentModel: string;

  constructor(options: any) {
    super(options);
    this.currentModel = options?.modelName || process.env.DEEPSEEK_MODEL || 'deepseek-v3';
    this.apiKey = '';
    
    ChatLogger.log('初始化MNAPI客户端, 当前模型:', { model: this.currentModel });
  }
  
  // 根据当前模型获取或创建适当的API客户端
  private getClient(modelName: string = ''): OpenAI {
    // 确定需要使用的模型
    const modelToUse = modelName || this.currentModel;
    const modelConfig = MODEL_CONFIGS[modelToUse];
    
    if (!modelConfig) {
      throw new Error(`未找到模型配置: ${modelToUse}`);
    }
    
    // 如果当前客户端的API密钥与需要的不同，则重新创建客户端
    if (!this.client || this.apiKey !== modelConfig.key) {
      this.apiKey = modelConfig.key;
      
      ChatLogger.log('创建新的MNAPI客户端', { 
        model: modelToUse,
        baseURL: modelConfig.baseURL
      });
      
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: modelConfig.baseURL,
        defaultHeaders: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    return this.client;
  }
  
  async chat(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const requestedModel = options?.model || this.currentModel;
        ChatLogger.log('MNAPI实际使用模型:', { requestedModel });
        
        const modelConfig = MODEL_CONFIGS[requestedModel];
        
        if (!modelConfig) {
          throw new Error(`未找到模型配置: ${requestedModel}`);
        }
        
        ChatLogger.log('发送MNAPI聊天请求', { 
          model: requestedModel,
          messageCount: messages.length,
          options 
        });
        
        // 获取适当的客户端
        const client = this.getClient(requestedModel);
        
        // 设置默认选项和当前选项的合并
        const finalOptions = {
          temperature: options?.temperature !== undefined ? options.temperature : 0.7,
          max_tokens: options?.max_tokens || 800,
          stream: options?.stream || false,
          ...options
        };
        
        // 过滤空内容的消息
        const filteredMessages = messages.filter(msg => 
          typeof msg.content === 'string' && msg.content.trim() !== ''
        );
        
        // 针对不同模型进行特殊处理
        let mappedMessages;
        if (requestedModel.startsWith('gemini')) {
          // Gemini模型特殊处理
          mappedMessages = filteredMessages.map(msg => {
            // Gemini不支持system角色，将system转为user
            const role = msg.role === 'system' ? 'user' : msg.role;
            return {
              role: role,
              content: msg.content as string
            };
          });
        } else {
          // 为了解决TypeScript错误，明确指定类型为OpenAI API要求的类型
          mappedMessages = filteredMessages.map(msg => {
            if (msg.role === 'function') {
              return {
                role: 'function',
                content: msg.content as string,
                name: msg.name || 'function_call'
              };
            } else if (msg.role === 'system') {
              return {
                role: 'system',
                content: msg.content as string
              };
            } else if (msg.role === 'user') {
              return {
                role: 'user',
                content: msg.content as string
              };
            } else {
              return {
                role: 'assistant',
                content: msg.content as string
              };
            }
          });
        }
        
        // 检查是否需要流式输出
        if (finalOptions.stream) {
          console.log(`MNAPI启用流式输出模式，使用模型: ${modelConfig.modelId}, 消息数量: ${mappedMessages.length}`);
          
          // 使用类型断言确保类型正确
          const originalStream = await client.chat.completions.create({
            model: modelConfig.modelId,
            messages: mappedMessages as any,
            temperature: finalOptions.temperature,
            max_tokens: finalOptions.max_tokens,
            stream: true,
          });
          
          // 创建状态变量来跟踪是否正在处理reasoning_content
          let isProcessingReasoning = requestedModel.includes('deepseek-r1');
          let reasoningContent = '';
          
          // 创建AsyncGenerator适配器
          const streamAdapter = async function* () {
            for await (const chunk of originalStream) {
              // 检查是否有推理内容
              if ((chunk.choices[0]?.delta as any)?.reasoning_content) {
                isProcessingReasoning = true;
                reasoningContent += (chunk.choices[0]?.delta as any)?.reasoning_content;
                // 发送特殊标记的推理内容
                yield {
                  ...chunk,
                  isReasoning: true,
                  reasoningContent: (chunk.choices[0]?.delta as any)?.reasoning_content
                };
              } else if (chunk.choices[0]?.delta.content) {
                // 如果有内容但之前在处理推理，标记推理结束
                if (isProcessingReasoning) {
                  isProcessingReasoning = false;
                  // 发送推理结束标记
                  yield {
                    ...chunk,
                    reasoningEnd: true,
                    fullReasoningContent: reasoningContent
                  };
                }
                // 发送常规内容
                yield chunk;
              } else {
                yield chunk;
              }
            }
          };
          
          // 返回流响应
          return {
            text: '',
            reasoning: '',
            tokens: {
              prompt: 0,
              completion: 0,
              total: 0,
            },
            model: requestedModel,
            provider: 'mnapi',
            cost: 0,
            streaming: true,
            stream: streamAdapter(),
          };
        }
        
        // 非流式输出处理
        const completion = await client.chat.completions.create({
          model: modelConfig.modelId,
          messages: mappedMessages as any,
          temperature: finalOptions.temperature,
          max_tokens: finalOptions.max_tokens,
          stream: false,
        });
        
        const response = completion.choices[0]?.message?.content || '';
        // 获取推理内容(如果有)
        const reasoningContent = (completion.choices[0]?.message as any)?.reasoning_content || '';
        const usage = completion.usage;
        
        ChatLogger.log('MNAPI响应成功', { 
          responseLength: response.length,
          hasReasoningContent: !!reasoningContent,
          reasoningLength: reasoningContent.length,
          usage
        });
        
        return {
          text: response,
          reasoning: reasoningContent,
          tokens: {
            prompt: usage?.prompt_tokens || 0,
            completion: usage?.completion_tokens || 0,
            total: usage?.total_tokens || 0,
          },
          model: requestedModel,
          provider: 'mnapi',
          cost: 0,
        };
      } catch (error: any) {
        attempts++;
        
        // 记录更详细的错误信息并添加特定于Gemini的调试信息
        if (String(options?.model || this.currentModel).startsWith('gemini')) {
          const messageDetails = messages.map((msg, i) => 
            `消息[${i}]: 角色=${msg.role}, 内容长度=${typeof msg.content === 'string' ? msg.content.length : 'N/A'}`
          );
          
          ChatLogger.error(`Gemini消息调试信息`, {
            messageCount: messages.length,
            messageDetails: messageDetails,
            filteredCount: messages.filter(m => typeof m.content === 'string' && m.content.trim() !== '').length
          });
        }
        
        ChatLogger.error(`MNAPI错误 (尝试 ${attempts}/${maxAttempts})`, {
          error,
          modelId: MODEL_CONFIGS[options?.model || this.currentModel]?.modelId,
          requestedModel: options?.model || this.currentModel
        });
        
        if (attempts >= maxAttempts) {
          throw new Error(`调用MNAPI失败: ${error.message}`);
        }
        
        // 短暂延迟后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
    // 添加最终的返回语句
    throw new Error('超过最大重试次数，无法完成请求');
  }
  
  async complete(prompt: string, options?: any): Promise<LLMResponse> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
  
  getDefaultModel(): string {
    return this.currentModel;
  }
}