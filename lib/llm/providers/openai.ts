import OpenAI from 'openai';
import { BaseLLM, LLMMessage, LLMResponse, LLMTool } from '../base';

export class OpenAILLM extends BaseLLM {
  private client: OpenAI;
  private apiKey: string;

  constructor(options: any) {
    super(options);
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('缺少OpenAI API密钥');
    }
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
      ...options.options
    });
  }

  async chat(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse> {
    try {
      // 如果有系统提示但不在messages中，添加到开头
      if (this.options.systemPrompt && !messages.some(m => m.role === 'system')) {
        messages = [
          { role: 'system', content: this.options.systemPrompt },
          ...messages
        ];
      }

      const response = await this.client.chat.completions.create({
        model: this.options.modelName || this.getDefaultModel(),
        messages: messages as any,
        temperature: this.options.temperature,
        max_tokens: this.options.maxTokens,
        tools: tools,
        ...this.options.options
      });

      const usage = response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        cost: this.calculateCost(
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          this.options.modelName || this.getDefaultModel()
        )
      } : undefined;

      const result: LLMResponse = {
        text: response.choices[0]?.message?.content || '',
        raw: response,
        usage,
        toolCalls: response.choices[0]?.message?.tool_calls
      };

      return result;
    } catch (error: any) {
      // 转换OpenAI错误为统一格式
      if (error.error?.code === 'context_length_exceeded') {
        error.code = 'context_length_exceeded';
      } else if (error.error?.type === 'insufficient_quota') {
        error.code = 'api_key_error';
      } else if (error.error?.type === 'requests') {
        error.code = 'rate_limit_exceeded';
      }
      throw error;
    }
  }

  async complete(prompt: string): Promise<LLMResponse> {
    // 对于OpenAI，使用聊天接口实现补全功能
    return this.chat([{ role: 'user', content: prompt }]);
  }

  getDefaultModel(): string {
    return 'gpt-3.5-turbo';
  }

  private calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    // 根据不同模型计算成本 (美元)
    const rates: Record<string, { prompt: number; completion: number }> = {
      'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4-vision-preview': { prompt: 0.01, completion: 0.03 }
    };

    const rate = rates[model] || rates['gpt-3.5-turbo'];
    return (promptTokens / 1000 * rate.prompt) + (completionTokens / 1000 * rate.completion);
  }
} 