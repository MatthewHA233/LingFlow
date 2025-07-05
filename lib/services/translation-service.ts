import { supabase } from '@/lib/supabase-client';

export interface TranslationData {
  blockId: string;
  content: string;
  status?: 'none' | 'translating' | 'completed' | 'error';
  metadata?: Record<string, any>;
}

export interface TranslationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class TranslationService {
  /**
   * 获取块的翻译内容
   */
  static async getTranslation(blockId: string): Promise<{
    success: boolean;
    data?: {
      translation_content: string | null;
      translation_status: string | null;
      translation_metadata: Record<string, any> | null;
      translation_updated_at: string | null;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('context_blocks')
        .select('translation_content, translation_status, translation_metadata, translation_updated_at')
        .eq('id', blockId)
        .single();

      if (error) {
        console.error('获取翻译内容失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('获取翻译内容异常:', error);
      return { success: false, error: '获取翻译内容时发生异常' };
    }
  }

  /**
   * 更新块的翻译内容
   */
  static async updateTranslation(params: {
    blockId: string;
    content: string;
    status?: string;
    metadata?: Record<string, any>;
  }): Promise<TranslationResult> {
    try {
      const { blockId, content, status = 'completed', metadata = {} } = params;
      
      const updateData = {
        translation_content: content,
        translation_status: status,
        translation_metadata: metadata,
        translation_updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('context_blocks')
        .update(updateData)
        .eq('id', blockId)
        .select('translation_content, translation_status, translation_metadata, translation_updated_at')
        .single();

      if (error) {
        console.error('更新翻译失败:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // 触发缓存更新事件
      window.dispatchEvent(new CustomEvent('translation-updated', {
        detail: {
          blockId,
          translationData: updateData
        }
      }));

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('更新翻译异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 清除块的翻译内容
   */
  static async clearTranslation(blockId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const updateData = {
        translation_content: null,
        translation_status: 'none',
        translation_metadata: null,
        translation_updated_at: null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('context_blocks')
        .update(updateData)
        .eq('id', blockId);

      if (error) {
        console.error('清除翻译内容失败:', error);
        return { success: false, error: error.message };
      }

      // 触发缓存更新事件
      window.dispatchEvent(new CustomEvent('translation-updated', {
        detail: {
          blockId,
          translationData: {
            translation_content: null,
            translation_status: 'none',
            translation_metadata: null,
            translation_updated_at: null
          }
        }
      }));

      return { success: true };
    } catch (error) {
      console.error('清除翻译内容异常:', error);
      return { success: false, error: '清除翻译内容时发生异常' };
    }
  }

  /**
   * 批量更新多个块的翻译内容
   */
  static async batchUpdateTranslations(translations: TranslationData[]): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    errors?: string[];
  }> {
    const results = await Promise.allSettled(
      translations.map(translation => this.updateTranslation({
        blockId: translation.blockId,
        content: translation.content,
        status: translation.status,
        metadata: translation.metadata
      }))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;
    const errors = results
      .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
      .map(r => r.status === 'rejected' ? r.reason : (r as any).value.error);

    return {
      success: errorCount === 0,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 实时保存翻译内容（防抖处理）
   */
  private static saveTimeouts = new Map<string, NodeJS.Timeout>();

  static debouncedSaveTranslation(
    blockId: string,
    content: string,
    delay: number = 1000
  ): void {
    // 清除之前的定时器
    const existingTimeout = this.saveTimeouts.get(blockId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 设置新的定时器
    const timeout = setTimeout(async () => {
      try {
        const result = await this.updateTranslation({
          blockId,
          content,
          status: 'completed'
        });

        if (result.success) {
          console.log(`翻译内容已自动保存: ${blockId}`);
        } else {
          console.error(`翻译内容保存失败: ${blockId}`, result.error);
        }
      } catch (error) {
        console.error(`翻译内容保存异常: ${blockId}`, error);
      } finally {
        // 清除已完成的定时器
        this.saveTimeouts.delete(blockId);
      }
    }, delay);

    this.saveTimeouts.set(blockId, timeout);
  }

  /**
   * 取消待保存的翻译内容
   */
  static cancelPendingSave(blockId: string): void {
    const timeout = this.saveTimeouts.get(blockId);
    if (timeout) {
      clearTimeout(timeout);
      this.saveTimeouts.delete(blockId);
    }
  }
} 