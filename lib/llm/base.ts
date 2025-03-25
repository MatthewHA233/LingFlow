export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface LLMTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface LLMResponse {
  text: string;
  reasoning?: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  provider: string;
  cost?: number;
  streaming?: boolean;
  stream?: AsyncGenerator<any, void, unknown>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | null;
  name?: string;
}

export interface LLMOptions {
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  options?: any;
}

export interface LLMTool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export abstract class BaseLLM {
  protected options: LLMOptions;

  constructor(options: LLMOptions = {}) {
    this.options = options;
  }

  abstract chat(messages: any[], options?: any): Promise<LLMResponse>;
  abstract complete(prompt: string, options?: any): Promise<LLMResponse>;
  abstract getDefaultModel(): string;
} 