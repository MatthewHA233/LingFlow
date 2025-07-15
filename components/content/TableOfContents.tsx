'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { X, GripVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { createPortal } from 'react-dom';

interface TableOfContentsProps {
  book: Book;
  currentChapter: number;
  showToc: boolean;
  onChapterChange: (index: number) => void;
  onToggleToc: () => void;
  isMobile?: boolean;
  mounted?: boolean;
  parentIds: Record<number, string>;
  setParentIds: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  contextBlocks: Record<string, any[]>;
  setContextBlocks: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  setCurrentChapter: React.Dispatch<React.SetStateAction<number>>;
}

export function TableOfContents({
  book,
  currentChapter,
  showToc,
  onChapterChange,
  onToggleToc,
  isMobile = false,
  mounted = false,
  parentIds,
  setParentIds,
  contextBlocks,
  setContextBlocks,
  setCurrentChapter
}: TableOfContentsProps) {
  // 根据书籍类型确定内容类型名称
  const contentTypeName = book.type === 'notebook' ? '页面' : '章节';
  const contentTypeNameNew = book.type === 'notebook' ? '新页面' : '新章节';

  // 目录相关状态
  const [draggedChapter, setDraggedChapter] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showInsertButtonIndex, setShowInsertButtonIndex] = useState<number | null>(null);
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  // 添加对齐处理状态管理
  const [isAlignmentProcessing, setIsAlignmentProcessing] = useState(false);

  // 右键菜单相关状态
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuChapterIndex, setContextMenuChapterIndex] = useState<number | null>(null);
  const [isDeletingChapter, setIsDeletingChapter] = useState(false);

  // 章节重命名相关状态
  const [editingChapterIndex, setEditingChapterIndex] = useState<number | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const [isRenamingChapter, setIsRenamingChapter] = useState(false);

  // 监听对齐处理开始和完成事件
  useEffect(() => {
    const handleAlignmentProcessingStart = (event: CustomEvent) => {
      console.log('🚀 TableOfContents: 对齐处理开始，禁用章节拖拽排序');
      setIsAlignmentProcessing(true);
    };

    const handleAlignmentProcessingComplete = (event: CustomEvent) => {
      console.log('✅ TableOfContents: 对齐处理完成，启用章节拖拽排序');
      setIsAlignmentProcessing(false);
    };

    window.addEventListener('alignment-processing-start', handleAlignmentProcessingStart as EventListener);
    window.addEventListener('alignment-processing-complete', handleAlignmentProcessingComplete as EventListener);

    return () => {
      window.removeEventListener('alignment-processing-start', handleAlignmentProcessingStart as EventListener);
      window.removeEventListener('alignment-processing-complete', handleAlignmentProcessingComplete as EventListener);
    };
  }, []);

  // 章节拖拽排序处理函数
  const handleChapterDragStart = (e: React.DragEvent, index: number) => {
    // 如果正在进行对齐处理，禁用拖拽
    if (isAlignmentProcessing) {
      console.log('🚫 对齐处理中，禁用章节拖拽排序');
      e.preventDefault();
      return;
    }

    setDraggedChapter(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 添加拖拽开始的视觉反馈
    console.log(`开始拖拽章节 ${index}: ${book.chapters?.[index]?.title}`);
  };

  const handleChapterDragOver = (e: React.DragEvent, index: number) => {
    // 如果正在进行对齐处理，禁用拖拽
    if (isAlignmentProcessing) {
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 只有当拖拽的不是同一个章节时才显示指示
    if (draggedChapter !== null && draggedChapter !== index) {
      setDragOverIndex(index);
    }
  };

  const handleChapterDragLeave = (e: React.DragEvent) => {
    // 如果正在进行对齐处理，禁用拖拽
    if (isAlignmentProcessing) {
      return;
    }

    // 只有当鼠标真正离开目标区域时才清除指示
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleChapterDrop = async (e: React.DragEvent, dropIndex: number) => {
    // 如果正在进行对齐处理，禁用拖拽
    if (isAlignmentProcessing) {
      console.log('🚫 对齐处理中，禁用章节拖拽排序');
      e.preventDefault();
      return;
    }

    e.preventDefault();
    
    console.log(`拖拽放置: draggedChapter=${draggedChapter}, dropIndex=${dropIndex}`);
    
    if (draggedChapter === null || draggedChapter === dropIndex) {
      console.log('取消拖拽：源和目标相同或无效');
      setDraggedChapter(null);
      setDragOverIndex(null);
      return;
    }

    // 在重新排序前保存被拖拽章节的标题
    const draggedChapterTitle = book.chapters?.[draggedChapter]?.title || '未知章节';

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

  const handleChapterListDragOver = (e: React.DragEvent) => {
    // 如果正在进行对齐处理，禁用拖拽
    if (isAlignmentProcessing) {
      return;
    }

    e.preventDefault();
    
    if (draggedChapter === null) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    
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
    
    if (chapterElements[closestIndex]) {
      const elementRect = chapterElements[closestIndex].getBoundingClientRect();
      const elementY = elementRect.top - rect.top + elementRect.height / 2;
      
      if (y > elementY) {
        closestIndex += 1;
      }
    }
    
    setDragOverIndex(closestIndex);
  };

  // 更新章节顺序的函数
  const updateChapterOrder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      console.log('源位置和目标位置相同，跳过操作');
      return;
    }

    console.log(`章节重排序: ${fromIndex} -> ${toIndex}`);

    try {
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
      if (!chapters) {
        console.error('book.chapters 为空，无法重排序');
        return;
      }
      
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
          
          newContextBlocks[newIndex] = blocks as any[];
        });
        
        setContextBlocks(newContextBlocks);
        console.log('✓ 重新映射语境块缓存');
      }
      
      // 更新当前章节索引
      if (fromIndex === currentChapter) {
        setCurrentChapter(toIndex);
      } else if (fromIndex < currentChapter && toIndex >= currentChapter) {
        setCurrentChapter((prev: number) => prev - 1);
      } else if (fromIndex > currentChapter && toIndex <= currentChapter) {
        setCurrentChapter((prev: number) => prev + 1);
      }
      
      console.log('✓ 本地状态更新完成');
      
    } catch (error) {
      console.error('章节重排序失败:', error);
      throw error;
    }
  };

  // 创建新章节的函数
  const createNewChapter = async (position: number, title: string) => {
    try {
      setIsCreatingChapter(true);
      
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
        throw new Error(`创建${contentTypeName}失败: ${error.message}`);
      }

      if (!result || !result.success) {
        console.error('RPC函数返回错误:', result);
        throw new Error(`创建${contentTypeName}失败: ${result?.error || '未知错误'}`);
      }

      console.log('✓ RPC调用成功:', result);

      // 更新本地状态
      const chapterData = result.chapter;
      const defaultBlock = result.default_block;

      // 在指定位置插入新章节
      const chapters = [...(book.chapters || [])];
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
      
      console.log(`✓ 创建${contentTypeName}后重新构建parentIds映射:`, newParentIds);

      // 重新映射现有的语境块缓存
      if (Object.keys(contextBlocks).length > 0) {
        const newContextBlocks: Record<string, any[]> = {};
        
        // 为新章节添加默认语境块
        newContextBlocks[position] = [defaultBlock];
        
        // 将现有章节的语境块向后移动一位
        Object.entries(contextBlocks).forEach(([oldIndexStr, blocks]) => {
          const oldIndex = parseInt(oldIndexStr);
          const newIndex = oldIndex >= position ? oldIndex + 1 : oldIndex;
          newContextBlocks[newIndex] = blocks as any[];
        });
        
        setContextBlocks(newContextBlocks);
        console.log(`✓ 创建${contentTypeName}后重新映射语境块缓存`);
      } else {
        // 如果没有现有缓存，只为新章节添加默认语境块
        setContextBlocks((prev: Record<string, any[]>) => ({
          ...prev,
          [position]: [defaultBlock]
        }));
      }

      // 调整当前章节索引
      if (position <= currentChapter) {
        setCurrentChapter(currentChapter + 1);
      }
      toast.success(`${contentTypeNameNew} "${title}" 已创建`);
      
    } catch (error) {
      console.error(`创建${contentTypeName}失败:`, error);
      toast.error(`创建${contentTypeName}失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
      setContextBlocks((prev: Record<string, any[]>) => ({
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
      
      const chapterTitle = book.chapters?.[chapterIndex]?.title || `未知${contentTypeName}`;
      
      console.log(`开始删除${contentTypeName} ${chapterIndex}: "${chapterTitle}"`);

      const { data: result, error } = await supabase
        .rpc('delete_chapter_at_position', {
          p_book_id: book.id,
          p_position: chapterIndex
        });

      console.log(`删除${contentTypeName}RPC调用结果:`, { result, error });

      if (error) {
        console.error('RPC调用失败:', error);
        throw new Error(`删除失败: ${error.message}`);
      }

      if (!result || !result.success) {
        console.error('RPC函数返回错误:', result);
        throw new Error(`删除失败: ${result?.error || '未知错误'}`);
      }

      console.log(`✓ 删除${contentTypeName}成功，删除了 ${result.deleted_blocks_count} 个语境块`);
      // 更新本地状态
      const chapters = [...(book.chapters || [])];
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
          newContextBlocks[oldIndex] = blocks as any[];
        } else if (oldIndex > chapterIndex) {
          // 在删除章节之后的章节，索引减1
          newContextBlocks[oldIndex - 1] = blocks as any[];
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
        setCurrentChapter((prev: number) => prev - 1);
      }

      toast.success(`${contentTypeName} "${chapterTitle}" 已删除`);
      
    } catch (error) {
      console.error(`删除${contentTypeName}失败:`, error);
      toast.error(`删除${contentTypeName}失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const menuWidth = 120;
    const menuHeight = 80;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let finalX = mouseX;
    let finalY = mouseY;
    
    if (mouseX + menuWidth > windowWidth) {
      finalX = windowWidth - menuWidth - 10;
    }
    
    if (mouseY + menuHeight > windowHeight) {
      finalY = mouseY - menuHeight;
    }
    
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
  


  // 重命名章节函数
  const renameChapter = async (chapterIndex: number, newTitle: string) => {
    if (!newTitle.trim()) {
      toast.error(`${contentTypeName}标题不能为空`);
      return false;
    }

    try {
      setIsRenamingChapter(true);
      
      const chapter = book.chapters?.[chapterIndex];
      if (!chapter) {
        toast.error(`${contentTypeName}不存在`);
        return false;
      }

      console.log(`开始重命名${contentTypeName} ${chapterIndex}: "${chapter.title}" -> "${newTitle.trim()}"`);

      const { error: chapterError } = await supabase
        .from('chapters')
        .update({ title: newTitle.trim() })
        .eq('id', chapter.id);

      if (chapterError) {
        console.error(`更新${contentTypeName}标题失败:`, chapterError);
        throw new Error(`更新${contentTypeName}标题失败: ${chapterError.message}`);
      }

      const { error: parentError } = await supabase
        .from('content_parents')
        .update({ title: newTitle.trim() })
        .eq('id', chapter.parent_id);

      if (parentError) {
        console.error('更新父级标题失败:', parentError);
        throw new Error(`更新父级标题失败: ${parentError.message}`);
      }

      if (book.chapters && book.chapters[chapterIndex]) {
      book.chapters[chapterIndex].title = newTitle.trim();
      }

      toast.success(`${contentTypeName}已重命名为 "${newTitle.trim()}"`);
      console.log(`✓ ${contentTypeName}重命名成功`);
      
      return true;
    } catch (error) {
      console.error(`重命名${contentTypeName}失败:`, error);
      toast.error(`重命名失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    } finally {
      setIsRenamingChapter(false);
    }
  };

  // 开始编辑章节标题
  const startEditChapter = (chapterIndex: number) => {
    const chapter = book.chapters?.[chapterIndex];
    if (chapter) {
      setEditingChapterIndex(chapterIndex);
      setEditingChapterTitle(chapter.title);
    }
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
        const target = event.target as HTMLElement;
        const editingInput = document.querySelector('input[data-editing-chapter]') as HTMLInputElement;
        
        if (editingInput && !editingInput.contains(target) && !target.closest('[data-editing-chapter]')) {
          if (editingChapterTitle.trim()) {
            renameChapter(editingChapterIndex, editingChapterTitle).then((success) => {
              if (success) {
                setEditingChapterIndex(null);
                setEditingChapterTitle('');
              }
            });
          } else {
            setEditingChapterIndex(null);
            setEditingChapterTitle('');
          }
        }
      }
    };

    if (editingChapterIndex !== null) {
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [editingChapterIndex, editingChapterTitle]);

  if (!showToc) return null;

  // 确保章节数组存在
  const chapters = book.chapters || [];

  return (
    <>
      {/* 目录侧边栏 */}
      <div className={`
        fixed left-0 top-[calc(3rem+var(--reader-nav-height,3rem))] h-[calc(100vh-6rem)]
        transform transition-all duration-300 ease-in-out border-r shadow-lg z-30
        bg-card/95 backdrop-blur
        translate-x-0 w-80 max-w-sm
      `}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b bg-card/95 backdrop-blur sticky top-0">
            <h3 className="text-base font-medium">目录</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
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
                      setNewChapterTitle(contentTypeNameNew);
                    }}
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 
                               w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center
                               hover:bg-primary/80 transition-colors z-10"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
                
                {dragOverIndex === 0 && draggedChapter !== null && (
                  <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary rounded z-10"></div>
                )}
                
                {showInsertButtonIndex === 0 && !draggedChapter && (
                  <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary/30 rounded"></div>
                )}
              </div>

              {chapters.map((chapter, index) => (
                <div key={chapter.id || index}>
                  {/* 章节项 */}
                  <div
                    data-chapter-index={index}
                    className={cn(
                      "relative group transition-all duration-200",
                      draggedChapter === index && "opacity-30 scale-95",
                      dragOverIndex === index && draggedChapter !== null && draggedChapter !== index && "scale-105"
                    )}
                    draggable={!isAlignmentProcessing} // 对齐处理中时禁用拖拽
                    onDragStart={(e) => handleChapterDragStart(e, index)}
                    onDragOver={(e) => handleChapterDragOver(e, index)}
                    onDragLeave={handleChapterDragLeave}
                    onDrop={(e) => handleChapterDrop(e, index)}
                  >
                    <div className="flex items-center gap-2">
                      {/* 拖拽手柄 */}
                      <div className={cn(
                        "transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0",
                        draggedChapter !== null ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                        isAlignmentProcessing && "opacity-30 cursor-not-allowed" // 对齐处理中时显示禁用状态
                      )}>
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                      </div>
                      
                      {/* 章节按钮 */}
                      {editingChapterIndex === index ? (
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
                            "flex-1 px-3 py-2.5 rounded-md text-sm bg-background border-2 border-primary",
                            "focus:outline-none focus:ring-0 focus:border-primary min-w-0",
                            isRenamingChapter && "opacity-50 cursor-not-allowed",
                            currentChapter === index && 'bg-primary/5'
                          )}
                        />
                      ) : (
                        <button
                          onClick={() => {
                            onChapterChange(index);
                            onToggleToc();
                          }}
                          onContextMenu={(e) => handleChapterContextMenu(e, index)}
                          className={cn(
                            "flex-1 text-left px-3 py-2.5 rounded-md text-sm transition-all duration-200 min-w-0",
                            currentChapter === index 
                              ? 'bg-primary/10 text-primary font-medium' 
                              : 'hover:bg-accent',
                            draggedChapter === index && "bg-primary/5"
                          )}
                          title={chapter.title}
                        >
                          <span className="block truncate">{chapter.title}</span>
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
                          setNewChapterTitle(contentTypeNameNew);
                        }}
                        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 
                                   w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center
                                   hover:bg-primary/80 transition-colors z-10"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                    
                    {dragOverIndex === index + 1 && draggedChapter !== null && (
                      <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-primary rounded z-10"></div>
                    )}
                    
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
              <h3 className="text-lg font-semibold mb-4">创建{contentTypeNameNew}</h3>
              <input
                type="text"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder={`输入${contentTypeName}标题`}
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

      {/* 右键菜单 */}
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
            {isRenamingChapter ? '重命名中...' : `重命名${contentTypeName}`}
          </button>
          
          <div className="border-t mx-2 my-0.5"></div>
          
          <button
            onClick={() => {
              if (contextMenuChapterIndex !== null) {
                if (chapters.length <= 1) {
                  toast.error(`无法删除最后一个${contentTypeName}`);
                  closeContextMenu();
                  return;
                }
                
                const chapterTitle = chapters[contextMenuChapterIndex]?.title || `未知${contentTypeName}`;
                const chapterIndex = contextMenuChapterIndex;
                
                closeContextMenu();
                
                confirmAlert({
                  title: `确认删除${contentTypeName}`,
                  message: `确定要删除${contentTypeName}《${chapterTitle}》吗？\n\n此操作将删除该${contentTypeName}及其所有内容，且无法撤销。`,
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
                          console.error(`删除${contentTypeName}失败:`, error);
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
            {isDeletingChapter ? '删除中...' : `删除${contentTypeName}`}
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
    </>
  );
} 