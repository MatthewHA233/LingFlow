import { supabase } from '@/lib/supabase-client';
import { Anchor, MeaningBlock } from '@/types/anchor';

// 获取当前用户的认证token
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('用户未登录');
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

// 词汇解释数据接口（支持新的表结构）
export interface WordExplanation {
  original: string;        // 原始单词
  lemma: string;          // 词汇原型
  meaning: string;        // 格式化的含义（音标+中文含义）
  example?: string;       // 例句
  contextExplanation?: string; // 上下文解释（新增）
  tags?: string[];        // 标签数组（主要是词性）
  startIndex?: number;    // 在原文中的起始位置
  endIndex?: number;      // 在原文中的结束位置
  // 新增：支持更详细的数据结构
  phonetic?: string;      // 音标
  chineseMeaning?: string; // 中文含义
  partOfSpeech?: string;  // 词性
}

// 处理词汇解释并创建锚点（支持流式处理）
export async function processWordExplanations(
  explanations: WordExplanation[],
  contextBlockId: string,
  modelConfig?: {
    provider: string;
    modelName: string;
  },
  options?: {
    stream?: boolean;
    onProgress?: (event: {
      type: string;
      word?: string;
      message: string;
      [key: string]: any;
    }) => void;
  }
) {
  try {
    const headers = await getAuthHeaders();
    
    const requestBody = {
      explanations,
      contextBlockId,
      modelConfig,
      stream: options?.stream || false
    };
    
    const response = await fetch('/api/anchors/process', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // 如果是流式处理
    if (options?.stream && response.body) {
      return await handleStreamingResponse(response, options.onProgress);
    }

    // 普通处理
    return await response.json();
  } catch (error) {
    console.error('处理锚点失败:', error);
    throw error;
  }
}

// 处理流式响应
async function handleStreamingResponse(
  response: Response,
  onProgress?: (event: any) => void
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');
  
  const decoder = new TextDecoder('utf-8');
  let finalResult: any = null;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data: ')) continue;
        
        try {
          const jsonStr = line.slice(5);
          const event = JSON.parse(jsonStr);
          
          // 调用进度回调
          if (onProgress) {
            onProgress(event);
          }
          
          // 保存最终结果
          if (event.type === 'complete') {
            finalResult = event;
          }
          
        } catch (e) {
          console.error('解析流数据出错:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  return finalResult || { success: false, error: '未收到完成消息' };
}

// 搜索锚点（使用新的表结构）
export async function searchAnchors(params: {
  query?: string;
  anchorId?: string;
  language?: string;
  includeContexts?: boolean;
  page?: number;
  limit?: number;
  // 新增：支持基于音标和词性的搜索
  phonetic?: string;
  partOfSpeech?: string;
  useFormattedView?: boolean; // 是否使用格式化视图
}) {
  try {
    const headers = await getAuthHeaders();
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`/api/anchors/search?${searchParams}`, {
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('搜索锚点失败:', error);
    throw error;
  }
}

// 获取锚点统计
export async function getAnchorStats(params: {
  type: 'overview' | 'time' | 'space';
  startDate?: string;
  endDate?: string;
  bookId?: string;
  chapterId?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  try {
    const headers = await getAuthHeaders();
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`/api/anchors/stats?${searchParams}`, {
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取锚点统计失败:', error);
    throw error;
  }
}

// React Hook用于批量处理锚点
export function useAnchorProcessor() {
  const processExplanations = async (
    explanations: WordExplanation[],
    contextBlockId: string,
    onProgress?: (processed: number, total: number) => void
  ) => {
    const batchSize = 10; // 每批处理10个词汇
    const results = [];
    
    for (let i = 0; i < explanations.length; i += batchSize) {
      const batch = explanations.slice(i, i + batchSize);
      
      try {
        const result = await processWordExplanations(batch, contextBlockId);
        results.push(result);
        
        if (onProgress) {
          onProgress(Math.min(i + batchSize, explanations.length), explanations.length);
        }
      } catch (error) {
        console.error(`批次 ${i / batchSize + 1} 处理失败:`, error);
        // 继续处理下一批，不中断整个流程
      }
    }
    
    return results;
  };

  return { processExplanations };
}

// 直接数据库查询类（用于服务端，支持新表结构）
export class DirectAnchorQueries {
  private supabase;

  constructor() {
    // 使用服务端的Supabase客户端
    const { createClient } = require('@supabase/supabase-js');
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  // 根据文本查找锚点（使用新的表结构）
  async getAnchorByText(text: string, language: string = 'en'): Promise<Anchor | null> {
    const { data, error } = await this.supabase
      .from('anchors')
      .select(`
        *,
        meaning_blocks (
          *,
          meaning_block_contexts (
            context_block_id
          )
        )
      `)
      .eq('text', text.trim()) // 使用 text 字段而不是 normalized_text
      .eq('language', language)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 未找到
      }
      throw error;
    }

    return data;
  }

  // 使用格式化视图查询锚点
  async getFormattedAnchorByText(text: string, language: string = 'en') {
    const { data, error } = await this.supabase
      .from('meaning_blocks_formatted')
      .select('*')
      .eq('anchor_text', text.trim())
      .eq('language', language);

    if (error) {
      throw error;
    }

    return data;
  }

  // 根据音标搜索
  async searchByPhonetic(phoneticPattern: string) {
    const { data, error } = await this.supabase
      .from('meaning_blocks_formatted')
      .select('*')
      .ilike('phonetic', `%${phoneticPattern}%`);

    if (error) {
      throw error;
    }

    return data;
  }

  // 根据词性搜索
  async searchByPartOfSpeech(partOfSpeech: string) {
    const { data, error } = await this.supabase
      .from('meaning_blocks_formatted')
      .select('*')
      .contains('tags', [partOfSpeech]);

    if (error) {
      throw error;
    }

    return data;
  }

  async createAnchor(anchorData: Partial<Anchor>): Promise<Anchor> {
    // 移除 normalized_text 字段
    const { normalized_text, ...cleanData } = anchorData as any;
    
    const { data, error } = await this.supabase
      .from('anchors')
      .insert(cleanData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // 创建含义块（简化版本，不再使用example_sentence）
  async createMeaningBlock(meaningBlockData: Partial<MeaningBlock>): Promise<MeaningBlock> {
    // 移除不需要的字段，直接使用基础数据
    const { data, error } = await this.supabase
      .from('meaning_blocks')
      .insert(meaningBlockData)
      .select()
      .single();

    if (error) {
      throw new Error(`创建含义块失败: ${error.message}`);
    }

    return data;
  }

  // 获取含义块的统计信息
  async getMeaningBlockStats() {
    // 获取词性分布
    const { data: posDistribution, error: posError } = await this.supabase
      .from('meaning_blocks_formatted')
      .select('tags');

    if (posError) {
      throw posError;
    }

    // 统计词性分布
    const posCount: Record<string, number> = {};
    posDistribution?.forEach((block: { tags?: string[] }) => {
      block.tags?.forEach((tag: string) => {
        posCount[tag] = (posCount[tag] || 0) + 1;
      });
    });

    // 获取总体统计
    const { count: totalMeaningBlocks } = await this.supabase
      .from('meaning_blocks')
      .select('*', { count: 'exact', head: true });

    const { count: totalAnchors } = await this.supabase
      .from('anchors')
      .select('*', { count: 'exact', head: true });

    return {
      totalAnchors: totalAnchors || 0,
      totalMeaningBlocks: totalMeaningBlocks || 0,
      partOfSpeechDistribution: posCount
    };
  }
}

export default {
  processWordExplanations,
  searchAnchors,
  getAnchorStats,
  DirectAnchorQueries,
  useAnchorProcessor
}; 