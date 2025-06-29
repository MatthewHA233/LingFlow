/**
 * 语境块服务
 * 提供语境块的创建、分割、删除等操作
 */

import { supabase } from '@/lib/supabase-client';

export interface SplitBlockResult {
  success: boolean;
  original_block_id?: string;
  new_block_id?: string;
  new_order_index?: number;
  affected_blocks?: number;
  message?: string;
  error?: string;
  error_code?: string;
}

export interface CreateBlockResult {
  success: boolean;
  block_id?: string;
  order_index?: number;
  message?: string;
  error?: string;
  error_code?: string;
}

export interface DeleteBlockResult {
  success: boolean;
  deleted_block_id?: string;
  reordered_blocks?: number;
  message?: string;
  error?: string;
  error_code?: string;
}

export class ContextBlocksService {
  /**
   * 分割语境块
   * @param blockId 要分割的块ID
   * @param beforeContent 分割点前的内容
   * @param afterContent 分割点后的内容
   * @param cursorPosition 光标位置（可选）
   */
  static async splitBlock(
    blockId: string,
    beforeContent: string,
    afterContent: string,
    cursorPosition?: number
  ): Promise<SplitBlockResult> {
    try {
      const { data, error } = await supabase.rpc('split_context_block', {
        p_block_id: blockId,
        p_split_content: beforeContent,
        p_remaining_content: afterContent,
        p_cursor_position: cursorPosition || null
      });

      if (error) {
        console.error('分割语境块失败:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'RPC_ERROR'
        };
      }

      return data as SplitBlockResult;
    } catch (error) {
      console.error('分割语境块异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        error_code: 'UNEXPECTED_ERROR'
      };
    }
  }

  /**
   * 创建新的语境块
   * @param parentId 父级ID
   * @param blockType 块类型
   * @param content 内容
   * @param insertAfterOrder 插入位置（在此order之后，可选）
   * @param metadata 元数据（可选）
   */
  static async createBlock(
    parentId: string,
    blockType: string,
    content: string,
    insertAfterOrder?: number,
    metadata?: Record<string, any>
  ): Promise<CreateBlockResult> {
    try {
      const { data, error } = await supabase.rpc('insert_context_block', {
        p_parent_id: parentId,
        p_block_type: blockType,
        p_content: content,
        p_insert_after_order: insertAfterOrder || null,
        p_metadata: metadata ? JSON.stringify(metadata) : '{}'
      });

      if (error) {
        console.error('创建语境块失败:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'RPC_ERROR'
        };
      }

      return data as CreateBlockResult;
    } catch (error) {
      console.error('创建语境块异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        error_code: 'UNEXPECTED_ERROR'
      };
    }
  }

  /**
   * 删除语境块
   * @param blockId 要删除的块ID
   */
  static async deleteBlock(blockId: string): Promise<DeleteBlockResult> {
    try {
      const { data, error } = await supabase.rpc('delete_context_block', {
        p_block_id: blockId
      });

      if (error) {
        console.error('删除语境块失败:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'RPC_ERROR'
        };
      }

      return data as DeleteBlockResult;
    } catch (error) {
      console.error('删除语境块异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        error_code: 'UNEXPECTED_ERROR'
      };
    }
  }

  /**
   * 获取光标在contentEditable元素中的位置
   * @param element contentEditable元素
   */
  static getCursorPosition(element: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    return preCaretRange.toString().length;
  }

