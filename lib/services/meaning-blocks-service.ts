// 含义块服务 - 统一管理 meaning_blocks_formatted 数据
import { supabase } from '@/lib/supabase-client';

export interface MeaningBlockFormatted {
  id: string;
  anchor_id: string;
  meaning: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  current_proficiency: number;
  review_count: number;
  next_review_date: string;
  easiness_factor: number;
  interval_days: number;
  user_id: string;
  anchor_text: string;
  anchor_type: string;
  phonetic: string;
  chinese_meaning: string;
  context_explanation?: string;
  original_sentence?: string;
  original_word_form?: string;
  source_context_id?: string;
  example_created_at?: string;
  start_position?: number;
  end_position?: number;
  confidence_score?: number;
  example_index: number;
}

export interface MeaningBlocksCache {
  data: MeaningBlockFormatted[];
  timestamp: number;
  contextBlockId: string;
  userId: string;
}

// 缓存管理
class MeaningBlocksCacheManager {
  private readonly CACHE_KEY_PREFIX = 'lingflow_meaning_blocks_';
  private readonly MAX_AGE = 2 * 60 * 1000; // 减少到2分钟缓存，提高实时性

  private getCacheKey(contextBlockId: string): string {
    return `${this.CACHE_KEY_PREFIX}${contextBlockId}`;
  }

  get(contextBlockId: string, userId: string): MeaningBlockFormatted[] | null {
    try {
      const cached = localStorage.getItem(this.getCacheKey(contextBlockId));
      if (!cached) return null;

      const data: MeaningBlocksCache = JSON.parse(cached);
      const now = Date.now();

      // 检查缓存是否过期
      if (now - data.timestamp > this.MAX_AGE) {
        this.clear(contextBlockId);
        return null;
      }

      // 检查用户ID是否匹配（安全性）
      if (data.userId !== userId) {
        console.warn('缓存用户ID不匹配，清除缓存');
        this.clear(contextBlockId);
        return null;
      }

      return data.data;
    } catch (error) {
      console.warn('读取含义块缓存失败:', error);
      this.clear(contextBlockId);
      return null;
    }
  }

  set(contextBlockId: string, data: MeaningBlockFormatted[], userId: string): void {
    try {
      const cacheData: MeaningBlocksCache = {
        data,
        timestamp: Date.now(),
        contextBlockId,
        userId
      };

      localStorage.setItem(
        this.getCacheKey(contextBlockId), 
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('保存含义块缓存失败:', error);
    }
  }

  clear(contextBlockId: string): void {
    try {
      localStorage.removeItem(this.getCacheKey(contextBlockId));
      console.log(`✓ 已清除语境块 ${contextBlockId} 的含义块缓存`);
    } catch (error) {
      console.warn('清除含义块缓存失败:', error);
    }
  }

  clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('✓ 已清除所有含义块缓存');
    } catch (error) {
      console.warn('清除所有含义块缓存失败:', error);
    }
  }

  // 新增：检查缓存是否存在
  has(contextBlockId: string, userId: string): boolean {
    try {
      const cached = localStorage.getItem(this.getCacheKey(contextBlockId));
      if (!cached) return false;

      const data: MeaningBlocksCache = JSON.parse(cached);
      const now = Date.now();

      return (now - data.timestamp) <= this.MAX_AGE && data.userId === userId;
    } catch (error) {
      return false;
    }
  }
}

// 单例缓存管理器
const cacheManager = new MeaningBlocksCacheManager();

