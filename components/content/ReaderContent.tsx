'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, ChevronLeft, ChevronRight, Info, Undo, Pause, Play, GripVertical, Plus } from 'lucide-react';
import { ContextBlocks } from './ContextBlocks';
import { toast } from 'sonner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TerminalPopover } from '@/components/ui/TerminalPopover';
import Image from 'next/image';
import { AudioController } from '@/lib/audio-controller';
import { cn } from '@/lib/utils';
import { throttle } from 'lodash';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { generateWordsFromAlignmentMetadata } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { AudioUploader } from './AudioUploader';
import { createPortal } from 'react-dom';

interface ReaderContentProps {
  book: Book;
}

interface WordHistoryItem {
  word: string;
  begin_time?: number;
  end_time?: number;
  original_word?: string;
}

export function ReaderContent({ book }: ReaderContentProps) {
  // 基础状态
  const [currentChapter, setCurrentChapter] = useState(0);
  const [resources, setResources] = useState<Array<{ original_path: string; oss_path: string }>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [contextBlocks, setContextBlocks] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [parentIds, setParentIds] = useState<Record<number, string>>({});
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [aligningBlocks, setAligningBlocks] = useState<Set<string>>(new Set());
  const [playMode, setPlayMode] = useState<'sentence' | 'block' | 'continuous'>('continuous');
  const [activeSplitViewBlockId, setActiveSplitViewBlockId] = useState<string | null>(null);
  const [splitViewType, setSplitViewType] = useState<'source' | 'translation' | null>(null);
  const [splitViewData, setSplitViewData] = useState<any>(null);
  const [showAlignmentDetails, setShowAlignmentDetails] = useState(false);
  const [detailsBlockId, setDetailsBlockId] = useState<string | null>(null);
  const [detailsPosition, setDetailsPosition] = useState({ x: 0, y: 0 });
  const [loadingSplitView, setLoadingSplitView] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [undoProgress, setUndoProgress] = useState(0);
  const [undoStatus, setUndoStatus] = useState('');
  const [isUndoing, setIsUndoing] = useState(false);
  const blockRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const [mounted, setMounted] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showVinyl, setShowVinyl] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // 目录相关状态
  const [draggedChapter, setDraggedChapter] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showInsertButtonIndex, setShowInsertButtonIndex] = useState<number | null>(null);
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  // 右键菜单相关状态
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuChapterIndex, setContextMenuChapterIndex] = useState<number | null>(null);
  const [isDeletingChapter, setIsDeletingChapter] = useState(false);

  // 章节重命名相关状态
  const [editingChapterIndex, setEditingChapterIndex] = useState<number | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const [isRenamingChapter, setIsRenamingChapter] = useState(false);

  // 添加初始化状态跟踪
  const [initializationStep, setInitializationStep] = useState('starting');
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // 添加块更新处理函数
  const handleBlockUpdate = async (blockId: string, newType: string, content: string) => {
    try {
      const { error } = await supabase
        .from('context_blocks')
        .update({
          block_type: newType,
          content: content
        })
        .eq('id', blockId);

      if (error) throw error;

      // 更新本地状态
      setContextBlocks(prev => ({
        ...prev,
        [currentChapter]: prev[currentChapter].map(block =>
          block.id === blockId
            ? { ...block, block_type: newType, content }
            : block
        )
      }));
    } catch (error) {
      console.error('更新块失败:', error);
      toast.error('更新失败');
    }
  };

  // 修改 handleBlockSelect 函数
  const handleBlockSelect = useCallback((blockId: string | null, _e: React.MouseEvent) => {
    // 如果传入的 blockId 为 null，则清除 activeBlockId
    if (blockId === null) {
      setActiveBlockId(null);
    } else {
      // 否则，设置 activeBlockId 为传入的 blockId
      setActiveBlockId(blockId);
    }

    // 其余逻辑保持不变
    setSelectedBlocks(prev => {
      const newSelected = new Set(prev);
      if (!blockId) {
        newSelected.clear();
      } else if (newSelected.has(blockId)) {
        newSelected.delete(blockId);
      } else {
        newSelected.add(blockId);
      }
      return newSelected;
    });
  }, []); // 移除多余的依赖

  // 更新块排序处理函数
  const handleBlockOrderChange = async (draggedId: string, droppedId: string, position: 'before' | 'after') => {
    const blocks = contextBlocks[currentChapter];
    try {
      const draggedIndex = blocks.findIndex(b => b.id === draggedId);
      const droppedIndex = blocks.findIndex(b => b.id === droppedId);
      
      if (draggedIndex === -1 || droppedIndex === -1) return;

      // 创建新的排序
      const newBlocks = [...blocks];
      const [draggedBlock] = newBlocks.splice(draggedIndex, 1);
      
      // 修改这里：根据拖拽方向调整目标位置
      let targetIndex = position === 'before' ? droppedIndex : droppedIndex + 1;
      // 如果是向下拖拽，需要减1来补偿splice操作导致的索引偏移
      if (draggedIndex < droppedIndex) {
        targetIndex--;
      }
      
      newBlocks.splice(targetIndex, 0, draggedBlock);

      // 先更新本地状态，提供即时反馈
      setContextBlocks(prev => ({
        ...prev,
        [currentChapter]: newBlocks
      }));

      // 构建单次批量更新
      const { data, error } = await supabase.rpc('update_block_order', {
        block_ids: newBlocks.map(block => block.id),
        new_order_indices: newBlocks.map((_, index) => index),
        p_parent_id: newBlocks[0].parent_id
      });

      console.log('更新排序响应:', { data, error });

      if (error || (data && !data.success)) {
        const errorMessage = error?.message || (data && data.error) || '未知错误';
        console.error('更新排序失败:', { error, data });
        // 如果更新失败，回滚本地状态
        setContextBlocks(prev => ({
          ...prev,
          [currentChapter]: blocks
        }));
        toast.error(`更新顺序失败: ${errorMessage}`);
        return;
      }

      // 更新成功
      toast.success(`成功更新 ${data.updated_count} 个块的顺序`);

    } catch (error) {
      console.error('排序更新失败:', error);
      // 回滚本地状态
      setContextBlocks(prev => ({
        ...prev,
        [currentChapter]: blocks
      }));
      toast.error('更新顺序失败，请重试');
    }
  };

  // 章节拖拽排序处理函数
  const handleChapterDragStart = (e: React.DragEvent, index: number) => {
    setDraggedChapter(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 添加拖拽开始的视觉反馈
    console.log(`开始拖拽章节 ${index}: ${book.chapters[index]?.title}`);
  };

  const handleChapterDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 只有当拖拽的不是同一个章节时才显示指示
    if (draggedChapter !== null && draggedChapter !== index) {
      setDragOverIndex(index);
    }
  };

  const handleChapterDragLeave = (e: React.DragEvent) => {
    // 只有当鼠标真正离开目标区域时才清除指示
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleChapterDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    console.log(`拖拽放置: draggedChapter=${draggedChapter}, dropIndex=${dropIndex}`);
    
    if (draggedChapter === null || draggedChapter === dropIndex) {
      console.log('取消拖拽：源和目标相同或无效');
      setDraggedChapter(null);
      setDragOverIndex(null);
      return;
    }

    // 在重新排序前保存被拖拽章节的标题
    const draggedChapterTitle = book.chapters[draggedChapter]?.title || '未知章节';

    try {
      console.log(`执行章节重排序: ${draggedChapter} -> ${dropIndex}`);
      console.log(`移动章节: "${draggedChapterTitle}"`);
      
      // 调用章节重排序函数
      await updateChapterOrder(draggedChapter, dropIndex);
      
      toast.success(`章节 "${draggedChapterTitle}" 已移动到位置 ${dropIndex + 1}`);
      console.log('✓ 章节拖拽排序完成');
      
    } catch (error) {
      console.error('拖拽排序失败:', error);
      toast.error(`章节 "${draggedChapterTitle}" 移动失败`);
    } finally {
      setDraggedChapter(null);
      setDragOverIndex(null);
    }
  };

  // 处理整个拖拽区域的dragover（用于章节间的插入指示）
  const handleChapterListDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (draggedChapter === null) return;
    
    // 获取拖拽位置并计算最近的插入点
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    // 获取所有章节项的位置
    const chapterElements = (e.currentTarget as HTMLElement).querySelectorAll('[data-chapter-index]');
    let closestIndex = 0;
    let minDistance = Infinity;
    
    chapterElements.forEach((element, index) => {
      const elementRect = element.getBoundingClientRect();
      const elementY = elementRect.top - rect.top + elementRect.height / 2;
      const distance = Math.abs(y - elementY);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // 确定是插入到前面还是后面
    if (chapterElements[closestIndex]) {
      const elementRect = chapterElements[closestIndex].getBoundingClientRect();
      const elementY = elementRect.top - rect.top + elementRect.height / 2;
      
      if (y > elementY) {
        closestIndex += 1; // 插入到后面
      }
    }
    
    setDragOverIndex(closestIndex);
  };

  // 更新章节顺序的函数 - 修复parentIds映射问题
  const updateChapterOrder = async (fromIndex: number, toIndex: number) => {
    // 如果位置相同，不进行操作
    if (fromIndex === toIndex) {
      console.log('源位置和目标位置相同，跳过操作');
      return;
    }

    console.log(`章节重排序: ${fromIndex} -> ${toIndex}`);

    try {
      // 添加操作超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('重排序操作超时')), 10000);
      });

      const rpcPromise = supabase.rpc('reorder_chapter', {
        p_book_id: book.id,
        p_from_index: fromIndex,
        p_to_index: toIndex
      });

      const { data: result, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

      console.log('重排序RPC调用结果:', { result, error });

      // 检查RPC调用结果
      if (error) {
        console.error('RPC调用失败:', error);
        throw new Error(`重排序失败: ${error.message}`);
      }

      if (!result || !result.success) {
        console.error('RPC函数返回错误:', result);
        throw new Error(`重排序失败: ${result?.error || '未知错误'}`);
      }

      console.log(`✓ RPC重排序成功，更新了 ${result.updated_count} 个章节`);
      
      // 更新本地章节数组
      const chapters = book.chapters;
      const [movedChapter] = chapters.splice(fromIndex, 1);
      chapters.splice(toIndex, 0, movedChapter);
      
      // 更新order_index
      chapters.forEach((chapter, index) => {
        chapter.order_index = index;
      });
      
      // ⭐ 关键修复：重新构建parentIds映射关系
      const newParentIds: Record<number, string> = {};
      chapters.forEach((chapter, index) => {
        newParentIds[index] = chapter.parent_id;
      });
      setParentIds(newParentIds);
      
      console.log('✓ 重新构建parentIds映射:', newParentIds);
      
      // 如果有现有的语境块缓存，也需要重新映射
      if (Object.keys(contextBlocks).length > 0) {
        const newContextBlocks: Record<string, any[]> = {};
        
        // 根据新的章节顺序重新映射语境块
        Object.entries(contextBlocks).forEach(([oldIndexStr, blocks]) => {
          const oldIndex = parseInt(oldIndexStr);
          
          // 找到这个索引对应的章节在新顺序中的位置
          let newIndex = oldIndex;
          
          if (oldIndex === fromIndex) {
            // 被移动的章节
            newIndex = toIndex;
          } else if (fromIndex < toIndex) {
            // 向后移动的情况
            if (oldIndex > fromIndex && oldIndex <= toIndex) {
              newIndex = oldIndex - 1;
            }
          } else {
            // 向前移动的情况
            if (oldIndex >= toIndex && oldIndex < fromIndex) {
              newIndex = oldIndex + 1;
            }
          }
          
          newContextBlocks[newIndex] = blocks;
        });
        
        setContextBlocks(newContextBlocks);
        console.log('✓ 重新映射语境块缓存');
      }
      
      // 更新当前章节索引
      if (fromIndex === currentChapter) {
        setCurrentChapter(toIndex);
      } else if (fromIndex < currentChapter && toIndex >= currentChapter) {
        setCurrentChapter(prev => prev - 1);
      } else if (fromIndex > currentChapter && toIndex <= currentChapter) {
        setCurrentChapter(prev => prev + 1);
      }
      
      console.log('✓ 本地状态更新完成');
      
    } catch (error) {
      console.error('章节重排序失败:', error);
      throw error;
    }
  };

  // 创建新章节的函数 - 只使用Supabase RPC函数
  const createNewChapter = async (position: number, title: string) => {
    try {
      setIsCreatingChapter(true);
      
      // 获取当前用户ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.error('请先登录');
        return;
      }
      
      const userId = session.user.id;
      
      // 使用RPC函数
      console.log('调用RPC函数，参数:', {
        p_book_id: book.id,
        p_position: position,
        p_title: title,
        p_user_id: userId
      });

      const { data: result, error } = await supabase
        .rpc('insert_chapter_at_position', {
          p_book_id: book.id,
          p_position: position,
          p_title: title,
          p_user_id: userId
        });

      console.log('RPC调用结果:', { result, error });

      // 检查RPC调用结果
      if (error) {
        console.error('RPC调用失败:', error);
        throw new Error(`创建章节失败: ${error.message}`);
      }

      if (!result || !result.success) {
        console.error('RPC函数返回错误:', result);
        throw new Error(`创建章节失败: ${result?.error || '未知错误'}`);
      }

      console.log('✓ RPC调用成功:', result);

      // 更新本地状态
      const chapterData = result.chapter;
      const defaultBlock = result.default_block;

      // 在指定位置插入新章节
      const chapters = [...book.chapters];
      chapters.splice(position, 0, chapterData);
      
      // 更新后续章节的索引
      for (let i = position + 1; i < chapters.length; i++) {
        chapters[i].order_index = i;
      }
      
      book.chapters = chapters;

      // ⭐ 关键修复：重新构建完整的parentIds映射关系
      const newParentIds: Record<number, string> = {};
      chapters.forEach((chapter, index) => {
        newParentIds[index] = chapter.parent_id;
      });
      setParentIds(newParentIds);
      
      console.log('✓ 创建章节后重新构建parentIds映射:', newParentIds);

      // 重新映射现有的语境块缓存
      if (Object.keys(contextBlocks).length > 0) {
        const newContextBlocks: Record<string, any[]> = {};
        
        // 为新章节添加默认语境块
        newContextBlocks[position] = [defaultBlock];
        
        // 将现有章节的语境块向后移动一位
        Object.entries(contextBlocks).forEach(([oldIndexStr, blocks]) => {
          const oldIndex = parseInt(oldIndexStr);
          const newIndex = oldIndex >= position ? oldIndex + 1 : oldIndex;
          newContextBlocks[newIndex] = blocks;
        });
        
        setContextBlocks(newContextBlocks);
        console.log('✓ 创建章节后重新映射语境块缓存');
      } else {
        // 如果没有现有缓存，只为新章节添加默认语境块
        setContextBlocks(prev => ({
          ...prev,
          [position]: [defaultBlock]
        }));
      }

      // 调整当前章节索引
      if (position <= currentChapter) {
        setCurrentChapter(currentChapter + 1);
      }

      toast.success(`新章节 "${title}" 已创建`);
      
    } catch (error) {
      console.error('创建章节失败:', error);
      toast.error(`创建章节失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsCreatingChapter(false);
      setNewChapterTitle('');
      setInsertPosition(null);
    }
  };

  // 创建默认语境块（当章节内容为空时）
  const createDefaultContextBlock = async (chapterIndex: number) => {
    const parentId = parentIds[chapterIndex];
    
    // 更严格的条件检查
    if (!parentId) {
      console.warn(`章节 ${chapterIndex} 的 parentId 不存在，跳过创建默认语境块`);
      return;
    }

    // 检查是否已经有语境块了，避免重复创建
    const existingBlocks = contextBlocks[chapterIndex];
    if (existingBlocks && existingBlocks.length > 0) {
      console.log(`章节 ${chapterIndex} 已有 ${existingBlocks.length} 个语境块，跳过创建默认块`);
      return;
    }

    try {
      console.log(`为空章节 ${chapterIndex} (parentId: ${parentId}) 创建默认语境块`);
      
      const { data: blockData, error } = await supabase
        .from('context_blocks')
        .insert({
          parent_id: parentId,
          block_type: 'text',
          content: '这是新的文本内容，点击编辑开始创作。',
          order_index: 0
        })
        .select()
        .single();

      if (error) throw error;

      // 更新本地状态
      setContextBlocks(prev => ({
        ...prev,
        [chapterIndex]: [blockData]
      }));

      console.log(`✓ 成功为章节 ${chapterIndex} 创建默认语境块`);
      toast.success('已为空章节创建默认文本块');
    } catch (error) {
      console.error('创建默认语境块失败:', error);
      toast.error('创建默认文本块失败');
    }
  };

  // 删除章节函数
  const deleteChapter = async (chapterIndex: number) => {
    try {
      setIsDeletingChapter(true);
      
      // 获取要删除的章节标题
      const chapterTitle = book.chapters[chapterIndex]?.title || '未知章节';
      
      console.log(`开始删除章节 ${chapterIndex}: "${chapterTitle}"`);

      // 调用删除章节的RPC函数
      const { data: result, error } = await supabase
        .rpc('delete_chapter_at_position', {
          p_book_id: book.id,
          p_position: chapterIndex
        });

      console.log('删除章节RPC调用结果:', { result, error });

      if (error) {
        console.error('RPC调用失败:', error);
        throw new Error(`删除失败: ${error.message}`);
      }

      if (!result || !result.success) {
        console.error('RPC函数返回错误:', result);
        throw new Error(`删除失败: ${result?.error || '未知错误'}`);
      }

      console.log(`✓ 删除章节成功，删除了 ${result.deleted_blocks_count} 个语境块`);

      // 更新本地状态
      const chapters = [...book.chapters];
      chapters.splice(chapterIndex, 1);
      
      // 更新后续章节的order_index
      chapters.forEach((chapter, index) => {
        chapter.order_index = index;
      });
      
      book.chapters = chapters;

      // 重新构建parentIds映射关系
      const newParentIds: Record<number, string> = {};
      chapters.forEach((chapter, index) => {
        newParentIds[index] = chapter.parent_id;
      });
      setParentIds(newParentIds);

      // 重新映射语境块缓存
      const newContextBlocks: Record<string, any[]> = {};
      Object.entries(contextBlocks).forEach(([oldIndexStr, blocks]) => {
        const oldIndex = parseInt(oldIndexStr);
        
        if (oldIndex < chapterIndex) {
          // 在删除章节之前的章节，索引不变
          newContextBlocks[oldIndex] = blocks;
        } else if (oldIndex > chapterIndex) {
          // 在删除章节之后的章节，索引减1
          newContextBlocks[oldIndex - 1] = blocks;
        }
        // 被删除的章节（oldIndex === chapterIndex）不加入新的映射
      });
      
      setContextBlocks(newContextBlocks);

      // 调整当前章节索引
      if (chapterIndex === currentChapter) {
        // 如果删除的是当前章节，切换到前一个章节（如果没有则切换到第一个）
        const newCurrentChapter = Math.max(0, chapterIndex - 1);
        setCurrentChapter(newCurrentChapter);
      } else if (chapterIndex < currentChapter) {
        // 如果删除的章节在当前章节之前，当前章节索引减1
        setCurrentChapter(prev => prev - 1);
      }

      toast.success(`章节 "${chapterTitle}" 已删除`);
      
    } catch (error) {
      console.error('删除章节失败:', error);
      toast.error(`删除章节失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsDeletingChapter(false);
      setShowContextMenu(false);
      setContextMenuChapterIndex(null);
    }
  };

  // 处理右键菜单
  const handleChapterContextMenu = (e: React.MouseEvent, chapterIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 获取鼠标位置
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // 菜单尺寸估算
    const menuWidth = 120;
    const menuHeight = 80;
    
    // 计算最佳位置，防止超出屏幕
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let finalX = mouseX;
    let finalY = mouseY;
    
    // 如果菜单会超出右边界，向左调整
    if (mouseX + menuWidth > windowWidth) {
      finalX = windowWidth - menuWidth - 10;
    }
    
    // 如果菜单会超出下边界，向上调整
    if (mouseY + menuHeight > windowHeight) {
      finalY = mouseY - menuHeight;
    }
    
    // 确保不会超出左边界和上边界
    finalX = Math.max(10, finalX);
    finalY = Math.max(10, finalY);
    
    setContextMenuPosition({ x: finalX, y: finalY });
    setContextMenuChapterIndex(chapterIndex);
    setShowContextMenu(true);
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setShowContextMenu(false);
    setContextMenuChapterIndex(null);
  };

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (showContextMenu) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showContextMenu]);

  // 处理编辑状态下点击外部保存
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingChapterIndex !== null) {
        // 检查点击的元素是否是正在编辑的输入框或其父元素
        const target = event.target as HTMLElement;
        const editingInput = document.querySelector('input[data-editing-chapter]') as HTMLInputElement;
        
        if (editingInput && !editingInput.contains(target) && !target.closest('[data-editing-chapter]')) {
          // 直接调用重命名函数，不依赖saveChapterEdit
          if (editingChapterTitle.trim()) {
            renameChapter(editingChapterIndex, editingChapterTitle).then((success) => {
              if (success) {
                setEditingChapterIndex(null);
                setEditingChapterTitle('');
              }
            });
          } else {
            // 如果标题为空，直接取消编辑
            setEditingChapterIndex(null);
            setEditingChapterTitle('');
          }
        }
      }
    };

    if (editingChapterIndex !== null) {
      // 延迟添加事件监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [editingChapterIndex, editingChapterTitle]);

  // 修改 loadAllParentIds 函数，添加超时和错误处理
  const loadAllParentIds = async () => {
    try {
      console.log('开始加载章节父级ID，book.id:', book.id);
      setInitializationStep('loading_parent_ids');
      
      // 添加超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('加载父级ID超时')), 10000); // 10秒超时
      });
      
      const queryPromise = supabase
        .from('chapters')
        .select('order_index, parent_id')
        .eq('book_id', book.id)
        .order('order_index');

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        console.error('加载章节父级ID失败:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('未找到任何章节数据，book.id:', book.id);
        return {};
      }

      console.log('加载到的章节数据:', data);

      const idMap = data.reduce((acc: Record<number, string>, chapter: { order_index: number; parent_id: string }) => {
        acc[chapter.order_index] = chapter.parent_id;
        return acc;
      }, {});

      console.log('生成的parentIds:', idMap);
      return idMap;
    } catch (err) {
      console.error('加载章节父级ID失败:', err);
      setInitializationError(`加载章节信息失败: ${err instanceof Error ? err.message : '未知错误'}`);
      throw err;
    }
  };

  // 修改 loadContextBlocksForChapter 函数，添加超时和错误处理
  const loadContextBlocksForChapter = async (chapterIndex: number, parentId: string) => {
    console.log(`开始加载章节 ${chapterIndex} 的内容，parentId: ${parentId}`);
    setInitializationStep(`loading_chapter_${chapterIndex}`);
    
    try {
      setLoading(true);
      
      // 添加超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('加载章节内容超时')), 15000); // 15秒超时
      });
      
      const queryPromise = supabase
        .from('context_blocks')
        .select('*')
        .eq('parent_id', parentId)
        .order('order_index');

      const { data: blocks, error: blocksError } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (blocksError) throw blocksError;

      if (blocks && blocks.length > 0) {
        // 先预加载音频
        const firstAudioBlock = blocks.find((block: any) => block.block_type === 'audio_aligned');
        if (firstAudioBlock?.speech_id) {
          console.log('正在预加载章节音频:', firstAudioBlock.speech_id);
          
          const { data: audioData } = await supabase
            .from('speech_results')
            .select('audio_url')
            .eq('id', firstAudioBlock.speech_id)
            .single();
            
          if (audioData?.audio_url) {
            await AudioController.cacheSpeechResult({
              id: firstAudioBlock.speech_id,
              audio_url: audioData.audio_url
            });
            
            if (chapterIndex === currentChapter) {
              setAudioUrl(audioData.audio_url);
            }
          }
        }

        setContextBlocks(prev => ({
          ...prev,
          [chapterIndex]: blocks
        }));
      } else {
        // 如果没有块，设置空数组
        setContextBlocks(prev => ({
          ...prev,
          [chapterIndex]: []
        }));
      }
    } catch (err) {
      console.error('加载章节内容失败:', err);
      setInitializationError(`加载章节 ${chapterIndex} 失败: ${err instanceof Error ? err.message : '未知错误'}`);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 简化初始化逻辑，添加更好的错误处理
  useEffect(() => {
    let isMounted = true;
    let initTimeout: NodeJS.Timeout;
    
    async function initializeReader() {
      try {
        console.log('开始初始化阅读器，book.id:', book.id);
        setInitialLoading(true);
        setInitializationError(null);
        
        // 添加总体超时保护
        initTimeout = setTimeout(() => {
          if (isMounted) {
            console.error('初始化超时');
            setInitializationError('初始化超时，请刷新页面重试');
            setInitialLoading(false);
          }
        }, 30000); // 30秒总超时
        
        // 检查book对象是否有效
        if (!book?.id) {
          throw new Error('无效的书籍ID');
        }
        
        if (!book.chapters || book.chapters.length === 0) {
          throw new Error('书籍没有章节');
        }
        
        console.log('书籍章节数量:', book.chapters.length);
        setInitializationStep('loading_parent_ids');
        
        // 先加载并获取 parentIds，简化为单个查询
        const { data, error } = await supabase
          .from('chapters')
          .select('order_index, parent_id')
          .eq('book_id', book.id)
          .order('order_index');

        if (!isMounted) return;

        if (error) {
          throw new Error(`加载章节信息失败: ${error.message}`);
        }

        if (!data || data.length === 0) {
          console.warn('未找到任何章节数据');
          // 设置空的状态而不是抛出错误
          setParentIds({});
          setContextBlocks({ 0: [] });
          setInitializationStep('completed');
          return;
        }
        
        const idMap = data.reduce((acc: Record<number, string>, chapter: { order_index: number; parent_id: string }) => {
          acc[chapter.order_index] = chapter.parent_id;
          return acc;
        }, {});

        if (!isMounted) return;
        
          setParentIds(idMap);
        setInitializationStep('loading_first_chapter');
        
        // 加载第一章内容，简化查询
        const firstChapterParentId = idMap[0];
        if (firstChapterParentId) {
          const { data: blocks, error: blocksError } = await supabase
            .from('context_blocks')
            .select('*')
            .eq('parent_id', firstChapterParentId)
            .order('order_index');

          if (!isMounted) return;

          if (blocksError) {
            console.error('加载第一章内容失败:', blocksError);
            // 不抛出错误，设置空数组
            setContextBlocks({ 0: [] });
          } else {
            setContextBlocks({ 0: blocks || [] });
            
            // 简化音频预加载逻辑
            const firstAudioBlock = blocks?.find((block: any) => block.block_type === 'audio_aligned');
            if (firstAudioBlock?.speech_id && isMounted) {
              // 异步预加载音频，不阻塞主流程
              (async () => {
                try {
                  const { data: audioData } = await supabase
                    .from('speech_results')
                    .select('audio_url')
                    .eq('id', firstAudioBlock.speech_id)
                    .single();
                  
                  if (audioData?.audio_url && isMounted) {
                    setAudioUrl(audioData.audio_url);
                    // 缓存操作也异步进行
                    try {
                      await AudioController.cacheSpeechResult({
                        id: firstAudioBlock.speech_id,
                        audio_url: audioData.audio_url
                      });
                    } catch (error) {
                      console.error('缓存音频失败:', error);
                    }
                  }
                } catch (error) {
                  console.error('预加载音频失败:', error);
                }
              })();
            }
          }
        } else {
          if (isMounted) {
            setContextBlocks({ 0: [] });
          }
        }
        
        if (!isMounted) return;
        
        setInitializationStep('completed');
        console.log('✓ 阅读器初始化完成');
        
      } catch (err) {
        console.error('初始化阅读器失败:', err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : '未知错误';
          setInitializationError(`初始化失败: ${errorMessage}`);
        }
      } finally {
        if (isMounted) {
        setInitialLoading(false);
        }
        if (initTimeout) {
          clearTimeout(initTimeout);
        }
      }
    }

    // 延迟执行初始化，避免竞态条件
    const delayedInit = setTimeout(() => {
      if (isMounted) {
    initializeReader();
      }
    }, 100);
    
    // 清理函数
    return () => {
      isMounted = false;
      if (delayedInit) {
        clearTimeout(delayedInit);
      }
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      // 清理音频控制器
      AudioController.stop();
    };
  }, [book.id]); // 只依赖book.id

  // 简化资源加载逻辑
  useEffect(() => {
    let isMounted = true;
    
    async function loadResources() {
      // 防止重复加载
      if (resources.length > 0) return;
      
      try {
        const { data, error } = await supabase
          .from('book_resources')
          .select('original_path, oss_path')
          .eq('book_id', book.id);

        if (!isMounted) return;

        if (error) {
          console.error('加载资源信息失败:', error);
          return;
        }

        // 规范化资源路径
        const normalizedResources = (data || []).map(resource => ({
          original_path: resource.original_path.replace(/^OEBPS\//, '').replace(/^OPS\//, ''),
          oss_path: resource.oss_path
        }));

        if (isMounted) {
        setResources(normalizedResources);
        }
      } catch (err) {
        console.error('加载资源信息失败:', err);
      }
    }

      loadResources();
    
    return () => {
      isMounted = false;
    };
  }, [book.id]); // 移除resources.length依赖，防止无限循环

  // 在组件中添加调试日志
  useEffect(() => {
    console.log('加载的上下文块:', contextBlocks);
    console.log('当前章节:', currentChapter);
    console.log('当前章节的块:', contextBlocks[currentChapter]);
  }, [contextBlocks, currentChapter]);

  // 添加预加载相邻章节的函数
  const preloadAdjacentChapters = async (currentIndex: number) => {
    const chaptersToPreload = [
      currentIndex + 1, // 下一章
      currentIndex - 1  // 上一章
    ].filter(index => index >= 0 && index < book.chapters.length);

    for (const chapterIndex of chaptersToPreload) {
      if (!contextBlocks[chapterIndex]) {
        console.log(`预加载相邻章节 ${chapterIndex}`);
        const parentId = parentIds[chapterIndex];
        if (parentId) {
          await loadContextBlocksForChapter(chapterIndex, parentId);
        }
      }
    }
  };

  // 修改章节切换处理函数
  const handleChapterChange = async (newChapter: number) => {
    console.log(`切换到章节 ${newChapter}`);
    
    const parentId = parentIds[newChapter];
    if (!parentId) {
      console.error(`未找到章节 ${newChapter} 的 parentId`);
      toast.error('切换章节失败');
      return;
    }
    
    // 如果没有该章节的数据，先加载
    if (!contextBlocks[newChapter]) {
      await loadContextBlocksForChapter(newChapter, parentId);
    } else {
      // 如果已有数据，检查是否需要预加载音频
      const blocks = contextBlocks[newChapter];
      const firstAudioBlock = blocks.find(block => block.block_type === 'audio_aligned');
      
      if (firstAudioBlock?.speech_id) {
        const cachedUrl = AudioController.getCachedAudioUrl(firstAudioBlock.speech_id);
        if (!cachedUrl) {
          // 如果没有缓存，则加载
          console.log('加载章节音频:', firstAudioBlock.speech_id);
          const { data } = await supabase
            .from('speech_results')
            .select('audio_url')
            .eq('id', firstAudioBlock.speech_id)
            .single();
            
          if (data?.audio_url) {
            await AudioController.cacheSpeechResult({
              id: firstAudioBlock.speech_id,
              audio_url: data.audio_url
            });
            setAudioUrl(data.audio_url);
          }
        } else {
          // 如果有缓存，直接使用
          setAudioUrl(cachedUrl);
        }
      }
    }

    // 设置当前章节
    setCurrentChapter(newChapter);
    
    // 预加载相邻章节
    preloadAdjacentChapters(newChapter);
  };

  // 添加处理对齐开始的函数
  const handleAlignmentStart = (blockId: string) => {
    setAligningBlocks(prev => {
      const newSet = new Set(prev);
      newSet.add(blockId);
      return newSet;
    });
  };
  
  // 添加用于获取单个块数据的函数
  const loadSingleContextBlock = async (blockId: string) => {
    try {
      console.log(`加载单个语境块, blockId: ${blockId}`);
      
      const { data: block, error } = await supabase
        .from('context_blocks')
        .select('*')
        .eq('id', blockId)
        .single();
      
      if (error) {
        console.error('加载单个语境块失败:', error);
        return null;
      }
      
      console.log('加载的单个语境块:', block);
      return block;
    } catch (err) {
      console.error('加载单个语境块失败:', err);
      return null;
    }
  };

  // 添加获取句子详情的函数
  const loadSentencesForBlock = async (blockId: string) => {
    try {
      // 获取块-句子关联
      const { data: relations, error: relationsError } = await supabase
        .from('block_sentences')
        .select('sentence_id, order_index')
        .eq('block_id', blockId)
        .order('order_index');
      
      if (relationsError || !relations || relations.length === 0) {
        return [];
      }
      
      // 获取所有句子信息
      const sentenceIds = relations.map(rel => rel.sentence_id);
      const { data: sentences, error: sentencesError } = await supabase
        .from('sentences')
        .select('*, words(*)')
        .in('id', sentenceIds);
      
      if (sentencesError) {
        return [];
      }
      
      // 按正确顺序排列句子
      return relations.map(rel => {
        const sentence = sentences.find(s => s.id === rel.sentence_id);
        return sentence;
      }).filter(Boolean);
    } catch (err) {
      console.error('加载句子数据失败:', err);
      return [];
    }
  };

  // 修改对齐完成处理函数 - 只更新单个块
  const handleAlignmentComplete = async (blockId: string) => {
    console.log(`对齐完成，blockId: ${blockId}, 当前章节: ${currentChapter}`);
    
    // 更新对齐状态
    setAligningBlocks(prev => {
      const newSet = new Set(prev);
      newSet.delete(blockId);
      return newSet;
    });
    
    // 只加载被修改的块
    const updatedBlock = await loadSingleContextBlock(blockId);
    
    if (updatedBlock) {
      // 更新本地状态，只替换修改的块
      setContextBlocks(prev => {
        const updatedChapterBlocks = [...prev[currentChapter]].map(block => 
          block.id === blockId ? updatedBlock : block
        );
        
        return {
          ...prev,
          [currentChapter]: updatedChapterBlocks
        };
      });
      
      toast.success('文本对齐完成', {
        description: '语境块已更新为音频点读模式'
      });
    } else {
      toast.error('获取更新后的块失败', {
        description: '请尝试刷新页面'
      });
    }
  };

  // 处理播放下一个块的函数
  const handlePlayNext = (currentBlockId: string, lastSentenceIndex: number) => {
    // 找到当前块的索引
    const blockIndex = contextBlocks[currentChapter]?.findIndex(b => b.id === currentBlockId);
    
    if (blockIndex !== undefined && blockIndex >= 0 && contextBlocks[currentChapter]) {
      // 寻找下一个音频对齐类型的块
      let nextAlignedBlockIndex = -1;
      
      // 从当前块的下一个开始查找
      for (let i = blockIndex + 1; i < contextBlocks[currentChapter].length; i++) {
        if (contextBlocks[currentChapter][i].block_type === 'audio_aligned') {
          nextAlignedBlockIndex = i;
          break;
        }
      }
      
      // 如果找到了下一个音频对齐块
      if (nextAlignedBlockIndex !== -1) {
        const nextBlock = contextBlocks[currentChapter][nextAlignedBlockIndex];
        // 使用自定义事件通知下一个块开始播放
        window.dispatchEvent(new CustomEvent('play-block-sentence', {
          detail: {
            blockId: nextBlock.id,
            sentenceIndex: 0
          }
        }));
      }
      // 如果当前章节没有更多音频对齐块且处于连续播放模式，则尝试下一章
      else if (playMode === 'continuous') {
        if (currentChapter < book.chapters.length - 1) {
          // 切换到下一章
          handleChapterChange(currentChapter + 1);
          
          // 使用延迟确保新章节加载后再搜索第一个音频对齐块
          setTimeout(() => {
            if (contextBlocks[currentChapter + 1]?.length > 0) {
              // 在新章节中查找第一个音频对齐块
              const firstAlignedBlockIndex = contextBlocks[currentChapter + 1].findIndex(
                block => block.block_type === 'audio_aligned'
              );
              
              if (firstAlignedBlockIndex !== -1) {
                const firstAlignedBlock = contextBlocks[currentChapter + 1][firstAlignedBlockIndex];
                window.dispatchEvent(new CustomEvent('play-block-sentence', {
                  detail: {
                    blockId: firstAlignedBlock.id,
                    sentenceIndex: 0
                  }
                }));
              }
            }
          }, 1000);
        }
      }
    }
  };

  // 添加播放模式选择器UI
  const renderPlayModeSelector = () => (
    <div className="flex items-center gap-2 ml-4">
      <span className="text-xs text-muted-foreground">播放模式:</span>
      <ToggleGroup type="single" value={playMode} onValueChange={(value) => value && setPlayMode(value as any)}>
        <ToggleGroupItem value="sentence" size="sm">句子循环</ToggleGroupItem>
        <ToggleGroupItem value="block" size="sm">段落循环</ToggleGroupItem>
        <ToggleGroupItem value="continuous" size="sm">连续播放</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  // 首先添加一个进度对话框组件
  const ProgressDialog = ({ 
    isOpen, 
    title, 
    message, 
    progress, 
    status,
    onCancel,
    onConfirm 
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    progress: number;
    status: string;
    onCancel: () => void;
    onConfirm: () => void;
  }) => {
    return (
      <Dialog open={isOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md hover:bg-accent"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              确认
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // 修改 handleUndoAlignment 函数
  const handleUndoAlignment = useCallback(async (blockId: string) => {
    confirmAlert({
      title: '确认撤销对齐',
      message: '此操作将删除所有对齐数据，并恢复到原始文本。是否继续？',
      buttons: [
        {
          label: '确认',
          onClick: async () => {
            try {
              setIsUndoing(true);
              setUndoProgress(0);
              setUndoStatus('正在获取句子信息...');

              // 1. 获取所有相关的 sentence IDs
              const { data: sentenceIds, error: sentenceIdsError } = await supabase
                .from('block_sentences')
                .select('sentence_id')
                .eq('block_id', blockId);

              if (sentenceIdsError) throw sentenceIdsError;
              setUndoProgress(5);

              // 2. 批量获取所有句子的 metadata
              setUndoStatus('正在获取句子元数据...');
              const { data: sentencesData, error: sentencesError } = await supabase
                .from('sentences')
                .select('id, alignment_metadata, original_text_content')
                .in('id', sentenceIds?.map(s => s.sentence_id) || []);

              if (sentencesError) throw sentencesError;
              setUndoProgress(15);

              // 3. 批量删除所有相关的 words
              setUndoStatus('正在删除旧的单词数据...');
              const { error: deleteWordsError } = await supabase
                .from('words')
                .delete()
                .in('sentence_id', sentenceIds?.map(s => s.sentence_id) || []);

              if (deleteWordsError) throw deleteWordsError;
              setUndoProgress(30);

              // 4. 准备新的 words 数据
              setUndoStatus('正在准备新的单词数据...');
              const allNewWords = sentencesData?.flatMap(sentence => {
                const wordHistory = sentence.alignment_metadata?.word_history || [];
                return wordHistory.map((word: WordHistoryItem) => ({
                  id: crypto.randomUUID(),
                  sentence_id: sentence.id,
                  word: word.word,
                  begin_time: word.begin_time,
                  end_time: word.end_time,
                  created_at: new Date().toISOString(),
                  original_word: word.original_word,
                  manual_correction: false
                }));
              }) || [];
              setUndoProgress(50);

              // 5. 批量插入新的 words
              setUndoStatus('正在恢复单词数据...');
              if (allNewWords.length > 0) {
                // 分批插入以避免数据量过大
                const batchSize = 100;
                for (let i = 0; i < allNewWords.length; i += batchSize) {
                  const batch = allNewWords.slice(i, i + batchSize);
                  const { error: insertError } = await supabase
                    .from('words')
                    .insert(batch);

                  if (insertError) throw insertError;
                  
                  const batchProgress = 50 + (i / allNewWords.length) * 20;
                  setUndoProgress(batchProgress);
                }
              }
              setUndoProgress(70);

              // 6. 批量更新 sentences
              setUndoStatus('正在更新句子状态...');
              
              // 为每个句子准备更新数据
              const sentenceUpdates = sentencesData?.map(sentence => ({
                id: sentence.id,
                conversion_status: 'reverted',
                text_content: sentence.original_text_content || '', // 使用原始文本
                original_text_content: '',
                alignment_metadata: null
              })) || [];

              // 批量更新所有句子
              for (const update of sentenceUpdates) {
                const { error: updateError } = await supabase
                  .from('sentences')
                  .update({
                    conversion_status: update.conversion_status,
                    text_content: update.text_content,
                    original_text_content: update.original_text_content,
                    alignment_metadata: update.alignment_metadata
                  })
                  .eq('id', update.id);

                if (updateError) throw updateError;
              }

              setUndoProgress(85);

              // 7. 删除 block_sentences 关联
              setUndoStatus('正在清理关联数据...');
              const { error: deleteError } = await supabase
                .from('block_sentences')
                .delete()
                .eq('block_id', blockId);

              if (deleteError) throw deleteError;
              setUndoProgress(90);

              // 8. 更新 context_block
              setUndoStatus('正在更新语境块...');
              const { data: blockInfo, error: blockError } = await supabase
                .from('context_blocks')
                .select('original_content')
                .eq('id', blockId)
                .single();

              if (blockError) throw blockError;

              const { error: updateError } = await supabase
                .from('context_blocks')
                .update({
                  conversion_status: 'reverted',
                  content: blockInfo?.original_content || '',
                  original_content: '',
                  block_type: 'text',
                })
                .eq('id', blockId);

              if (updateError) throw updateError;
              setUndoProgress(95);

              // 9. 更新本地状态
              setUndoStatus('正在更新界面...');
              setContextBlocks(prev => ({
                ...prev,
                [currentChapter]: prev[currentChapter].map(block =>
                  block.id === blockId
                    ? {
                        ...block,
                        conversion_status: 'reverted',
                        content: blockInfo?.original_content || '',
                        original_content: '',
                        block_type: 'text',
                      }
                    : block
                ),
              }));

              setUndoProgress(100);
              setUndoStatus('撤销完成');
              
              // 先显示完成状态，然后关闭分栏视图
              setTimeout(() => {
                setIsUndoing(false);
                setUndoProgress(0);
                setUndoStatus('');
                // 关闭分栏视图
                setActiveSplitViewBlockId(null);
                setSplitViewType(null);
                setSplitViewData(null);
              }, 500);

            } catch (error) {
              console.error('撤销对齐失败:', error);
              toast.error('撤销对齐失败');
              setIsUndoing(false);
              setUndoProgress(0);
              setUndoStatus('');
            }
          },
        },
        {
          label: '取消',
          onClick: () => {},
        },
      ],
    });
  }, [currentChapter, setContextBlocks]);

  const renderSplitViewBlock = (block: { id: string; [key: string]: any }) => (
    <div className="col-span-1">
      <div className={cn(
        'group relative my-1 p-2 rounded-md border transition-all duration-300',
        'bg-primary/5 border-primary/20',
        'hover:bg-primary/10',
        'h-full flex flex-col'
      )}>
        {/* 小标签 - 只在非撤销状态下显示 */}
        {!isUndoing && (
          <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-0.5 bg-background text-[14px] font-medium text-muted-foreground">
            对齐原文
          </div>
        )}
        
        {/* 右上角操作按钮组 */}
        <div className="absolute right-2 top-2 flex space-x-2">
          {/* 撤销按钮 - 使用 Undo 图标替换 X */}
          <button
            onClick={() => {
              if (activeSplitViewBlockId) {
                handleUndoAlignment(activeSplitViewBlockId);
              }
            }}
            className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            title="撤销对齐"
          >
            <Undo className="h-3.5 w-3.5" />
          </button>

          {/* 详情按钮 */}
          <button
            onClick={() => {
              if (activeSplitViewBlockId) {
                handleShowAlignmentDetails(activeSplitViewBlockId);
              }
            }}
            className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="查看详细对齐信息"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          
          {/* 关闭按钮 */}
          <button
            onClick={() => {
              setActiveSplitViewBlockId(null);
              setSplitViewType(null);
              setSplitViewData(null);
            }}
            className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-muted/80 text-muted-foreground hover:text-primary transition-colors"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        
        {/* 进度显示 - 仅在处理中显示 */}
        {isUndoing && block.id === activeSplitViewBlockId && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="w-64 space-y-4">
              <div className="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
                  style={{ width: `${undoProgress}%` }}
                />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                {undoStatus}
              </p>
            </div>
          </div>
        )}

        {/* 内容部分 */}
        <div className="pl-6 pt-3 flex-grow overflow-auto">
          <div className="py-2 px-3 text-sm leading-relaxed h-full">
            <div className="prose prose-sm max-w-none h-full">
              {loadingSplitView ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap user-select-all h-full">
                  {splitViewType === 'source' 
                    ? (splitViewData?.original_content || '')
                    : '翻译内容将在此显示'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBlocks = () => {
    // 显示初始化错误
    if (initializationError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-red-500 text-center">
            <p className="font-medium">初始化失败</p>
            <p className="text-sm text-muted-foreground mt-1">{initializationError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            重新加载页面
          </button>
        </div>
      );
    }

    if (initialLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-center text-sm text-muted-foreground">
            <p>正在初始化阅读器...</p>
            <p>当前步骤: {initializationStep}</p>
          </div>
        </div>
      );
    }

    if (!contextBlocks[currentChapter]) {
      return <div className="p-4 text-muted-foreground">该章节暂无内容</div>;
    }

    const blocks = contextBlocks[currentChapter];
    return blocks.map((block) => {
      const hasSplitView = activeSplitViewBlockId === block.id;
      
      return (
        <div key={block.id} 
          ref={(el) => { blockRefs.current[block.id] = el; }}
          className={`${hasSplitView ? 'grid grid-cols-2 gap-2' : ''}`}
        >
          {/* 主语境块 */}
          <div className={hasSplitView ? 'col-span-1' : ''}>
            <ContextBlocks
              block={block}
              resources={resources}
              onBlockUpdate={handleBlockUpdate}
              onOrderChange={handleBlockOrderChange}
              isSelected={selectedBlocks.has(block.id)}
              onSelect={handleBlockSelect}
              audioUrl={audioUrl}
              onTimeChange={setCurrentTime}
              isAligning={aligningBlocks.has(block.id)}
              onAlignmentComplete={handleAlignmentComplete}
              playMode={playMode}
              onPlayNext={handlePlayNext}
              onPlayModeChange={handlePlayModeChange}
              onShowSplitView={handleShowSplitView}
              activeBlockId={activeBlockId}
            />
          </div>
          
          {/* 分栏视图块 */}
          {hasSplitView && renderSplitViewBlock(block)}
        </div>
      );
    });
  };

  // 修改播放模式变更处理函数
  const handlePlayModeChange = (newMode: 'sentence' | 'block' | 'continuous') => {
    console.log('[ReaderContent] 切换播放模式', {
      newMode,
      currentMode: playMode
    });
    
    // 如果模式没有变化，不做处理
    if (newMode === playMode) return;
    
    // 更新播放模式状态
    setPlayMode(newMode);
    
    // 广播全局播放模式变更事件
    window.dispatchEvent(new CustomEvent('global-loop-mode-change', {
      detail: { mode: newMode }
    }));
  };

  // 修改播放模式事件监听
  useEffect(() => {
    const handleSetPlayMode = (e: CustomEvent) => {
      const { mode } = e.detail;
      if (mode && ['sentence', 'block', 'continuous'].includes(mode)) {
        console.log('[ReaderContent] 收到播放模式变更事件', {
          mode,
          currentMode: playMode
        });
        
        // 如果模式没有变化，不做处理
        if (mode === playMode) return;
        
        setPlayMode(mode);
      }
    };
    
    window.addEventListener('play-mode-changed', handleSetPlayMode as EventListener);
    
    return () => {
      window.removeEventListener('play-mode-changed', handleSetPlayMode as EventListener);
    };
  }, [playMode]);

  // 在组件挂载和卸载时清理音频
  useEffect(() => {
    // 组件挂载时强制清理
    AudioController.stop();
    
    // 组件卸载时也清理
    return () => {
      AudioController.stop();
    };
  }, []);

  // 修改分栏视图显示函数，添加加载状态控制
  const handleShowSplitView = useCallback(async (blockId: string, type: 'source' | 'translation') => {
    // 先重置视图数据，避免显示旧数据
    setSplitViewData(null);
    
    // 设置加载状态为true
    setLoadingSplitView(true);
    
    try {
      setActiveSplitViewBlockId(blockId);
      setSplitViewType(type);
      
      if (type === 'source') {
        // 获取原始内容
        const { data, error } = await supabase
          .from('context_blocks')
          .select('original_content')
          .eq('id', blockId)
          .single();
          
        if (error) {
          console.error('获取原始内容失败:', error);
          return;
        }
        
        setSplitViewData(data);
      } else {
        // 处理翻译内容...
      }
    } catch (err) {
      console.error('加载分栏视图数据失败:', err);
      toast.error('加载失败');
    } finally {
      // 无论成功与否，都设置加载状态为false
      setLoadingSplitView(false);
    }
  }, []);

  // 修改显示对齐详情的方法
  const handleShowAlignmentDetails = (blockId: string) => {
    // 不再使用FloatingPanel，改为在当前位置显示悬浮窗
    setDetailsBlockId(blockId);
    setShowAlignmentDetails(true);
    
    // 将当前点击位置记录下来，用于定位悬浮窗
    const clickEvent = window.event as MouseEvent;
    if (clickEvent) {
      setDetailsPosition({
        x: clickEvent.clientX,
        y: clickEvent.clientY
      });
    }
  };

  // 修复播放单词或句子的函数
  const playAudio = (startTime: number, endTime?: number) => {
    if (!audioUrl) return;
    
    // 先停止所有正在播放的音频
    AudioController.stop();
    
    // 使用新的AudioController API
    const context = endTime ? 'sentence' : 'word';
    
    AudioController.play({
      url: audioUrl,
      startTime, 
      endTime,
      context,
      loop: false
    }).catch(error => {
      console.error('播放失败:', error);
    });
  };

  // 初始化播放模式时
  useEffect(() => {
    // 从localStorage读取用户偏好
    try {
      if (typeof window !== 'undefined') {
        const savedMode = localStorage.getItem('reader_play_mode');
        if (savedMode && ['continuous', 'block', 'sentence'].includes(savedMode)) {
          // 使用节流版本避免初始化时的多次通知
          setPlayMode(savedMode as any); // 只设置状态，不通知
        }
      }
    } catch (e) {
      console.error('读取播放模式失败', e);
    }
  }, []);

  // 添加 useEffect，监听 activeBlockId 变化
  useEffect(() => {
    if (activeBlockId) {
      const element = blockRefs.current[activeBlockId];
      if (element) {
        // 使用 scrollIntoView API 滚动到元素
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center', // 将元素滚动到视口的中心
        });
      }
    }
  }, [activeBlockId]);

  const handleUploadSuccess = async (newAudioUrl: string, newSpeechId: string) => {
    // ... 之前的逻辑 ...
    setIsUploadDialogOpen(false); // 关闭对话框
  };

  const handleUploadError = (error: string) => {
    //错误逻辑
  };

  // 检测客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 检测设备类型
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px是常用的移动设备断点
    };
    
    // 初始检测
    checkMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 保存唱片显示状态到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reader_show_vinyl', showVinyl.toString());
    }
  }, [showVinyl]);

  // 初始化时从 localStorage 读取状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedShowVinyl = localStorage.getItem('reader_show_vinyl');
      if (savedShowVinyl !== null) {
        setShowVinyl(savedShowVinyl === 'true');
      }
    }
  }, []);

  // 添加更可靠的处理函数
  const handleAudioPanelToggle = useCallback((show: boolean) => {
    // 设置短延迟确保事件处理完成
    setTimeout(() => {
      setShowAudioPanel(show);
    }, 50);
  }, []);
  
  // 添加初始化效果确保手机端默认关闭
  useEffect(() => {
    if (isMobile) {
      setShowAudioPanel(false);
    }
  }, [isMobile]);

  // 监听音频播放状态变化
  useEffect(() => {
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying } = e.detail;
      setIsPlaying(newIsPlaying);
    };
    
    window.addEventListener('audio-state-change', handleStateChange as EventListener);
    
    return () => {
      window.removeEventListener('audio-state-change', handleStateChange as EventListener);
    };
  }, []);
  
  // 添加播放控制函数
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      AudioController.pause();
    } else {
      AudioController.play({
        url: audioUrl,
        context: 'main'
      });
    }
  }, [isPlaying, audioUrl]);

  // 重命名章节函数
  const renameChapter = async (chapterIndex: number, newTitle: string) => {
    if (!newTitle.trim()) {
      toast.error('章节标题不能为空');
      return false;
    }

    try {
      setIsRenamingChapter(true);
      
      const chapter = book.chapters[chapterIndex];
      if (!chapter) {
        toast.error('章节不存在');
        return false;
      }

      console.log(`开始重命名章节 ${chapterIndex}: "${chapter.title}" -> "${newTitle.trim()}"`);

      // 更新数据库中的章节标题
      const { error: chapterError } = await supabase
        .from('chapters')
        .update({ title: newTitle.trim() })
        .eq('id', chapter.id);

      if (chapterError) {
        console.error('更新章节标题失败:', chapterError);
        throw new Error(`更新章节标题失败: ${chapterError.message}`);
      }

      // 更新content_parents表中的标题
      const { error: parentError } = await supabase
        .from('content_parents')
        .update({ title: newTitle.trim() })
        .eq('id', chapter.parent_id);

      if (parentError) {
        console.error('更新父级标题失败:', parentError);
        throw new Error(`更新父级标题失败: ${parentError.message}`);
      }

      // 更新本地状态
      book.chapters[chapterIndex].title = newTitle.trim();

      toast.success(`章节已重命名为 "${newTitle.trim()}"`);
      console.log('✓ 章节重命名成功');
      
      return true;
    } catch (error) {
      console.error('重命名章节失败:', error);
      toast.error(`重命名失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    } finally {
      setIsRenamingChapter(false);
    }
  };

  // 开始编辑章节标题
  const startEditChapter = (chapterIndex: number) => {
    const chapter = book.chapters[chapterIndex];
    if (chapter) {
      setEditingChapterIndex(chapterIndex);
      setEditingChapterTitle(chapter.title);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 阅读器导航栏 */}
      <div 
        className="fixed left-0 right-0 h-12 border-b bg-card/95 backdrop-blur flex items-center px-4 z-40"
        style={{ 
          top: isMobile ? '3rem' : '3.5rem'
        }}
      >
        {/* 重新组织导航栏布局 */}
        <div className="flex-1 flex items-center justify-between">
          {/* 左侧区域 */}
          <div className="flex items-center gap-2">
            {/* 目录按钮 */}
            <button
              onClick={() => setShowToc(!showToc)}
              className={`p-1.5 hover:bg-accent rounded-md transition-colors ${
                showToc ? 'bg-accent/30' : ''
              }`}
            >
              <Menu className="w-4 h-4" />
            </button>
            
            {/* 桌面端才显示的上下章节按钮 */}
            {!isMobile && (
              <>
                <button
                  onClick={() => handleChapterChange(currentChapter - 1)}
                  disabled={currentChapter <= 0}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    currentChapter <= 0 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover:bg-accent"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => handleChapterChange(currentChapter + 1)}
                  disabled={currentChapter >= book.chapters.length - 1}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    currentChapter >= book.chapters.length - 1 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover:bg-accent"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* 中间区域 - 不修改，保持现有布局 */}
          {isMobile ? (
            <div className="flex items-center justify-between flex-1 px-4">
              <button
                onClick={() => handleChapterChange(Math.max(0, currentChapter - 1))}
                disabled={currentChapter === 0}
                className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center flex-1">
                <h1 className="text-base font-semibold truncate text-center">{book.title}</h1>
                <h2 className="text-sm text-muted-foreground truncate text-center">
                  {book.chapters[currentChapter]?.title}
                </h2>
              </div>

              <button
                onClick={() => handleChapterChange(Math.min(book.chapters.length - 1, currentChapter + 1))}
                disabled={currentChapter === book.chapters.length - 1}
                className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            // 桌面端保持原有布局
            <div className="flex-1 px-4">
              <div className="text-center">
                <h1 className="text-base font-semibold truncate">{book.title}</h1>
                <h2 className="text-sm text-muted-foreground truncate">
                  {book.chapters[currentChapter]?.title}
                </h2>
              </div>
            </div>
          )}

          {/* 右侧按钮 - 不修改，保持现有布局 */}
          <button
            onClick={() => handleAudioPanelToggle(!showAudioPanel)}
            className={`p-1.5 hover:bg-accent/50 rounded-md transition-colors relative ${
              showAudioPanel ? 'bg-accent/30' : ''
            } ${isMobile ? 'hidden' : ''}`}
            title="音频处理"
          >
            <Mic className={`w-4 h-4 transition-colors ${
              showAudioPanel ? 'text-primary/80' : ''
            }`} />
            {audioUrl && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* 主要内容区域 - 根据设备类型调整顶部内边距 */}
      <div 
        className="flex-1 pb-16"
        style={{ 
          paddingTop: isMobile ? '3.75rem' : '4rem' // 移动设备上更小的顶部内边距
        }}
      >
        <div className="max-w-3xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            renderBlocks()
          )}
        </div>
      </div>

      {/* 目录侧边栏 */}
      <div className={`
        fixed left-0 top-[calc(3rem+var(--reader-nav-height,3rem))] h-[calc(100vh-6rem)]
        transform transition-all duration-300 ease-in-out border-r shadow-lg z-30
        bg-card/95 backdrop-blur
        ${showToc ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-3 border-b bg-card/95 backdrop-blur sticky top-0">
            <h3 className="text-sm font-medium">目录</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div 
              className="space-y-1"
              onDragOver={handleChapterListDragOver}
            >
              {/* 在第一个章节前的插入区域 */}
              <div 
                className={cn(
                  "relative h-2 group transition-all duration-200",
                  dragOverIndex === 0 && draggedChapter !== null && "h-3"
                )}
                onMouseEnter={() => setShowInsertButtonIndex(0)}
                onMouseLeave={() => setShowInsertButtonIndex(null)}
              >
                {showInsertButtonIndex === 0 && !draggedChapter && (
                  <button
                    onClick={() => {
                      setInsertPosition(0);
                      setNewChapterTitle('新章节');
                    }}
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 
                               w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center
                               hover:bg-primary/80 transition-colors z-10"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
                
                {/* 拖拽指示线 - 在第一个位置 */}
                {dragOverIndex === 0 && draggedChapter !== null && (
                  <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary rounded z-10"></div>
                )}
                
                {/* 插入指示线 - 悬停时 */}
                {showInsertButtonIndex === 0 && !draggedChapter && (
                  <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary/30 rounded"></div>
                )}
              </div>

              {book.chapters.map((chapter, index) => (
                <div key={chapter.id || index}>
                  {/* 章节项 */}
                  <div
                    data-chapter-index={index}
                    className={cn(
                      "relative group transition-all duration-200",
                      draggedChapter === index && "opacity-30 scale-95",
                      dragOverIndex === index && draggedChapter !== null && draggedChapter !== index && "scale-105"
                    )}
                    draggable
                    onDragStart={(e) => handleChapterDragStart(e, index)}
                    onDragOver={(e) => handleChapterDragOver(e, index)}
                    onDragLeave={handleChapterDragLeave}
                    onDrop={(e) => handleChapterDrop(e, index)}
                  >
                    <div className="flex items-center gap-2">
                      {/* 拖拽手柄 */}
                      <div className={cn(
                        "transition-opacity cursor-grab active:cursor-grabbing",
                        draggedChapter !== null ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                      )}>
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                      </div>
                      
                      {/* 章节按钮 */}
                      {editingChapterIndex === index ? (
                        // 编辑状态：显示输入框
                        <input
                          type="text"
                          value={editingChapterTitle}
                          onChange={(e) => setEditingChapterTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (editingChapterTitle.trim()) {
                                renameChapter(editingChapterIndex!, editingChapterTitle).then((success) => {
                                  if (success) {
                                    setEditingChapterIndex(null);
                                    setEditingChapterTitle('');
                                  }
                                });
                              }
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingChapterIndex(null);
                              setEditingChapterTitle('');
                            }
                          }}
                          onBlur={() => {
                            if (editingChapterTitle.trim()) {
                              renameChapter(editingChapterIndex!, editingChapterTitle).then((success) => {
                                if (success) {
                                  setEditingChapterIndex(null);
                                  setEditingChapterTitle('');
                                }
                              });
                            } else {
                              setEditingChapterIndex(null);
                              setEditingChapterTitle('');
                            }
                          }}
                          autoFocus
                          disabled={isRenamingChapter}
                          data-editing-chapter="true"
                          className={cn(
                            "flex-1 px-3 py-2 rounded-md text-sm bg-background border-2 border-primary",
                            "focus:outline-none focus:ring-0 focus:border-primary",
                            isRenamingChapter && "opacity-50 cursor-not-allowed",
                            currentChapter === index && 'bg-primary/5'
                          )}
                        />
                      ) : (
                        // 正常状态：显示按钮
                <button
                  onClick={() => {
                    handleChapterChange(index);
                    setShowToc(false);
                  }}
                  onContextMenu={(e) => handleChapterContextMenu(e, index)}
                        className={cn(
                          "flex-1 text-left px-3 py-2 rounded-md text-sm transition-all duration-200",
                    currentChapter === index 
                      ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-accent',
                          draggedChapter === index && "bg-primary/5"
                        )}
                >
                  {chapter.title}
                </button>
                      )}
                    </div>
                  </div>

                  {/* 章节间的插入区域 */}
                  <div 
                    className={cn(
                      "relative h-2 group transition-all duration-200",
                      dragOverIndex === index + 1 && draggedChapter !== null && "h-3"
                    )}
                    onMouseEnter={() => setShowInsertButtonIndex(index + 1)}
                    onMouseLeave={() => setShowInsertButtonIndex(null)}
                  >
                    {showInsertButtonIndex === index + 1 && !draggedChapter && (
                      <button
                        onClick={() => {
                          setInsertPosition(index + 1);
                          setNewChapterTitle('新章节');
                        }}
                        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 
                                   w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center
                                   hover:bg-primary/80 transition-colors z-10"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                    
                    {/* 拖拽指示线 - 在章节之间 */}
                    {dragOverIndex === index + 1 && draggedChapter !== null && (
                      <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary rounded z-10"></div>
                    )}
                    
                    {/* 插入指示线 - 悬停时 */}
                    {showInsertButtonIndex === index + 1 && !draggedChapter && (
                      <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary/30 rounded"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 新章节创建对话框 */}
        {insertPosition !== null && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">创建新章节</h3>
              <input
                type="text"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="输入章节标题"
                className="w-full px-3 py-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newChapterTitle.trim()) {
                    createNewChapter(insertPosition, newChapterTitle.trim());
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setInsertPosition(null);
                    setNewChapterTitle('');
                  }}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
                  disabled={isCreatingChapter}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (newChapterTitle.trim()) {
                      createNewChapter(insertPosition, newChapterTitle.trim());
                    }
                  }}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  disabled={isCreatingChapter || !newChapterTitle.trim()}
                >
                  {isCreatingChapter ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右键菜单 - 移到外部使用Portal */}
      {mounted && showContextMenu && contextMenuChapterIndex !== null && createPortal(
        <div 
          className="fixed z-[60] min-w-[120px] dropdown-menu-content"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (contextMenuChapterIndex !== null) {
                closeContextMenu();
                startEditChapter(contextMenuChapterIndex);
              }
            }}
            disabled={isRenamingChapter}
            className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer dropdown-menu-item"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isRenamingChapter ? '重命名中...' : '重命名章节'}
          </button>
          
          <div className="border-t mx-2 my-0.5"></div>
          
          <button
            onClick={() => {
              if (contextMenuChapterIndex !== null) {
                if (book.chapters.length <= 1) {
                  toast.error('无法删除最后一个章节');
                  closeContextMenu();
                  return;
                }
                
                // 确认删除 - 使用 confirmAlert 替代 window.confirm
                const chapterTitle = book.chapters[contextMenuChapterIndex]?.title || '未知章节';
                const chapterIndex = contextMenuChapterIndex;
                
                closeContextMenu(); // 先关闭右键菜单
                
                confirmAlert({
                  title: '确认删除章节',
                  message: `确定要删除章节《${chapterTitle}》吗？\n\n此操作将删除该章节及其所有内容，且无法撤销。`,
                  buttons: [
                    {
                      label: '取消',
                      onClick: () => {}
                    },
                    {
                      label: '删除',
                      onClick: async () => {
                        const toastId = toast.loading(`正在删除《${chapterTitle}》...`, {
                          duration: Infinity,
                        });
                        
                        try {
                          await deleteChapter(chapterIndex);
                          
                          toast.success(`《${chapterTitle}》已删除`, {
                            id: toastId,
                            duration: 3000,
                          });
                        } catch (error) {
                          console.error('删除章节失败:', error);
                          toast.error(`删除《${chapterTitle}》失败，请重试`, {
                            id: toastId,
                            duration: 3000,
                          });
                        }
                      },
                      className: 'react-confirm-alert-button-red'
                    }
                  ]
                });
              }
            }}
            disabled={isDeletingChapter}
            className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 text-red-500 focus:text-red-500 disabled:opacity-50 cursor-pointer dropdown-menu-item"
          >
            <X className="w-4 h-4" />
            {isDeletingChapter ? '删除中...' : '删除章节'}
          </button>
          
          <div className="border-t mx-2 my-0.5"></div>
          
          <button
            onClick={closeContextMenu}
            className="w-full px-3 py-1.5 text-left text-sm cursor-pointer dropdown-menu-item"
          >
            取消
          </button>
        </div>,
        document.body
      )}

      {/* 音频处理抽屉面板 */}
      <div
        className={`
          fixed right-0 transform transition-all duration-300 ease-in-out
          bg-card/95 backdrop-blur border-l shadow-lg z-30
          group
          ${isMobile 
            ? `bottom-0 left-0 h-72 w-full border-t ${showAudioPanel ? 'translate-y-0' : 'translate-y-full'}` 
            : `top-[calc(3rem+3rem-1.5px)] h-[calc(100vh-6rem+1.5px)] w-[400px] ${showAudioPanel ? 'translate-x-0' : 'translate-x-full'}`
          }
        `}
      >
        {/* 标题栏 */}
        <div className="p-2 border-b bg-card/95 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Mic className="w-4 h-4 text-primary/80" />
              <h2 className="text-sm font-medium">音频处理</h2>
            </div>

            {/* 移动设备上的关闭按钮 */}
            {isMobile && (
              <button 
                onClick={() => handleAudioPanelToggle(false)}
                className="p-2 hover:bg-accent/50 rounded-md flex items-center justify-center"
                aria-label="关闭音频处理面板"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}

            {/* 上传按钮 - 只在有历史记录时显示 */}
            {audioUrl && (
              <>
                <HoverBorderGradient
                  containerClassName="rounded-md"
                  className="flex items-center gap-1.5 text-xs"
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  <Plus className="w-3 h-3" />
                  <span>上传音频</span>
                </HoverBorderGradient>

                <AudioUploader
                  bookId={book.id}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  isOpen={isUploadDialogOpen}
                  onOpenChange={setIsUploadDialogOpen}
                  isProcessing={isCreatingChapter}
                />
              </>
            )}
          </div>
        </div>

        {/* 为移动设备调整内容区域的样式 */}
        <div className={`${isMobile ? 'h-[calc(100%-40px)]' : 'flex-1'} overflow-y-auto p-2`}>
          <AudioRecognizer
            bookContent={book.chapters[currentChapter]?.content || ''}
            bookId={book.id}
            onAudioUrlChange={setAudioUrl}
            onTimeChange={setCurrentTime}
          />
        </div>

        {/* 移动设备底部显示时的把手 */}
        {isMobile && (
          <div 
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent cursor-ns-resize"
            onTouchStart={(e) => {
              // 添加拖拽调整高度逻辑
              const panel = e.currentTarget.parentElement;
              if (!panel) return;
              
              const startY = e.touches[0].clientY;
              const startHeight = panel.offsetHeight;
              
              const handleTouchMove = (moveEvent: TouchEvent) => {
                const deltaY = startY - moveEvent.touches[0].clientY;
                const newHeight = Math.min(window.innerHeight * 0.7, Math.max(200, startHeight + deltaY));
                panel.style.height = `${newHeight}px`;
              };
              
              const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove as any);
                document.removeEventListener('touchend', handleTouchEnd as any);
              };
              
              document.addEventListener('touchmove', handleTouchMove as any);
              document.addEventListener('touchend', handleTouchEnd as any);
            }}
          />
        )}

        {/* 桌面端的宽度调整把手 - 只在非移动设备显示 */}
        {!isMobile && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 group-hover:bg-primary/10"
            onMouseDown={(e) => {
              const panel = e.currentTarget.parentElement;
              if (!panel) return;

              const startX = e.pageX;
              const startWidth = panel.offsetWidth;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.pageX - startX;
                const newWidth = Math.max(300, Math.min(800, startWidth - deltaX));
                panel.style.width = `${newWidth}px`;
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        )}
      </div>

      {/* 修改唱片播放器渲染方式 - 使用Portal并添加显示控制 */}
      {mounted && audioUrl && createPortal(
        <DraggableAudioPlayer
          key={audioUrl}
          bookId={book.id}
          audioUrl={audioUrl}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          passiveMode={true}
          isVisible={showVinyl}
        />,
        document.body
      )}

      {/* 替换FloatingPanel为自定义悬浮窗 */}
      {showAlignmentDetails && detailsBlockId && (
        <TerminalPopover
          blockId={detailsBlockId}
          contextBlocks={contextBlocks[currentChapter] || []}
          position={detailsPosition}
          onClose={() => setShowAlignmentDetails(false)}
          audioUrl={audioUrl}
        />
      )}

      {/* 全局导航栏控制 */}
      <style jsx global>{`
        nav.fixed {
          transition: transform 0.3s ease;
        }
        nav.fixed.hidden {
          transform: translateY(-100%);
        }
      `}</style>
      <script dangerouslySetInnerHTML={{
        __html: `
          let lastScrollY = window.scrollY;
          const mainNav = document.querySelector('nav.fixed');
          
          window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
              mainNav?.classList.add('hidden');
            } else if (currentScrollY < lastScrollY || currentScrollY < 50) {
              mainNav?.classList.remove('hidden');
            }
            
            lastScrollY = currentScrollY;
          });
        `
      }} />

      {/* 移动设备底部音频控制按钮 */}
      {isMobile && audioUrl && !showAudioPanel && (
        <div className="fixed bottom-0 left-0 right-0 h-12 bg-card/95 backdrop-blur border-t flex items-center gap-2 px-4 z-30">
          {/* 音频处理按钮 */}
          <button
            onClick={() => handleAudioPanelToggle(true)}
            className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center relative"
          >
            <Mic className="w-4 h-4 text-primary/80" />
            {audioUrl && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
          
          {/* 播放/暂停按钮 - 修改为使用本地状态 */}
          <button 
            className="w-8 h-8 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center"
            onClick={togglePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          
          {/* 唱片显示/隐藏按钮 */}
          <button 
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              showVinyl ? "bg-primary/20 text-primary" : "bg-accent/10 hover:bg-accent/20"
            )}
            onClick={() => setShowVinyl(!showVinyl)}
          >
            <svg 
              viewBox="0 0 24 24" 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}