  /**
   * 设置光标位置到contentEditable元素
   * @param element contentEditable元素
   * @param position 位置
   */
  static setCursorPosition(element: HTMLElement, position: number): void {
    const range = document.createRange();
    const selection = window.getSelection();
    
    if (!selection) return;

    let currentPos = 0;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textLength = node.textContent?.length || 0;
      if (currentPos + textLength >= position) {
        range.setStart(node, position - currentPos);
        range.setEnd(node, position - currentPos);
        break;
      }
      currentPos += textLength;
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * 从contentEditable元素分割内容
   * @param element contentEditable元素
   * @param cursorPosition 分割位置
   */
  static splitContentAtCursor(element: HTMLElement, cursorPosition?: number): {
    beforeContent: string;
    afterContent: string;
    position: number;
  } {
    const fullContent = element.textContent || '';
    const position = cursorPosition ?? this.getCursorPosition(element);
    
    return {
      beforeContent: fullContent.slice(0, position),
      afterContent: fullContent.slice(position),
      position
    };
  }

  /**
   * 合并两个相邻的文本块
   * @param currentBlockId 当前块ID（将被删除）
   * @param targetBlockId 目标块ID（将接收合并内容）
   * @param currentContent 当前块内容
   * @param targetContent 目标块内容
   * @returns 合并结果
   */
  static async mergeBlocks(
    currentBlockId: string,
    targetBlockId: string,
    currentContent: string,
    targetContent: string
  ): Promise<{ success: boolean; error?: string; mergedContent?: string; cursorPosition?: number }> {
    try {
      console.log('🔄 开始合并块操作:', {
        currentBlockId,
        targetBlockId,
        currentContent: currentContent.substring(0, 50) + '...',
        targetContent: targetContent.substring(0, 50) + '...'
      });

      // 1. 计算合并后的内容和光标位置
      const mergedContent = targetContent + currentContent;
      const cursorPosition = targetContent.length; // 光标应该放在原目标块内容的末尾

      // 2. 调用 Supabase 函数执行合并操作
      const { data, error } = await supabase.rpc('merge_context_blocks', {
        p_current_block_id: currentBlockId,
        p_target_block_id: targetBlockId,
        p_merged_content: mergedContent
      });

      if (error) {
        console.error('❌ 合并块失败:', error);
        return {
          success: false,
          error: `数据库操作失败: ${error.message}`
        };
      }

      if (!data || !data.success) {
        console.error('❌ 合并块失败:', data);
        return {
          success: false,
          error: data?.error || '合并操作失败'
        };
      }

      console.log('✅ 块合并成功:', {
        mergedContent: mergedContent.substring(0, 50) + '...',
        cursorPosition,
        updatedCount: data.updated_count
      });

      return {
        success: true,
        mergedContent,
        cursorPosition
      };

    } catch (error) {
      console.error('💥 合并块异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 将当前块合并到下一个块（Delete键场景）
   * @param currentBlockId 当前块ID（将被删除）
   * @param nextBlockId 下一个块ID（将接收合并内容）
   * @param currentContent 当前块内容
   * @param nextContent 下一个块内容
   * @returns 合并结果
   */
  static async mergeWithNextBlock(
    currentBlockId: string,
    nextBlockId: string,
    currentContent: string,
    nextContent: string
  ): Promise<{ success: boolean; error?: string; mergedContent?: string; cursorPosition?: number }> {
    try {
      console.log('🔄 开始合并到下一块操作:', {
        currentBlockId,
        nextBlockId,
        currentContent: currentContent.substring(0, 50) + '...',
        nextContent: nextContent.substring(0, 50) + '...'
      });

      // 1. 计算合并后的内容和光标位置
      const mergedContent = currentContent + nextContent;
      const cursorPosition = currentContent.length; // 光标应该放在原当前块内容的末尾

      // 2. 调用 Supabase 函数执行合并操作（当前块作为目标，下一块被删除）
      const { data, error } = await supabase.rpc('merge_context_blocks', {
        p_current_block_id: nextBlockId, // 要删除的是下一个块
        p_target_block_id: currentBlockId, // 目标是当前块
        p_merged_content: mergedContent
      });

      if (error) {
        console.error('❌ 合并到下一块失败:', error);
        return {
          success: false,
          error: `数据库操作失败: ${error.message}`
        };
      }

      if (!data || !data.success) {
        console.error('❌ 合并到下一块失败:', data);
        return {
          success: false,
          error: data?.error || '合并操作失败'
        };
      }

      console.log('✅ 合并到下一块成功:', {
        mergedContent: mergedContent.substring(0, 50) + '...',
        cursorPosition,
        updatedCount: data.updated_count
      });

      return {
        success: true,
        mergedContent,
        cursorPosition
      };

    } catch (error) {
      console.error('💥 合并到下一块异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 检查是否可以与上一个块合并
   * @param currentBlockId 当前块ID
   * @param parentId 父级ID
   * @param currentOrderIndex 当前块的排序索引
   * @returns 上一个可合并的文本块信息
   */
  static async getPreviousTextBlock(
    currentBlockId: string,
    parentId: string,
    currentOrderIndex: number
  ): Promise<{ id: string; content: string; order_index: number } | null> {
    try {
      console.log('🔍 查找上一个文本块 - 查询参数:', {
        currentBlockId,
        parentId,
        currentOrderIndex,
        queryConditions: {
          parent_id: parentId,
          block_type: 'text',
          order_index_lt: currentOrderIndex
        }
      });

      // 如果currentOrderIndex是小数，可能导致Supabase查询问题
      // 我们改用查询所有较小的order_index，然后在代码中筛选
      const { data, error } = await supabase
        .from('context_blocks')
        .select('id, content, order_index')
        .eq('parent_id', parentId)
        .eq('block_type', 'text') // 只查找文本块
        .order('order_index', { ascending: false }); // 按排序索引倒序

      console.log('🔍 查找上一个文本块 - 查询结果:', {
        data,
        error,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        dataLength: data?.length
      });

      if (error) {
        console.error('❌ 查找上一个文本块失败:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log('📋 没有找到任何文本块');
        return null;
      }

      // 在代码中筛选出order_index小于当前块的块
      const previousBlocks = data.filter(block => block.order_index < currentOrderIndex);
      
      console.log('🔍 筛选后的上一个块:', {
        allBlocks: data.map(b => ({ id: b.id, order_index: b.order_index })),
        filteredBlocks: previousBlocks.map(b => ({ id: b.id, order_index: b.order_index })),
        currentOrderIndex
      });

      if (previousBlocks.length === 0) {
        console.log('📋 没有找到order_index小于当前块的文本块');
        return null;
      }

      // 返回order_index最大的那个（最接近当前块的上一个块）
      const previousBlock = previousBlocks[0]; // 已经按order_index倒序排列
      console.log('✅ 找到上一个文本块:', previousBlock);
      return previousBlock;
    } catch (error) {
      console.error('💥 查找上一个文本块异常:', error);
      return null;
    }
  }

  /**
   * 检查是否可以与下一个块合并
   * @param currentBlockId 当前块ID
   * @param parentId 父级ID
   * @param currentOrderIndex 当前块的排序索引
   * @returns 下一个可合并的文本块信息
   */
  static async getNextTextBlock(
    currentBlockId: string,
    parentId: string,
    currentOrderIndex: number
  ): Promise<{ id: string; content: string; order_index: number } | null> {
    try {
      console.log('🔍 查找下一个文本块 - 查询参数:', {
        currentBlockId,
        parentId,
        currentOrderIndex,
        queryConditions: {
          parent_id: parentId,
          block_type: 'text',
          order_index_gt: currentOrderIndex
        }
      });

      // 如果currentOrderIndex是小数，可能导致Supabase查询问题
      // 我们改用查询所有块，然后在代码中筛选
      const { data, error } = await supabase
        .from('context_blocks')
        .select('id, content, order_index')
        .eq('parent_id', parentId)
        .eq('block_type', 'text') // 只查找文本块
        .order('order_index', { ascending: true }); // 按排序索引正序

      console.log('🔍 查找下一个文本块 - 查询结果:', {
        data,
        error,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        dataLength: data?.length
      });

      if (error) {
        console.error('❌ 查找下一个文本块失败:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log('📋 没有找到任何文本块');
        return null;
      }

      // 在代码中筛选出order_index大于当前块的块
      const nextBlocks = data.filter(block => block.order_index > currentOrderIndex);
      
      console.log('🔍 筛选后的下一个块:', {
        allBlocks: data.map(b => ({ id: b.id, order_index: b.order_index })),
        filteredBlocks: nextBlocks.map(b => ({ id: b.id, order_index: b.order_index })),
        currentOrderIndex
      });

      if (nextBlocks.length === 0) {
        console.log('📋 没有找到order_index大于当前块的文本块');
        return null;
      }

      // 返回order_index最小的那个（最接近当前块的下一个块）
      const nextBlock = nextBlocks[0]; // 已经按order_index正序排列
      console.log('✅ 找到下一个文本块:', nextBlock);
      return nextBlock;
    } catch (error) {
      console.error('💥 查找下一个文本块异常:', error);
      return null;
    }
  }

  /**
   * 在指定块后创建新块
   * @param afterBlockId 在此块后创建
   * @param content 新块内容
   * @param parentId 父级ID
   */
  static async createBlockAfter(
    afterBlockId: string,
    content: string,
    parentId: string
  ): Promise<CreateBlockResult> {
    try {
      // 首先获取目标块的order_index
      const { data: targetBlock, error: fetchError } = await supabase
        .from('context_blocks')
        .select('order_index')
        .eq('id', afterBlockId)
        .single();

      if (fetchError || !targetBlock) {
        return {
          success: false,
          error: '找不到目标块',
          error_code: 'TARGET_BLOCK_NOT_FOUND'
        };
      }

      // 在目标块后创建新块
      return await this.createBlock(
        parentId,
        'text',
        content,
        targetBlock.order_index
      );
    } catch (error) {
      console.error('在指定块后创建新块异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        error_code: 'UNEXPECTED_ERROR'
      };
    }
  }

  /**
   * 更新块内容
   * @param blockId 块ID
   * @param content 新内容
   */
  static async updateBlockContent(
    blockId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('context_blocks')
        .update({ content })
        .eq('id', blockId);

      if (error) {
        console.error('更新块内容失败:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      console.error('更新块内容异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
} 