// 含义块服务类
export class MeaningBlocksService {
  /**
   * 获取当前用户ID
   */
  private static async getCurrentUserId(): Promise<string> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        throw new Error('用户未登录或验证失败');
      }
      
      return user.id;
    } catch (error) {
      console.error('获取用户ID失败:', error);
      throw new Error('无法获取用户身份信息');
    }
  }

  /**
   * 根据语境块ID获取相关的含义块数据
   */
  static async getMeaningBlocksByContextId(
    contextBlockId: string,
    useCache: boolean = true
  ): Promise<MeaningBlockFormatted[]> {
    try {
      const userId = await this.getCurrentUserId();

      // 如果不使用缓存，直接从数据库获取
      if (!useCache) {
        console.log(`🔄 强制从数据库获取语境块 ${contextBlockId} 的含义块数据（跳过缓存）`);
        return this.fetchFromDatabase(contextBlockId, userId, true);
      }

      // 先尝试从缓存获取
      const cached = cacheManager.get(contextBlockId, userId);
      if (cached) {
        console.log(`📦 从缓存获取语境块 ${contextBlockId} 的含义块数据 (${cached.length} 个)`);
        return cached;
      }

      console.log(`🔍 缓存未命中，从数据库获取语境块 ${contextBlockId} 的含义块数据`);
      return this.fetchFromDatabase(contextBlockId, userId, true);
    } catch (error) {
      console.error('获取含义块数据失败:', error);
      return [];
    }
  }

  /**
   * 从数据库获取含义块数据的私有方法
   */
  private static async fetchFromDatabase(
    contextBlockId: string, 
    userId: string,
    saveToCache: boolean = true
  ): Promise<MeaningBlockFormatted[]> {
    try {
      const { data, error } = await supabase
        .from('meaning_blocks_formatted')
        .select('*')
        .eq('source_context_id', contextBlockId)
        .eq('user_id', userId)
        .order('example_index');

      if (error) {
        console.error('获取含义块数据失败:', error);
        throw error;
      }

      const meaningBlocks = data || [];
      console.log(`✅ 从数据库获取到 ${meaningBlocks.length} 个含义块 (语境块: ${contextBlockId}, 用户: ${userId})`);
      
      // 保存到缓存
      if (saveToCache) {
        cacheManager.set(contextBlockId, meaningBlocks, userId);
        console.log(`💾 已缓存语境块 ${contextBlockId} 的含义块数据`);
      }

      return meaningBlocks;
    } catch (error) {
      console.error('获取含义块数据失败:', error);
      return [];
    }
  }

  /**
   * 批量获取多个语境块的含义块数据
   */
  static async getMeaningBlocksByContextIds(
    contextBlockIds: string[],
    useCache: boolean = true
  ): Promise<Record<string, MeaningBlockFormatted[]>> {
    try {
      const userId = await this.getCurrentUserId();
      const result: Record<string, MeaningBlockFormatted[]> = {};
      const uncachedIds: string[] = [];

      // 先从缓存获取
      if (useCache) {
        for (const id of contextBlockIds) {
          const cached = cacheManager.get(id, userId);
          if (cached) {
            result[id] = cached;
          } else {
            uncachedIds.push(id);
          }
        }
      } else {
        uncachedIds.push(...contextBlockIds);
      }

      // 批量获取未缓存的数据
      if (uncachedIds.length > 0) {
        try {
          console.log(`批量获取 ${uncachedIds.length} 个语境块的含义块数据`);
          
          const { data, error } = await supabase
            .from('meaning_blocks_formatted')
            .select('*')
            .in('source_context_id', uncachedIds)
            .eq('user_id', userId)
            .order('source_context_id, example_index');

          if (error) {
            console.error('批量获取含义块数据失败:', error);
            throw error;
          }

          // 按语境块ID分组
          const groupedData: Record<string, MeaningBlockFormatted[]> = {};
          (data || []).forEach(item => {
            const contextId = item.source_context_id;
            if (contextId) {
              if (!groupedData[contextId]) {
                groupedData[contextId] = [];
              }
              groupedData[contextId].push(item);
            }
          });

          // 更新结果和缓存
          for (const id of uncachedIds) {
            const blocks = groupedData[id] || [];
            result[id] = blocks;
            
            if (useCache) {
              cacheManager.set(id, blocks, userId);
            }
          }
        } catch (error) {
          console.error('批量获取含义块数据失败:', error);
          // 为失败的ID设置空数组
          for (const id of uncachedIds) {
            result[id] = [];
          }
        }
      }

      return result;
    } catch (error) {
      console.error('批量获取含义块数据失败:', error);
      // 返回空结果
      const result: Record<string, MeaningBlockFormatted[]> = {};
      for (const id of contextBlockIds) {
        result[id] = [];
      }
      return result;
    }
  }

  /**
   * 根据锚点ID获取含义块数据
   */
  static async getMeaningBlocksByAnchorId(anchorId: string): Promise<MeaningBlockFormatted[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data, error } = await supabase
        .from('meaning_blocks_formatted')
        .select('*')
        .eq('anchor_id', anchorId)
        .eq('user_id', userId)
        .order('example_index');

      if (error) {
        console.error('根据锚点ID获取含义块数据失败:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('根据锚点ID获取含义块数据失败:', error);
      return [];
    }
  }

  /**
   * 搜索含义块
   */
  static async searchMeaningBlocks(
    query: string,
    limit: number = 50
  ): Promise<MeaningBlockFormatted[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data, error } = await supabase
        .from('meaning_blocks_formatted')
        .select('*')
        .eq('user_id', userId)
        .or(`anchor_text.ilike.%${query}%,meaning.ilike.%${query}%,context_explanation.ilike.%${query}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('搜索含义块失败:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('搜索含义块失败:', error);
      return [];
    }
  }

  /**
   * 获取用户的含义块统计信息
   */
  static async getMeaningBlocksStats(): Promise<{
    totalBlocks: number;
    totalAnchors: number;
    averageProficiency: number;
    reviewsDue: number;
  }> {
    try {
      const userId = await this.getCurrentUserId();
      
      // 获取基础统计
      const { data: statsData, error: statsError } = await supabase
        .from('meaning_blocks_formatted')
        .select('current_proficiency, next_review_date, anchor_id')
        .eq('user_id', userId)
        .not('source_context_id', 'is', null);

      if (statsError) throw statsError;

      const now = new Date();
      const uniqueAnchors = new Set();
      let totalProficiency = 0;
      let reviewsDue = 0;

      (statsData || []).forEach(block => {
        uniqueAnchors.add(block.anchor_id);
        totalProficiency += block.current_proficiency || 0;
        
        if (block.next_review_date && new Date(block.next_review_date) <= now) {
          reviewsDue++;
        }
      });

      return {
        totalBlocks: statsData?.length || 0,
        totalAnchors: uniqueAnchors.size,
        averageProficiency: statsData?.length ? totalProficiency / statsData.length : 0,
        reviewsDue
      };
    } catch (error) {
      console.error('获取含义块统计失败:', error);
      return {
        totalBlocks: 0,
        totalAnchors: 0,
        averageProficiency: 0,
        reviewsDue: 0
      };
    }
  }

  /**
   * 清除缓存
   */
  static clearCache(contextBlockId?: string): void {
    if (contextBlockId) {
      cacheManager.clear(contextBlockId);
    } else {
      cacheManager.clearAll();
    }
  }

  /**
   * 预加载含义块数据
   */
  static async preloadMeaningBlocks(contextBlockIds: string[]): Promise<void> {
    try {
      await this.getMeaningBlocksByContextIds(contextBlockIds, true);
      console.log(`✅ 预加载完成: ${contextBlockIds.length} 个语境块的含义块数据`);
    } catch (error) {
      console.error('预加载含义块数据失败:', error);
    }
  }
}

// 导出缓存管理器实例（供其他组件使用）
export { cacheManager as meaningBlocksCacheManager }; 