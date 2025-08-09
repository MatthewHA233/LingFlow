import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { Play, Pause, Loader2, FileText, FileEdit, Music2, Globe, Network, Hash, Share2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextAlignmentService } from '@/lib/services/text-alignment';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import Image from 'next/image';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';
import { AnimatePresence, motion } from "framer-motion";
import { AnchorWordBlock, SelectedWord } from './AnchorWordBlock';
import { AnchorHighlightRenderer } from './AnchorHighlightRenderer';
import { AudioAnchorRenderer } from './AudioAnchorRenderer';
import { type MeaningBlockFormatted } from '@/lib/services/meaning-blocks-service';
import { ContextBlocksService } from '@/lib/services/context-blocks-service';
import { SimpleBlockMenu, type BlockType } from '@/components/ui/SimpleBlockMenu';
import styles from './ContextBlocks.module.css';

interface ContextBlocksProps {
  block: {
    id: string;
    block_type: string;
    content: string;
    original_content?: string;
    metadata?: Record<string, any>;
    order_index: number;
    speech_id?: string;
    parent_id?: string;
    translation_content?: string;
    translation_status?: string;
    translation_metadata?: Record<string, any>;
    translation_updated_at?: string;
  };
  resources?: Array<{ original_path: string; oss_path: string }>;
  onBlockUpdate?: (blockId: string, newType: string, content: string) => void;
  onOrderChange?: (draggedId: string, droppedId: string, position: 'before' | 'after') => void;
  isSelected?: boolean;
  onSelect?: (blockId: string | null, event: React.MouseEvent) => void;
  audioUrl?: string;
  onTimeChange?: (time: number) => void;
  isAligning?: boolean;
  onAlignmentComplete?: (blockId: string) => void;
  playMode?: 'sentence' | 'block' | 'continuous';
  onPlayNext?: (blockId: string, lastSentenceIndex: number) => void;
  onPlayModeChange?: (newMode: 'sentence' | 'block' | 'continuous') => void;
  onShowSplitView?: (blockId: string, type: 'source' | 'translation') => void;
  activeBlockId: string | null;
  onAnchorWordsChange?: (blockId: string, words: SelectedWord[]) => void;
  onEnterAnchorMode?: () => void;
  onExitAnchorMode?: () => void;
  anchorSelectedWords?: SelectedWord[];
  meaningBlocks?: MeaningBlockFormatted[];
  loadingMeaningBlocks?: boolean;
  isInAnchorMode?: boolean;
}

// 添加一个全局活跃块ID事件
const ACTIVE_BLOCK_CHANGED_EVENT = 'active-block-changed';

// 添加这行代码，定义 CLEAR_ACTIVE_SENTENCE_EVENT
const CLEAR_ACTIVE_SENTENCE_EVENT = 'clear-active-sentences';

export function ContextBlocks({ 
  block, 
  resources, 
  onBlockUpdate,
  onOrderChange,
  isSelected,
  onSelect,
  audioUrl,
  onTimeChange,
  isAligning = false,
  onAlignmentComplete,
  playMode,
  onPlayNext,
  onPlayModeChange,
  onShowSplitView,
  activeBlockId,
  onAnchorWordsChange,
  onEnterAnchorMode,
  onExitAnchorMode,
  anchorSelectedWords = [],
  meaningBlocks = [],
  loadingMeaningBlocks = false,
  isInAnchorMode = false,
}: ContextBlocksProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localAligning, setLocalAligning] = useState(isAligning);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [embeddedSentences, setEmbeddedSentences] = useState<Map<string, any>>(new Map());
  const [isLoadingSentences, setIsLoadingSentences] = useState(false);
  const [showAlignmentPanel, setShowAlignmentPanel] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [sentences, setSentences] = useState<any[]>([]);
  const [blockSpeechId, setBlockSpeechId] = useState<string | undefined>(block.speech_id);
  
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [loopMode, setLoopMode] = useState<'sentence' | 'block' | 'continuous'>('continuous');
  const [audioContext, setAudioContext] = useState<'sentence' | 'block' | 'word' | 'main'>('main');
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number | null>(null);
  
  const blockRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  
  // 创建唯一ID用于标识当前块
  const uniqueBlockId = useId();

  // 添加缺失的ref
  const isClicking = useRef(false);

  // 添加焦点状态管理
  const [isFocused, setIsFocused] = useState(false);

  // 添加鼠标悬浮状态管理
  const [isHovered, setIsHovered] = useState(false);

  // 添加拖拽状态管理
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null);
  const [isTextSelecting, setIsTextSelecting] = useState(false);

  // 添加块操作菜单状态
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockMenuPosition, setBlockMenuPosition] = useState({ x: 0, y: 0 });

  // 添加翻译显示状态
  const [showInlineTranslation, setShowInlineTranslation] = useState(false);

  // 同步contentEditable的内容，但避免在用户输入时重复更新
  useEffect(() => {
    // 检查是否是可编辑的块类型（文本块或标题块）
    const isEditableBlock = block.block_type === 'text' || block.block_type.startsWith('heading_');
    
    if (contentEditableRef.current && isEditableBlock) {
      const currentContent = contentEditableRef.current.textContent || '';
      const blockContent = block.content || '';
      
      // 只有当内容真的不同时才更新DOM
      if (currentContent !== blockContent) {
        // 检查是否当前元素有焦点，如果有焦点说明用户正在编辑，不要更新
        if (document.activeElement !== contentEditableRef.current) {
          contentEditableRef.current.textContent = blockContent;
        }
      }
    }
  }, [block.content, block.block_type]);

  // 处理焦点获得
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // 处理焦点失去
  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setIsFocused(false);
    // 移除这里的内容更新，避免与handleInput重复
  }, []);

  // 处理鼠标进入
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // 处理鼠标离开
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // 处理输入事件 - 用于实时检测内容变化
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    // 实时更新内容，确保占位符能正确显示/隐藏
    const newContent = e.currentTarget.textContent || '';
    onBlockUpdate?.(block.id, block.block_type, newContent);
  }, [onBlockUpdate, block.id, block.block_type]);

  // 处理鼠标按下 - 记录起始位置
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsTextSelecting(false);
    
    // 如果是在contentEditable区域内按下，标记为文本选择
    const target = e.target as HTMLElement;
    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      setIsTextSelecting(true);
    }
  }, []);

  // 处理鼠标移动 - 检测是否是文本选择
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStartPos) return;
    
    const deltaX = Math.abs(e.clientX - dragStartPos.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 如果移动距离超过阈值且在contentEditable区域内，确认为文本选择
    if (distance > 5 && isTextSelecting) {
      setIsTextSelecting(true);
    }
  }, [dragStartPos, isTextSelecting]);

  // 处理鼠标释放 - 清除状态
  const handleMouseUp = useCallback(() => {
    setDragStartPos(null);
    setIsTextSelecting(false);
  }, []);

  // 处理拖拽手柄点击 - 显示块操作菜单
  const handleDragHandleClick = useCallback((e: React.MouseEvent) => {
    // 只有在真正的点击（而不是拖拽结束）时才显示菜单
    // 通过检查鼠标移动距离来判断是点击还是拖拽
    if (isDragging) {
      // 如果正在拖拽，不显示菜单
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // 获取手柄元素的位置信息
    const handleElement = e.currentTarget as HTMLElement;
    const rect = handleElement.getBoundingClientRect();
    
    // 设置菜单位置 - 使用手柄的中心位置
    setBlockMenuPosition({ 
      x: rect.left + rect.width / 2, // 手柄水平中心
      y: rect.top + rect.height / 2  // 手柄垂直中心
    });
    setShowBlockMenu(true);
  }, [isDragging]);

  // 处理块类型转换
  const handleBlockTypeChange = useCallback(async (newType: BlockType) => {
    try {
      // 调用父组件的更新函数
      onBlockUpdate?.(block.id, newType, block.content);
      
      // 根据块类型显示不同的提示消息
      const typeLabels = {
        'text': '文本',
        'heading_1': '一级标题',
        'heading_2': '二级标题', 
        'heading_3': '三级标题',
        'heading_4': '四级标题'
      };
      
      toast.success(`块类型已转换为${typeLabels[newType] || newType}`);
    } catch (error) {
      console.error('转换块类型失败:', error);
      toast.error('转换失败');
    }
  }, [block.id, block.content, onBlockUpdate]);

  // 处理块删除 - 使用事件机制而不是刷新页面
  const handleBlockDelete = useCallback(async () => {
    try {
      // === 第一步：立即更新UI，提供即时反馈 ===
      // 立即通知父组件移除块（乐观更新）
      window.dispatchEvent(new CustomEvent('remove-temp-block', {
        detail: { tempId: block.id }
      }));
      
      // 不显示"正在删除"的提示，直接进行后台操作
      console.log('📡 后台验证数据库删除操作');
      
      const result = await ContextBlocksService.deleteBlock(block.id);
      
      if (result.success) {
        console.log('✅ 数据库删除成功:', result);
        // 只在成功时显示一次提示
        toast.success('块已删除');
        
      } else {
        console.error('❌ 数据库删除失败:', result);
        
        // === 第三步：如果数据库操作失败，回滚UI更改 ===
        console.log('🔄 回滚UI更改 - 重新创建块');
        
        // 重新创建块（回滚删除操作）
        window.dispatchEvent(new CustomEvent('create-temp-block', {
          detail: { 
            tempId: block.id,
            content: block.content || '',
            orderIndex: block.order_index,
            parentId: block.parent_id || '',
            afterBlockId: null // 可能需要重新计算位置
          }
        }));
        
        // 只在真正失败时显示错误提示
        toast.error(`删除失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('💥 删除块异常:', error);
      
      // 异常情况下的回滚处理
      console.log('🔄 异常回滚 - 重新创建块');
      
      // 重新创建块
      window.dispatchEvent(new CustomEvent('create-temp-block', {
        detail: { 
          tempId: block.id,
          content: block.content || '',
          orderIndex: block.order_index,
          parentId: block.parent_id || '',
          afterBlockId: null
        }
      }));
      
      toast.error('删除失败');
    }
  }, [block.id, block.content, block.order_index, block.parent_id]);

  // 添加创建新块的处理函数 - 优化版本
  const handleCreateNewBlock = useCallback(async () => {
    if (!contentEditableRef.current || block.block_type !== 'text') return;
    
    try {
      // 获取光标位置和分割内容
      const { beforeContent, afterContent, position } = ContextBlocksService.splitContentAtCursor(
        contentEditableRef.current
      );
      
      // 如果没有 parent_id，尝试从 block 中获取或报错
      const parentId = block.parent_id;
      if (!parentId) {
        toast.error('无法创建新块：缺少父级ID');
        return;
      }
      
      // === 第一步：立即更新UI，提供即时反馈 ===
      console.log('🚀 开始分割块 - 立即更新UI', {
        position,
        beforeContent: beforeContent.substring(0, 20) + '...',
        afterContent: afterContent.substring(0, 20) + '...',
        originalLength: block.content?.length || 0
      });
      
      // 1. 立即更新当前块的显示内容（保留光标前的内容）
      if (contentEditableRef.current) {
        contentEditableRef.current.textContent = beforeContent;
      }
      
      // 2. 立即通知父组件更新当前块内容
      onBlockUpdate?.(block.id, block.block_type, beforeContent);
      
      // 3. 立即创建一个临时的新块ID（用于乐观更新）
      const tempNewBlockId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 4. 计算临时块应该有的 order_index（紧跟在当前块后面）
      const tempOrderIndex = block.order_index + 0.5; // 使用小数确保排在当前块后面，但在下一个块前面
      
      // 5. 立即通知父组件有新块创建（乐观更新），传递正确的排序信息
      window.dispatchEvent(new CustomEvent('create-temp-block', {
        detail: { 
          tempId: tempNewBlockId,
          content: afterContent, // 可能为空字符串，这是允许的
          orderIndex: tempOrderIndex,
          parentId: parentId,
          afterBlockId: block.id // 指定在哪个块后面插入
        }
      }));
      
      // 6. 显示成功提示（乐观）
      const message = afterContent.trim() 
        ? '正在创建新文本块...' 
        : '正在创建空语境块...';
      toast.success(message);
      
      // === 第二步：后台验证数据库操作 ===
      console.log('📡 后台验证数据库操作');
      
      // 异步调用分割函数
      const result = await ContextBlocksService.splitBlock(
        block.id,
        beforeContent,
        afterContent,
        position
      );
      
      if (result.success) {
        console.log('✅ 数据库分割成功:', result);
        
        // 如果数据库操作成功，更新成功提示
        const successMessage = afterContent.trim() 
          ? '新文本块创建成功' 
          : '空语境块创建成功';
        toast.success(successMessage);
        
        // 如果真实的新块ID和临时ID不同，通知父组件更新
        if (result.new_block_id && result.new_block_id !== tempNewBlockId) {
          // 可以通过自定义事件通知父组件替换临时ID
          window.dispatchEvent(new CustomEvent('replace-temp-block', {
            detail: { 
              tempId: tempNewBlockId, 
              realId: result.new_block_id,
              afterContent: afterContent
            }
          }));
        }
        
        // 短暂延迟后尝试将焦点移到新块
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('focus-block', {
            detail: { blockId: result.new_block_id || tempNewBlockId }
          }));
        }, 100);
        
      } else {
        console.error('❌ 数据库分割失败:', result);
        
        // === 第三步：如果数据库操作失败，回滚UI更改 ===
        console.log('🔄 回滚UI更改');
        
        // 1. 恢复原内容
        if (contentEditableRef.current) {
          contentEditableRef.current.textContent = block.content || '';
        }
        
        // 2. 通知父组件恢复原块内容
        onBlockUpdate?.(block.id, block.block_type, block.content || '');
        
        // 3. 通知父组件移除临时创建的块
        window.dispatchEvent(new CustomEvent('remove-temp-block', {
          detail: { tempId: tempNewBlockId }
        }));
        
        // 4. 显示错误提示
        toast.error(`创建新块失败: ${result.error || '未知错误'}`);
      }
      
    } catch (error) {
      console.error('💥 创建新块异常:', error);
      
      // === 异常处理：完全回滚 ===
      // 1. 恢复原内容
      if (contentEditableRef.current) {
        contentEditableRef.current.textContent = block.content || '';
      }
      
      // 2. 通知父组件恢复
      onBlockUpdate?.(block.id, block.block_type, block.content || '');
      
      // 3. 显示错误提示
      toast.error('创建新块时发生错误');
    }
  }, [block.id, block.block_type, block.parent_id, block.content, block.order_index, onBlockUpdate]);

  // 先定义辅助函数，不依赖其他函数
  const getSentenceIdsFromContent = useCallback(() => {
    const ids: string[] = [];
    const pattern = /\[\[([a-f0-9-]+)\]\]/g;
    let match;
    
    while ((match = pattern.exec(block.content || '')) !== null) {
      ids.push(match[1]);
    }
    
    return ids;
  }, [block.content]);

  // 声明playSentence函数引用，使用useRef解决循环引用问题
  const playSentenceRef = useRef<any>(null);

  // 定义handleSentenceEnd函数，使用ref引用playSentence
  const handleSentenceEnd = useCallback((index: number) => {
    if (!embeddedSentences || embeddedSentences.size === 0) return;
    
    // 提取句子IDs
    const sentenceIds = getSentenceIdsFromContent();
    if (index < 0 || index >= sentenceIds.length) return;
    
    // 判断是否为最后一句
    const isLastSentence = index >= sentenceIds.length - 1;
    
    // 如果是连续播放模式且是最后一句，在转向下一个块前清除当前高亮
    if (playMode === 'continuous' && isLastSentence) {
      console.log(`${block.id}: 最后一句播放完毕，清除高亮并准备下一个块`);
      
      // 先清除当前高亮
      setActiveIndex(null);
      setIsPlaying(false);
      setActiveWordId(null);
      
      // 然后再播放下一个块
      setTimeout(() => {
        onPlayNext?.(block.id, index);
      }, 50);
    } else if (playMode === 'sentence') {
      // 重播当前句子
      const sentenceId = sentenceIds[index];
      const sentence = embeddedSentences.get(sentenceId);
      if (sentence) {
        setTimeout(() => playSentenceRef.current(sentence, index), 300);
      }
    } else if (playMode === 'block' && isLastSentence) {
      // 段落循环 - 回到第一句
      const firstId = sentenceIds[0];
      const firstSentence = embeddedSentences.get(firstId);
      if (firstSentence) {
        setTimeout(() => playSentenceRef.current(firstSentence, 0), 600);
      }
    } else if ((playMode === 'block' || playMode === 'continuous') && !isLastSentence) {
      // 播放下一句
      const nextIndex = index + 1;
      const nextId = sentenceIds[nextIndex];
      const nextSentence = embeddedSentences.get(nextId);
      if (nextSentence) {
        setTimeout(() => playSentenceRef.current(nextSentence, nextIndex), 300);
      }
    }
  }, [embeddedSentences, playMode, getSentenceIdsFromContent, block.id, onPlayNext]);

  // 完全重写的playSentence函数
  const playSentence = useCallback((sentence: any, index: number) => {
    console.log('[ContextBlocks] 播放句子', {
      index,
      sentence,
      playMode,
      isPlaying,
      activeIndex
    });
    
    // 如果点击当前播放的句子，则停止播放
    if (activeIndex === index && isPlaying) {
      console.log('[ContextBlocks] 停止当前句子播放');
      AudioController.stop();
      setIsPlaying(false);
      setActiveIndex(null);
      setActiveWordId(null);
      return;
    }
    
    // 广播当前活跃块ID
    console.log('[ContextBlocks] 广播活跃块ID', { blockId: block.id });
    window.dispatchEvent(new CustomEvent(ACTIVE_BLOCK_CHANGED_EVENT, {
      detail: { activeBlockId: block.id }
    }));
    
    // 始终先停止所有播放
    AudioController.stop();
    
    // 检查句子数据
    if (!sentence || !audioUrl) {
      console.error('[ContextBlocks] 无法播放：句子数据或音频URL缺失', { sentence, audioUrl });
      return;
    }
    
    // 获取时间范围
    const beginTime = sentence.begin_time;
    const endTime = sentence.end_time;
    
    if (beginTime === undefined || endTime === undefined) {
      console.error('[ContextBlocks] 句子缺少时间信息', sentence);
      return;
    }
    
    console.log(`[ContextBlocks] 准备播放句子`, {
      index,
      beginTime,
      endTime,
      playMode
    });
    
    // 先设置状态，确保UI立即反应
    setActiveIndex(index);
    setIsPlaying(true);
    
    // 根据当前播放模式设置循环
    const shouldLoop = playMode === 'sentence';
    
    // 使用AudioController播放
    AudioController.play({
      url: audioUrl,
      startTime: beginTime,
      endTime: endTime,
      context: 'sentence',
      loop: shouldLoop,
      onEnd: () => {
        if (!shouldLoop) {
          console.log('[ContextBlocks] 非循环模式播放结束，清除状态');
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
        }
      }
    });
    
    // 更新父组件时间
    onTimeChange?.(beginTime);
  }, [activeIndex, isPlaying, audioUrl, block.id, onTimeChange, playMode]);

  // 更新引用
  useEffect(() => {
    playSentenceRef.current = playSentence;
  }, [playSentence]);
  
  // 修改音频事件监听，增加范围外检测清除逻辑
  useEffect(() => {
    // 只在浏览器环境中添加事件监听
    if (typeof window === 'undefined') return;
    
    // 监听音频时间更新事件 - 用于句子和单词高亮
    const handleTimeUpdate = (e: CustomEvent) => {
      const { currentTime } = e.detail;
      
      const adjustedTime = currentTime + 0.5;
      setCurrentAudioTime(adjustedTime);
      if (isClicking.current) return;

      const sentenceIds = getSentenceIdsFromContent();

      if (sentenceIds.length === 0 || embeddedSentences.size === 0) {
        if (activeIndex !== null || isPlaying) {
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
          if (activeBlockId === block.id) {
            onSelect?.(null, {} as React.MouseEvent);
          }
        }
        return;
      }

      let inAnySentenceRange = false;

      for (let i = 0; i < sentenceIds.length; i++) {
        const sentenceId = sentenceIds[i];
        const sentence = embeddedSentences.get(sentenceId);

        if (!sentence) continue;

        if (adjustedTime >= sentence.begin_time &&
            adjustedTime <= sentence.end_time) {
          inAnySentenceRange = true;

          if (activeIndex !== i) {
            console.log(`[ContextBlocks] 进入新句子范围`, {
              index: i,
              currentTime: adjustedTime,
              beginTime: sentence.begin_time,
              endTime: sentence.end_time,
              playMode
            });
            
            setActiveIndex(i);
            setIsPlaying(true);
            onSelect?.(block.id, {} as React.MouseEvent);

            // 只在句子循环模式下设置循环范围
            if (playMode === 'sentence') {
              AudioController.setPlayMode('sentence', sentence.begin_time, sentence.end_time);
            } else if (playMode === 'block' && i === 0) {
              // 在块循环模式下，只在进入第一句时设置整个块的循环范围
              const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
              if (lastSentence) {
                AudioController.setPlayMode('block', sentence.begin_time, lastSentence.end_time);
              }
            }
          }

          // 单词高亮逻辑
          if (sentence.words && Array.isArray(sentence.words)) {
            let newActiveWordId = null;
            for (const word of sentence.words) {
              if (adjustedTime >= word.begin_time &&
                  adjustedTime <= word.end_time) {
                newActiveWordId = word.id;
                break;
              }
            }
            if (newActiveWordId !== activeWordId) {
              setActiveWordId(newActiveWordId);
            }
          }
          break;
        }
      }

      if (!inAnySentenceRange) {
        if (activeIndex !== null || isPlaying) {
          console.log('[ContextBlocks] 超出句子范围，清除高亮');
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
          if (activeBlockId === block.id) {
            onSelect?.(null, {} as React.MouseEvent);
          }
        }
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    };
  }, [activeIndex, isPlaying, embeddedSentences, getSentenceIdsFromContent, activeBlockId, block.id, onSelect, activeWordId, playMode]);

  // 2. 然后是其他函数和useEffect，保持原有顺序
  const parseAndLoadEmbeddedSentences = useCallback(async () => {
    // 仅处理音频对齐块或包含[[sentenceId]]格式的文本块
    if (block.block_type === 'audio_aligned' || 
        (block.content && block.content.includes('[['))) {
      
      // 提取所有句子ID
      const sentenceIdMatches = block.content.match(/\[\[([a-f0-9-]+)\]\]/g) || [];
      if (sentenceIdMatches.length === 0) return;
      
      setIsLoadingSentences(true);
      
      try {
        // 从所有匹配中提取纯ID
        const sentenceIds = sentenceIdMatches.map(match => 
          match.replace('[[', '').replace(']]', '')
        );
        
        // 加载所有引用的句子
        const { data: sentences, error } = await supabase
          .from('sentences')
          .select('*, words(*)')
          .in('id', sentenceIds);
        
        if (error) {
          console.error('加载嵌入式句子失败:', error);
          return;
        }
        
        // 创建ID到句子的映射
        const sentencesMap = new Map();
        sentences?.forEach(sentence => {
          sentencesMap.set(sentence.id, sentence);
        });
        
        setEmbeddedSentences(sentencesMap);
      } catch (err) {
        console.error('处理嵌入式句子失败:', err);
      } finally {
        setIsLoadingSentences(false);
      }
    }
  }, [block.block_type, block.content]);

  // 在embeddedSentences变更时更新sentences数组
  useEffect(() => {
    if (embeddedSentences.size > 0) {
      // 从嵌入式句子映射中提取句子数组并按顺序排列
      const extractedSentences: any[] = [];
      const sentenceIdMatches = block.content.match(/\[\[([a-f0-9-]+)\]\]/g) || [];
      
      sentenceIdMatches.forEach(match => {
        const id = match.replace('[[', '').replace(']]', '');
        const sentence = embeddedSentences.get(id);
        if (sentence) {
          extractedSentences.push(sentence);
        }
      });
      
      setSentences(extractedSentences);
    }
  }, [embeddedSentences, block.content]);

  useEffect(() => {
    parseAndLoadEmbeddedSentences();
  }, [parseAndLoadEmbeddedSentences]);

  // 添加监听块类型变化的useEffect，防止重复渲染
  useEffect(() => {
    // 当块类型发生变化时，清理嵌入式句子状态
    // 这可以防止在音频对齐完成后出现重复渲染的问题
    console.log(`🔄 块类型变化检测: ${block.id}, 类型: ${block.block_type}`);
    
    // 如果块类型不是audio_aligned且不包含[[]]标记，清理句子状态
    if (block.block_type !== 'audio_aligned' && 
        (!block.content || !block.content.includes('[['))) {
      console.log(`🧹 清理块 ${block.id} 的嵌入式句子状态`);
      setEmbeddedSentences(new Map());
      setSentences([]);
      setIsLoadingSentences(false);
    }
  }, [block.id, block.block_type, block.content]);

  // 添加同步contentEditableRef与block.content的useEffect
  useEffect(() => {
    // 确保contentEditableRef的内容与block.content保持同步
    // 特别是在退出锚定模式后，避免文本消失的问题
    if (contentEditableRef.current && !isInAnchorMode) {
      const currentContent = contentEditableRef.current.textContent || '';
      const blockContent = block.content || '';
      
      // 只有当内容不一致时才更新，避免不必要的DOM操作
      if (currentContent !== blockContent) {
        console.log(`🔄 同步contentEditableRef内容: ${block.id}`, {
          currentContent: currentContent.substring(0, 50) + '...',
          blockContent: blockContent.substring(0, 50) + '...'
        });
        contentEditableRef.current.textContent = blockContent;
      }
    }
  }, [block.content, isInAnchorMode, block.id]);

  useEffect(() => {
    setLocalAligning(isAligning);
  }, [isAligning]);

  useEffect(() => {
    if (localAligning) {
      const timer = setTimeout(() => {
        setLocalAligning(false);
        setShowCompleteAnimation(true);
        
        setTimeout(() => {
          setShowCompleteAnimation(false);
          onAlignmentComplete?.(block.id);
          
          parseAndLoadEmbeddedSentences();
        }, 1500);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [localAligning, block.id, onAlignmentComplete, parseAndLoadEmbeddedSentences]);

  // 加载 context_blocks 数据
  useEffect(() => {
    async function loadContextBlock() {
      if (block.block_type === 'audio_aligned') {
        try {
          console.log('开始加载语境块数据:', block.id);
          const { data, error } = await supabase
            .from('context_blocks')
            .select('speech_id')
            .eq('id', block.id)
            .single();

          if (error) throw error;
          if (data?.speech_id) {
            console.log('获取到语境块 speech_id:', data.speech_id);
            setBlockSpeechId(data.speech_id);
          }
        } catch (err) {
          console.error('加载语境块数据失败:', err);
        }
      }
    }

    loadContextBlock();
  }, [block.id, block.block_type]);

  // 添加对齐处理状态管理
  const [isAlignmentProcessing, setIsAlignmentProcessing] = useState(false);

  // 添加语境块选择相关状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionType, setSelectionType] = useState<'start' | 'end' | 'tts' | null>(null);
  const [isBlockSelectable, setIsBlockSelectable] = useState(false);
  const [isSelectedAsStart, setIsSelectedAsStart] = useState(false);
  const [isSelectedAsEnd, setIsSelectedAsEnd] = useState(false);
  const [isProcessingAlignment, setIsProcessingAlignment] = useState(false);
  // 新增：记录选择范围信息
  const [selectedRange, setSelectedRange] = useState<{startBlockId: string, endBlockId: string} | null>(null);
  
  // TTS相关状态
  const [isTTSMode, setIsTTSMode] = useState(false);
  const [ttsStartBlock, setTtsStartBlock] = useState<string | null>(null);
  const [ttsSelectedBlocks, setTtsSelectedBlocks] = useState<string[]>([]);
  const [isTTSStartBlock, setIsTTSStartBlock] = useState(false);
  const [isTTSSelectedBlock, setIsTTSSelectedBlock] = useState(false);

  // 监听对齐处理开始和完成事件
  useEffect(() => {
    const handleAlignmentProcessingStart = (event: CustomEvent) => {
      console.log('🚀 ContextBlocks: 对齐处理开始，禁用拖拽功能');
      setIsAlignmentProcessing(true);
    };

    const handleAlignmentProcessingComplete = (event: CustomEvent) => {
      console.log('✅ ContextBlocks: 对齐处理完成，启用拖拽功能');
      setIsAlignmentProcessing(false);
    };

    window.addEventListener('alignment-processing-start', handleAlignmentProcessingStart as EventListener);
    window.addEventListener('alignment-processing-complete', handleAlignmentProcessingComplete as EventListener);

    return () => {
      window.removeEventListener('alignment-processing-start', handleAlignmentProcessingStart as EventListener);
      window.removeEventListener('alignment-processing-complete', handleAlignmentProcessingComplete as EventListener);
    };
  }, []);

  // 监听语境块选择事件
  useEffect(() => {
    const handleEnableSelection = (event: CustomEvent) => {
      const { mode } = event.detail;
      setIsSelectionMode(true);
      setSelectionType(mode);
      setIsBlockSelectable(true);
      
      if (mode === 'tts') {
        // TTS模式
        setIsTTSMode(true);
        setTtsStartBlock(null);
        setTtsSelectedBlocks([]);
        setIsSelectedAsStart(false);
        setIsSelectedAsEnd(false);
        setIsProcessingAlignment(false);
        setSelectedRange(null);
      } else if (mode === 'start') {
        // 音频对齐模式 - 选择起始块
        setIsTTSMode(false);
        setIsSelectedAsStart(false);
        setIsSelectedAsEnd(false);
        setIsProcessingAlignment(false);
        setSelectedRange(null);
      } else if (mode === 'end') {
        // 音频对齐模式 - 选择结束块
        setIsTTSMode(false);
        setIsSelectedAsEnd(false);
        setIsProcessingAlignment(false);
      }
    };

    const handleDisableSelection = () => {
      setIsSelectionMode(false);
      setSelectionType(null);
      setIsBlockSelectable(false);
      // 注释掉这两行，不在禁用选择时重置状态
      // setIsSelectedAsStart(false);
      // setIsSelectedAsEnd(false);
      setIsProcessingAlignment(false);
      // selectedRange 也不重置，保持选择范围信息
      // setSelectedRange(null);
      
      // 重置TTS状态
      setIsTTSMode(false);
      setTtsStartBlock(null);
      setTtsSelectedBlocks([]);
      setIsTTSStartBlock(false);
      setIsTTSSelectedBlock(false);
    };

    // 监听选择确认事件
    const handleSelectionConfirmed = (event: CustomEvent) => {
      const { startBlockId, endBlockId } = event.detail;
      
      // 保存选择范围
      setSelectedRange({ startBlockId, endBlockId });
      
      if (block.id === startBlockId) {
        setIsSelectedAsStart(true);
        setIsSelectedAsEnd(false);
      } else if (block.id === endBlockId) {
        setIsSelectedAsEnd(true);
        setIsSelectedAsStart(false);
      } else {
        setIsSelectedAsStart(false);
        setIsSelectedAsEnd(false);
      }
    };

    // 监听标记起始块为已选择的事件
    const handleMarkStartBlockSelected = (event: CustomEvent) => {
      const { startBlockId } = event.detail;
      
      if (block.id === startBlockId) {
        setIsSelectedAsStart(true);
        setIsSelectedAsEnd(false);
        // 同时更新选择范围（部分）
        setSelectedRange(prev => ({
          startBlockId: startBlockId,
          endBlockId: prev?.endBlockId || ''
        }));
      }
    };

    // TTS选择事件处理函数
    const handleMarkTTSBlockSelected = (event: CustomEvent) => {
      const { blockId, isStart } = event.detail;
      
      if (block.id === blockId) {
        if (isStart) {
          setIsTTSStartBlock(true);
          setIsTTSSelectedBlock(false);
        }
      } else {
        setIsTTSStartBlock(false);
      }
    };

    const handleMarkTTSBlocksSelected = (event: CustomEvent) => {
      const { selectedBlockIds } = event.detail;
      
      if (selectedBlockIds && Array.isArray(selectedBlockIds)) {
        const isInSelection = selectedBlockIds.includes(block.id);
        setIsTTSSelectedBlock(isInSelection);
        
        // 如果不在选择中，则也不是起始块
        if (!isInSelection) {
          setIsTTSStartBlock(false);
        }
      }
    };

    const handleResetTTSSelection = () => {
      setIsTTSStartBlock(false);
      setIsTTSSelectedBlock(false);
    };

    // 监听处理开始事件 - 改进逻辑
    const handleProcessingStart = (event: CustomEvent) => {
      // 使用传递的精确信息判断当前块是否在选择范围内
      const { selectedBlockIds, startBlockId, endBlockId, rangeBlocks } = event.detail || {};
      
      if (selectedBlockIds && Array.isArray(selectedBlockIds)) {
        // 检查当前块是否在选择范围内
        const isInRange = selectedBlockIds.includes(block.id);
        
        if (isInRange) {
          console.log(`🎯 语境块 ${block.id} 开始处理中动画`);
          setIsProcessingAlignment(true);
        } else {
          console.log(`⚪ 语境块 ${block.id} 不在处理范围内`);
          setIsProcessingAlignment(false);
        }
      } else {
        // 兼容旧的逻辑（如果没有传递详细信息）
        if (selectedRange) {
          const { startBlockId, endBlockId } = selectedRange;
          const isInRange = block.id === startBlockId || block.id === endBlockId;
          
          if (isInRange) {
            setIsProcessingAlignment(true);
          }
        }
      }
    };

    // 监听处理完成事件 - 在这里重置选择状态
    const handleProcessingComplete = () => {
      setIsProcessingAlignment(false);
      // 处理完成后才重置选择状态
      setIsSelectedAsStart(false);
      setIsSelectedAsEnd(false);
      setSelectedRange(null);
      console.log(`✅ 语境块 ${block.id} 处理完成，清除动画和选择状态`);
    };

    // 添加enable-tts-selection事件处理
    const handleStartTTSSelection = (event: CustomEvent) => {
      console.log('🎯 ContextBlocks收到enable-tts-selection事件', event.detail);
      setIsSelectionMode(true);
      setSelectionType('tts');
      setIsBlockSelectable(true);
      setIsTTSMode(true);
      setTtsStartBlock(null);
      setTtsSelectedBlocks([]);
      setIsSelectedAsStart(false);
      setIsSelectedAsEnd(false);
      setIsProcessingAlignment(false);
      setSelectedRange(null);
    };

    // 添加disable-tts-selection事件处理
    const handleDisableTTSSelection = () => {
      setIsSelectionMode(false);
      setSelectionType(null);
      setIsBlockSelectable(false);
      setIsTTSMode(false);
      setTtsStartBlock(null);
      setTtsSelectedBlocks([]);
      setIsTTSStartBlock(false);
      setIsTTSSelectedBlock(false);
    };

    window.addEventListener('enable-block-selection', handleEnableSelection as EventListener);
    window.addEventListener('disable-block-selection', handleDisableSelection as EventListener);
    window.addEventListener('selection-confirmed', handleSelectionConfirmed as EventListener);
    window.addEventListener('alignment-processing-start', handleProcessingStart as EventListener);
    window.addEventListener('alignment-processing-complete', handleProcessingComplete as EventListener);
    window.addEventListener('mark-start-block-selected', handleMarkStartBlockSelected as EventListener);
    window.addEventListener('mark-tts-block-selected', handleMarkTTSBlockSelected as EventListener);
    window.addEventListener('mark-tts-blocks-selected', handleMarkTTSBlocksSelected as EventListener);
    window.addEventListener('reset-tts-selection', handleResetTTSSelection as EventListener);
    window.addEventListener('enable-tts-selection', handleStartTTSSelection as EventListener);
    window.addEventListener('disable-tts-selection', handleDisableTTSSelection as EventListener);

    return () => {
      window.removeEventListener('enable-block-selection', handleEnableSelection as EventListener);
      window.removeEventListener('disable-block-selection', handleDisableSelection as EventListener);
      window.removeEventListener('selection-confirmed', handleSelectionConfirmed as EventListener);
      window.removeEventListener('alignment-processing-start', handleProcessingStart as EventListener);
      window.removeEventListener('alignment-processing-complete', handleProcessingComplete as EventListener);
      window.removeEventListener('mark-start-block-selected', handleMarkStartBlockSelected as EventListener);
      window.removeEventListener('mark-tts-block-selected', handleMarkTTSBlockSelected as EventListener);
      window.removeEventListener('mark-tts-blocks-selected', handleMarkTTSBlocksSelected as EventListener);
      window.removeEventListener('reset-tts-selection', handleResetTTSSelection as EventListener);
      window.removeEventListener('enable-tts-selection', handleStartTTSSelection as EventListener);
      window.removeEventListener('disable-tts-selection', handleDisableTTSSelection as EventListener);
    };
  }, [block.id, selectedRange]);

  // 处理语境块选择点击
  const handleBlockSelection = useCallback((e: React.MouseEvent) => {
    if (!isSelectionMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (selectionType === 'tts') {
      // TTS模式的选择逻辑 - 支持多选
      const isCurrentlySelected = ttsSelectedBlocks.includes(block.id);
      
      if (isCurrentlySelected) {
        // 如果已选中，则取消选择
        const newSelection = ttsSelectedBlocks.filter(id => id !== block.id);
        setTtsSelectedBlocks(newSelection);
        setIsTTSSelectedBlock(false);
        
        // 如果取消的是起始块，重新设置起始块
        if (block.id === ttsStartBlock && newSelection.length > 0) {
          setTtsStartBlock(newSelection[0]);
        } else if (newSelection.length === 0) {
          setTtsStartBlock(null);
        }
      } else {
        // 如果未选中，则添加到选择
        const newSelection = [...ttsSelectedBlocks, block.id];
        setTtsSelectedBlocks(newSelection);
        setIsTTSSelectedBlock(true);
        
        // 如果是第一个选择的块，设为起始块
        if (!ttsStartBlock) {
          setTtsStartBlock(block.id);
          setIsTTSStartBlock(true);
        }
      }
      
      // 收集所有选中块的内容
      const allBlocks = document.querySelectorAll('[data-block-id]');
      const selectedTexts: string[] = [];
      const selectedBlockIds: string[] = [];
      
      allBlocks.forEach((blockEl) => {
        const blockId = blockEl.getAttribute('data-block-id');
        if (blockId && (ttsSelectedBlocks.includes(blockId) || blockId === block.id)) {
          if (!isCurrentlySelected || blockId !== block.id) {
            selectedBlockIds.push(blockId);
            const contentEl = blockEl.querySelector('[data-block-content]');
            if (contentEl && contentEl.textContent) {
              selectedTexts.push(contentEl.textContent.trim());
            }
          }
        }
      });
      
      // 发送TTS选择事件
      window.dispatchEvent(new CustomEvent('tts-blocks-selected', {
        detail: {
          blockIds: selectedBlockIds,
          texts: selectedTexts
        }
      }));
      
      return;
    }
    
    // 原有的音频对齐选择逻辑
    // 发送选择事件
    window.dispatchEvent(new CustomEvent('context-block-selected', {
      detail: {
        blockId: block.id,
        blockContent: block.content
      }
    }));
    
    // 立即标记当前块为已选择
    if (selectionType === 'start') {
      setIsSelectedAsStart(true);
      setIsSelectedAsEnd(false);
    } else if (selectionType === 'end') {
      setIsSelectedAsEnd(true);
      setIsSelectedAsStart(false);
    }
    
    // 提供用户反馈
    if (selectionType !== 'tts') {
      toast.success(selectionType === 'start' ? '起始语境块已选择' : '结束语境块已选择');
    }
  }, [isSelectionMode, selectionType, block.id, block.content, ttsStartBlock]);

  // 修改handleClick函数，添加语境块选择逻辑
  const handleClick = (e: React.MouseEvent) => {
    // 如果是选择模式，处理选择逻辑
    if (isSelectionMode) {
      handleBlockSelection(e);
      return;
    }
    
    // 原有的点击逻辑
    if (isClicking.current) return;
    
    isClicking.current = true;
    setTimeout(() => {
      isClicking.current = false;
    }, 200);

    onSelect?.(block.id, e);
  };

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent) => {
    // 如果正在进行对齐处理，禁止拖拽
    if (isAlignmentProcessing) {
      console.log('🚫 对齐处理中，禁用拖拽功能');
      e.preventDefault();
      return;
    }

    // 如果正在对齐，禁止拖拽
    if (localAligning) {
      e.preventDefault();
      return;
    }
    
    // 如果检测到文本选择状态，阻止拖拽排序
    if (isTextSelecting) {
      e.preventDefault();
      return;
    }
    
    // 检查是否是文本选择导致的拖拽
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      // 如果有文本被选中，阻止拖拽排序
      e.preventDefault();
      return;
    }
    
    // 检查拖拽源是否是contentEditable区域
    const target = e.target as HTMLElement;
    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      // 如果拖拽源是可编辑区域，阻止拖拽排序
      e.preventDefault();
      return;
    }
    
    setIsDragging(true);
    
    // 设置两种数据格式，确保兼容性
    e.dataTransfer.setData('blockId', block.id);
    
    // 添加明确的类型标识，区分块排序拖拽和句子对齐拖拽
    try {
      const blockData = JSON.stringify({
        type: 'block',  // 明确标识这是块排序拖拽
        id: block.id
      });
      e.dataTransfer.setData('application/json', blockData);
    } catch (err) {
      console.error('无法设置拖拽数据', err);
    }
    
    e.dataTransfer.effectAllowed = 'move';
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    // 检查是否是句子对齐拖拽 - 使用types来检查
    if (e.dataTransfer.types.includes('sentence-align-drag')) {
      // 这是句子对齐拖拽，整个块高亮
      setIsDragOver(true);
      setDropPosition(null); // 不需要位置指示器
      return;
    }
    
    // 这是块排序拖拽，显示位置指示器
    const rect = e.currentTarget.getBoundingClientRect();
    const posY = e.clientY - rect.top;
    
    if (posY < rect.height / 2) {
      setDropPosition('before');
    } else {
      setDropPosition('after');
    }
  };

  // 离开拖拽区域
  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
    setDropPosition(null);
  };

  // 处理拖放
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPosition(null);
    
    // 尝试从两种格式获取数据
    try {
      // 首先尝试读取JSON数据
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
      
        // 检查类型标识 - 块排序
        if (data.type === 'block' && onOrderChange) {
          console.log('处理块排序拖拽:', data.id, block.id);
          const position = getDropPosition(e);
          onOrderChange(data.id, block.id, position);
          return;
        }
      
        // 检查类型标识 - 句子对齐（从SentencePlayer拖来的）
        if (data.type === 'sentence' && block.block_type === 'text') {
          console.log('处理句子对齐拖拽:', data);
          // 设置当前块为对齐中状态
          setLocalAligning(true);
          
          toast("正在进行文本对齐", { description: "请稍候，正在处理对齐..." });
          
          // 发送对齐开始事件（仅记录日志，不实际执行操作）
          console.log('ContextBlocks: 发送对齐开始事件');
          
          // 实际执行对齐操作
          let result;
          try {
            result = await TextAlignmentService.alignSentenceToBlock(
              block.id,
              data.sentenceId,
              data.speechId
            );
          } catch (error) {
            console.error('对齐操作失败:', error);
            // 发送失败事件，让SentencePlayer知道可以取消对齐状态
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId,
                blockId: block.id,
                status: 'failed',
                shouldSkipPageChange: true,
                alignedSentenceIds: [], // 对齐失败，没有句子被对齐
                isDragging: true // 这是拖拽引起的对齐
              }
            }));
            
            setLocalAligning(false);
            toast.error("对齐处理失败，请重试");
            return;
          }
          
          if (result.success) {
            // 对齐成功处理
            console.log('ContextBlocks: 对齐成功, 发送更新事件:', result);
            
            // 获取所有被对齐的句子ID
            const alignedSentenceIds = result.alignedSentences.map(s => s.sentenceId);
            console.log('ContextBlocks: 被对齐的句子IDs:', alignedSentenceIds);
            
            // 发送对齐更新事件，传递所有被对齐的句子ID
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId, // 主要拖拽的句子ID
                blockId: block.id,
                status: 'processing',
                shouldSkipPageChange: data.shouldSkipPageChange,
                alignedSentenceIds: alignedSentenceIds, // 所有被对齐的句子ID列表
                isDragging: true, // 这是拖拽引起的对齐
                targetPage: data.targetPage, // 传递目标页码
                isProcessing: true // 标记为处理中
              }
            }));
            
            // TextAlignmentService.alignSentenceToBlock方法已经使用await执行了三个步骤：
            // 1. 保存基础数据
            // 2. 执行单词级对齐
            // 3. 创建元数据关联
            console.log('ContextBlocks: TextAlignmentService处理已完成，等待数据库更新...');
            
            // 直接发送成功事件，不再使用轮询检查
            console.log('ContextBlocks: 发送对齐完成事件');
            window.dispatchEvent(new CustomEvent('sentence-alignment-complete', {
              detail: {
                sentenceId: data.sentenceId,
                blockId: block.id,
                status: 'success',
                shouldSkipPageChange: data.shouldSkipPageChange,
                alignedSentenceIds: alignedSentenceIds,
                targetPage: data.targetPage,
                isDragging: true // 这是拖拽引起的对齐
              }
            }));
            
            // 更新本地状态
            setLocalAligning(false);
            
            // 通知父组件对齐完成
            onAlignmentComplete?.(block.id);
            
            toast.success("文本对齐完成");
          } else {
            // 对齐失败处理
            console.error('ContextBlocks: 对齐失败:', result.message);
            
            // 发送失败事件，让SentencePlayer知道可以取消对齐状态
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId,
                blockId: block.id,
                status: 'failed',
                shouldSkipPageChange: true,
                alignedSentenceIds: [], // 对齐失败，没有句子被对齐
                isDragging: true // 这是拖拽引起的对齐
              }
            }));
            
            setLocalAligning(false);
            toast.error(result.message || "文本对齐处理失败");
          }
        }
      }
      // 尝试读取blockId格式
      const blockId = e.dataTransfer.getData('blockId');
      if (blockId && onOrderChange) {
        console.log('处理块排序拖拽(blockId):', blockId, block.id);
        const position = getDropPosition(e);
        onOrderChange(blockId, block.id, position);
      }
    } catch (error) {
      console.error('处理拖放操作失败:', error);
      setLocalAligning(false);
      toast.error("处理拖放操作时出错");
      
      // 捕获到异常时，也发送失败事件，确保SentencePlayer能恢复正常状态
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          const data = JSON.parse(jsonData);
          if (data.type === 'sentence') {
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId,
                status: 'failed',
                shouldSkipPageChange: true
              }
            }));
          }
        }
      } catch (err) {
        console.error('无法发送失败事件:', err);
      }
    }
  };

  // 简化单词播放函数
  const playWord = (word: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // 暂停所有正在播放的内容
    AudioController.pause();
    
    // 标记单词为活动状态
    setActiveWordId(word.id);
    
    // 播放单词
    AudioController.play({
      url: audioUrl || '',
      startTime: word.begin_time,
      endTime: word.end_time,
      onEnd: () => setActiveWordId(null)
    });
  };

  // 添加这个函数来处理单词点击，但保留所有现有功能
  const handleWordClick = useCallback((word: any, sentenceIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发句子点击
    isClicking.current = true;
    
    // 先找到句子
    const sentenceIds = getSentenceIdsFromContent();
    if (sentenceIndex >= 0 && sentenceIndex < sentenceIds.length) {
      const sentenceId = sentenceIds[sentenceIndex];
      const sentence = embeddedSentences.get(sentenceId);
      
      if (!sentence || !audioUrl) {
        console.error('无法播放单词：句子数据或音频URL缺失');
        return;
      }
      
      // 高亮当前句子
      setActiveIndex(sentenceIndex);
      
      // 高亮点击的单词
      setActiveWordId(word.id);
      
      // 获取单词时间戳
      const beginTime = word.begin_time;
      const endTime = word.end_time;
      
      if (beginTime === undefined || endTime === undefined) {
        console.error('单词缺少时间信息', word);
        return;
      }
      
      console.log(`播放单词 ${word.id}:`, beginTime, endTime);
      
      // 清除其他播放
      window.dispatchEvent(new CustomEvent(CLEAR_ACTIVE_SENTENCE_EVENT, {
        detail: { senderId: block.id }
      }));
      
      // 停止所有播放
      AudioController.stop();
      
      // 使用AudioController播放单词
      AudioController.play({
        url: audioUrl,
        startTime: beginTime,
        endTime: endTime,
        context: 'word',
        loop: false,
        speechId: blockSpeechId,
        onEnd: () => {
            // 单词播放结束后的操作
            setActiveWordId(null);
        }
      });
      
      // 更新父组件时间
      onTimeChange?.(beginTime);
      
      // 重置点击标志
      setTimeout(() => {
        isClicking.current = false;
      }, 100);
    }
  }, [audioUrl, block.id, block.id, embeddedSentences, getSentenceIdsFromContent, onTimeChange, blockSpeechId]);

  // 修改renderSentenceWithWords函数，区分单词高亮和句子高亮
  const renderSentenceWithWords = (sentence: any, sentenceIndex: number) => {
    // 检查句子文本内容的正确字段名
    const sentenceText = sentence.content || sentence.text_content;
    
    if (!sentenceText || !sentence.words || sentence.words.length === 0) {
      return <span>{sentenceText || sentence.content || '内容为空'}</span>;
    }

    // 按时间排序单词
    const sortedWords = [...sentence.words].sort((a, b) => a.begin_time - b.begin_time);
    
    const elements: React.ReactNode[] = [];
    let lastPosition = 0;
    const originalText = sentenceText;
    
    // 是否是当前活动句子
    const isActiveSentence = activeIndex === sentenceIndex;
    
    sortedWords.forEach((word, idx) => {
      // 检查单词内容的正确字段名
      const wordContent = word.content || word.word;
      if (!wordContent) {
        console.warn('单词内容为空:', word);
        return;
      }
      
      // 查找单词在原文中的位置
      const wordPosition = originalText.indexOf(wordContent, lastPosition);
      
      if (wordPosition >= 0) {
        // 添加单词前的文本（标点、空格等）
        if (wordPosition > lastPosition) {
          elements.push(
            <span key={`gap-${sentenceIndex}-${idx}`} className="text-muted-foreground">
              {originalText.substring(lastPosition, wordPosition)}
            </span>
          );
        }
        
        // 修改单词高亮逻辑
        const isWordActive = (word: any) => {
          // 如果是通过点击单词触发的高亮, 或者当前就是高亮
          if (activeWordId === word.id) {
            return true;
          }
 
          // 如果是通过句子播放触发的高亮
          return isActiveSentence &&
            currentAudioTime >= word.begin_time &&
            currentAudioTime < word.end_time;
        };
        
        // 只有在当前句子活动时才应用单词高亮
        const isWordActiveResult = isWordActive(word);
        
        // 修改添加单词的部分，使用金色粗边框和更快速度
        elements.push(
          <span 
            key={`word-${sentenceIndex}-${word.id}`}
            className="cursor-pointer px-0.5 relative"
            onClick={(e) => {
              handleWordClick(word, sentenceIndex, e);
            }}
          >
            {isWordActiveResult && (
              <motion.span
                className="absolute inset-0 rounded-sm word-highlight-flowing"
                layoutId="word-highlight-flowing"
              />
            )}
            <span className={isWordActiveResult ? "text-amber-500 font-medium relative z-10" : "hover:text-amber-400"}>
              {wordContent}
            </span>
          </span>
        );
        
        lastPosition = wordPosition + wordContent.length;
      }
    });
    
    // 添加最后一个单词后的剩余文本
    if (lastPosition < originalText.length) {
      elements.push(
        <span key={`final-gap-${sentenceIndex}`} className="text-muted-foreground">
          {originalText.substring(lastPosition)}
        </span>
      );
    }

    return <span>{elements}</span>;
  };

  // 添加getDropPosition函数实现
  const getDropPosition = (e: React.DragEvent): 'before' | 'after' => {
    const rect = e.currentTarget.getBoundingClientRect();
    const posY = e.clientY - rect.top;
    
    // 如果鼠标位置在元素上半部分，则放置在元素前面
    // 否则放置在元素后面
    return posY < rect.height / 2 ? 'before' : 'after';
  };

  // 添加渲染嵌入式内容的函数
  const renderEmbeddedContent = () => {
    // 确保始终返回一致的DOM结构，避免React DOM错误
    if (!block.content || block.content.trim() === '') {
      // 对于空内容，返回一个空的span，保持DOM结构一致但不影响光标
      return <span></span>;
    }
    
    // 如果没有嵌入式句子，直接返回内容
    if (!block.content.includes('[[')) {
      return <span>{block.content}</span>;
    }
    
    // 拆分内容并替换嵌入式句子
    const segments = [];
    let lastIndex = 0;
    let segmentIndex = 0;
    
    // 使用正则表达式找到所有嵌入式句子
    const pattern = /\[\[([a-f0-9-]+)\]\]/g;
    let match;
    
    while ((match = pattern.exec(block.content)) !== null) {
      // 添加句子前的文本
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${segmentIndex}`} className="text-muted-foreground">
            {block.content.substring(lastIndex, match.index)}
          </span>
        );
        segmentIndex++;
      }
      
      // 获取句子ID
      const sentenceId = match[1];
      const sentence = embeddedSentences.get(sentenceId);
      
      // 添加句子（如果已加载）
      if (sentence) {
        const sentenceIndex = segmentIndex;
        segments.push(
          <span 
            key={`sentence-${sentenceId}`}
            className={cn(
              "sentence-inline relative rounded-sm px-0.5 mx-0.5 transition-colors cursor-pointer",
              activeIndex === sentenceIndex 
                ? "text-emerald-500 font-medium"
                : "hover:bg-accent/10 group"
            )}
            onClick={(e) => {
              // 阻止事件冒泡，确保点击事件被正确处理
              e.stopPropagation();
              playSentence(sentence, sentenceIndex);
            }}
          >
            {/* 微型播放图标 */}
            <span className={cn(
              "inline-flex items-center justify-center w-3 h-3 mr-0.5 align-text-bottom rounded-full",
              activeIndex === sentenceIndex && isPlaying
                ? "bg-emerald-100" 
                : "bg-transparent group-hover:bg-accent/5"
            )}
            onClick={(e) => {
              // 为图标添加特定的点击处理
              e.stopPropagation();
              playSentence(sentence, sentenceIndex);
            }}
            >
              {activeIndex === sentenceIndex && isPlaying ? (
                <Pause className="w-2 h-2 text-emerald-600" />
              ) : (
                <Play className="w-2 h-2 text-muted-foreground opacity-50 group-hover:opacity-100" />
              )}
            </span>
            
            {renderSentenceWithWords(sentence, sentenceIndex)}
          </span>
        );
      } else {
        // 句子尚未加载时显示占位符
        segments.push(
          <span key={`loading-${sentenceId}`} className="px-1 text-muted-foreground italic">
            [加载中...]
          </span>
        );
      }
      
      segmentIndex++;
      lastIndex = match.index + match[0].length;
    }
    
    // 添加最后一段文本
    if (lastIndex < block.content.length) {
      segments.push(
        <span key={`text-final`} className="text-muted-foreground">
          {block.content.substring(lastIndex)}
        </span>
      );
    }
    
    return <span>{segments}</span>;
  };

  // 获取用于锚定词块的内容
  const getAnchorContent = useCallback(() => {
    // 如果是音频对齐块，使用 original_content；否则使用 content
    return block.block_type === 'audio_aligned' 
      ? (block.original_content || block.content)
      : block.content;
  }, [block.block_type, block.content, block.original_content]);

  // 处理锚定词块选词变化
  const handleAnchorWordsChange = useCallback((words: SelectedWord[]) => {
    onAnchorWordsChange?.(block.id, words);
  }, [block.id, onAnchorWordsChange]);

  // 进入锚定模式
  const handleEnterAnchorMode = useCallback(() => {
    onEnterAnchorMode?.();
  }, [onEnterAnchorMode]);

  // 退出锚定模式
  const handleExitAnchorMode = useCallback(() => {
    onExitAnchorMode?.();
  }, [onExitAnchorMode]);

  // 渲染含义块信息
  const renderMeaningBlocksInfo = () => {
    return null; // 不再显示含义块计数
  };

  // 添加中文句子分割算法
  const splitChineseIntoSentences = (text: string): string[] => {
    if (!text || !text.trim()) return []
    
    const sentences = []
    let currentSentence = ''
    let i = 0
    
    while (i < text.length) {
      const char = text[i]
      currentSentence += char
      
      // 检查是否是中文句子结束符（移除冒号）
      if (/[。！？；…]/.test(char)) {
        // 检查是否是省略号（多个连续的点或省略号符号）
        if (char === '…' || char === '。') {
          // 检查是否是多个连续的点或省略号
          let dotCount = 1
          let nextIndex = i + 1
          
          // 计算连续符号的数量
          while (nextIndex < text.length && /[。…]/.test(text[nextIndex])) {
            dotCount++
            nextIndex++
          }
          
          // 如果有多个连续符号，添加到当前句子
          if (dotCount > 1) {
            for (let j = i + 1; j < nextIndex; j++) {
              currentSentence += text[j]
            }
            i = nextIndex - 1
          }
        }
        
        // 检查后面是否有引号或括号需要包含
        let endIndex = i
        while (endIndex + 1 < text.length && /["'）】》"']/.test(text[endIndex + 1])) {
          endIndex++
          currentSentence += text[endIndex]
        }
        
        // 添加句子到结果中
        const trimmedSentence = currentSentence.trim()
        if (trimmedSentence.length > 0) {
          sentences.push(trimmedSentence)
        }
        
        currentSentence = ''
        i = endIndex
      }
      
      i++
    }
    
    // 添加最后一个句子（如果有）
    const finalSentence = currentSentence.trim()
    if (finalSentence.length > 0) {
      sentences.push(finalSentence)
    }
    
    return sentences.filter(s => s.length > 0)
  }

  // 渲染带句子高亮的翻译内容
  const renderTranslationWithHighlight = (translationContent: string) => {
    // 分割中文翻译为句子
    const translationSentences = splitChineseIntoSentences(translationContent)
    
    // 如果只有一个句子或没有句子，直接显示
    if (translationSentences.length <= 1) {
      return (
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {translationContent}
        </div>
      )
    }
    
    // 计算当前应该高亮的翻译句子索引
    const getHighlightedTranslationIndex = () => {
      if (!sentences || sentences.length === 0 || translationSentences.length === 0 || activeIndex === null) {
        return -1
      }
      
      // 简单的比例映射：英文句子索引 -> 中文句子索引
      const ratio = translationSentences.length / sentences.length
      const translationIndex = Math.floor(activeIndex * ratio)
      
      return Math.min(translationIndex, translationSentences.length - 1)
    }
    
    const highlightedIndex = getHighlightedTranslationIndex()
    
    // 调试信息
    if (activeIndex !== null && activeIndex >= 0) {
      console.log(`[翻译高亮] 英文句子索引: ${activeIndex}, 中文句子索引: ${highlightedIndex}, 英文句子数: ${sentences?.length || 0}, 中文句子数: ${translationSentences.length}`)
    }
    
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {translationSentences.map((sentence, index) => (
          <span
            key={index}
            className={cn(
              "transition-all duration-300",
              index === highlightedIndex && activeIndex !== null && activeIndex >= 0
                ? "bg-green-200/60 dark:bg-green-800/40 text-green-900 dark:text-green-100 font-medium rounded-sm px-1 py-0.5"
                : ""
            )}
          >
            {sentence}
            {index < translationSentences.length - 1 && ' '}
          </span>
        ))}
      </div>
    )
  }

  // 修改renderContent函数，添加含义块信息显示
  const renderContent = () => {
    // 如果处于锚定模式，渲染锚定词块
    if (isInAnchorMode) {
      return (
        <AnchorWordBlock
          content={getAnchorContent()}
          blockId={block.id}
          onSelectedWordsChange={handleAnchorWordsChange}
          onExit={handleExitAnchorMode}
          initialSelectedWords={anchorSelectedWords}
          existingMeaningBlocks={meaningBlocks}
        />
      );
    }

    // 图片语境块
    if (block.block_type === 'image' && resources) {
      const imgPath = block.content.replace('![', '').replace(/\]\(.+\)/, '');
      const resource = resources.find(r => r.original_path.includes(imgPath) || r.oss_path.includes(imgPath));
      
      if (resource) {
        return (
          <div className="relative max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resource.oss_path}
              alt={`图片${block.id}`}
              className="max-w-full h-auto rounded-md"
            />
            {/* 我们使用img标签而不是Image组件是为了确保图片质量不受影响 */}
            
            {/* 渲染含义块信息 */}
            {renderMeaningBlocksInfo()}
          </div>
        );
      }
      
      return <div className="text-sm text-muted-foreground">图片未找到: {imgPath}</div>;
    }
    
    // 音频对齐块 - 增加显示alignment数据的选项
    if (block.block_type === 'audio_aligned') {
      return (
        <div className="audio-aligned-block relative">
          {/* 主要内容 - 减少内部缩进 */}
          <div className="py-2 px-3 text-sm leading-relaxed">
          <div className="prose prose-sm max-w-none" data-block-content="true">
            {isLoadingSentences ? (
              <span className="text-muted-foreground">加载句子内容中...</span>
              ) : meaningBlocks.length > 0 ? (
                // 使用AudioAnchorRenderer融合音频点读和锚点高亮
                <AudioAnchorRenderer
                  content={block.content}
                  meaningBlocks={meaningBlocks}
                  embeddedSentences={embeddedSentences}
                  activeIndex={activeIndex}
                  activeWordId={activeWordId}
                  currentAudioTime={currentAudioTime}
                  isPlaying={isPlaying}
                  onSentenceClick={handleSentenceClick}
                  onWordClick={handleWordClick}
                />
            ) : (
                // 没有锚点时使用原来的渲染方式
              renderEmbeddedContent()
            )}
            </div>
          </div>
          
          {/* 渲染含义块信息 */}
          {renderMeaningBlocksInfo()}
          
          {/* 底部功能图标栏 - 放在语境块外部但靠近底部 */}
          <div className="absolute right-1 bottom-1 flex gap-1">
            {/* 对齐记录图标 */}
            <button
              onClick={() => onShowSplitView?.(block.id, 'source')}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="对齐记录"
            >
              <FileEdit className="h-3 w-3" />
            </button>
            
            {/* 翻译图标 */}
            <button
              onClick={() => handleShowTranslation()}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="翻译"
            >
              <Globe className="h-3 w-3" />
            </button>
            
            {/* 词锚点图标 - 新增 */}
            <button
              onClick={handleEnterAnchorMode}
              className="p-0.5 rounded-full bg-background/80 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all"
              title="词锚点"
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }
    
    // 包含嵌入式句子的文本块 - 使用相同的渲染方式
    if (block.block_type === 'text' && block.content && block.content.includes('[[')) {
      return (
        <div className="embedded-sentences-block relative py-2 px-3 text-sm leading-relaxed">
          <div className="prose prose-sm max-w-none" data-block-content="true">
            {isLoadingSentences ? (
              <span className="text-muted-foreground">加载句子内容中...</span>
            ) : meaningBlocks.length > 0 ? (
              // 使用AudioAnchorRenderer融合音频点读和锚点高亮
              <AudioAnchorRenderer
                content={block.content}
                meaningBlocks={meaningBlocks}
                embeddedSentences={embeddedSentences}
                activeIndex={activeIndex}
                activeWordId={activeWordId}
                currentAudioTime={currentAudioTime}
                isPlaying={isPlaying}
                onSentenceClick={handleSentenceClick}
                onWordClick={handleWordClick}
              />
            ) : (
              // 没有锚点时使用原来的渲染方式
              renderEmbeddedContent()
            )}
          </div>
          
          {/* 渲染含义块信息 */}
          {renderMeaningBlocksInfo()}
          
          {/* 为包含嵌入式句子的文本块添加功能按钮 */}
          <div className="absolute right-1 bottom-1 flex gap-1">
            {/* 翻译图标 */}
            <button
              onClick={() => handleShowTranslation()}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="翻译"
            >
              <Globe className="h-3 w-3" />
            </button>
            
            <button
              onClick={handleEnterAnchorMode}
              className="p-0.5 rounded-full bg-background/80 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all"
              title="词锚点"
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }
    
    // 普通文本块 - 直接可编辑
    return (
      <div className="relative">
        {/* 如果有含义块数据，使用锚点高亮渲染器 */}
        {meaningBlocks.length > 0 ? (
          <AnchorHighlightRenderer
            content={block.content}
            meaningBlocks={meaningBlocks}
            className={cn(
              "py-2 px-3",
              // 为不同标题级别设置字体大小和加粗
              block.block_type === 'heading_1' && "text-2xl font-bold",
              block.block_type === 'heading_2' && "text-xl font-bold", 
              block.block_type === 'heading_3' && "text-lg font-bold",
              block.block_type === 'heading_4' && "text-base font-bold",
              block.block_type === 'text' && "text-sm"
            )}
          />
        ) : (
          <div className="relative">
            <div
              ref={contentEditableRef}
              data-block-content="true"
              contentEditable={block.block_type === 'text' || block.block_type.startsWith('heading_')}
              suppressContentEditableWarning
              className={cn(
                "outline-none whitespace-pre-wrap py-2 px-3 min-h-[2rem] relative",
                // 为不同标题级别设置字体大小和加粗
                block.block_type === 'heading_1' && "text-2xl font-bold leading-tight",
                block.block_type === 'heading_2' && "text-xl font-bold leading-tight", 
                block.block_type === 'heading_3' && "text-lg font-bold leading-snug",
                block.block_type === 'heading_4' && "text-base font-bold leading-snug",
                block.block_type === 'text' && "text-sm"
              )}
              onBlur={handleBlur}
              onFocus={handleFocus}
              onInput={handleInput}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                console.log('🎹 按键事件:', {
                  key: e.key,
                  shiftKey: e.shiftKey,
                  blockId: block.id,
                  blockType: block.block_type,
                  hasContentEditableRef: !!contentEditableRef.current,
                  meaningBlocksLength: meaningBlocks.length,
                  isInAnchorMode,
                  contentIncludes: block.content?.includes('[[')
                });
                
                // 按Enter但不按Shift创建新块
                if (e.key === 'Enter' && !e.shiftKey) {
                  console.log('🎹 Enter键处理 - 创建新块');
                  e.preventDefault();
                  handleCreateNewBlock();
                }
                // 按Backspace且光标在开头时合并与上一个块
                if (e.key === 'Backspace') {
                  console.log('🎹 Backspace键处理 - 检查光标位置');
                  const cursorAtStart = isCursorAtStart();
                  console.log('🎹 光标是否在开头:', cursorAtStart);
                  
                  if (cursorAtStart) {
                    console.log('🎹 Backspace键处理 - 光标在开头，执行合并');
                    e.preventDefault();
                    handleMergeWithPreviousBlock();
                  } else {
                    console.log('🎹 Backspace键处理 - 光标不在开头，允许默认行为');
                  }
                }
                // 按Delete且光标在末尾时合并到下一个块
                if (e.key === 'Delete') {
                  console.log('🎹 Delete键处理 - 检查光标位置');
                  const cursorAtEnd = isCursorAtEnd();
                  console.log('🎹 光标是否在末尾:', cursorAtEnd);
                  
                  if (cursorAtEnd) {
                    console.log('🎹 Delete键处理 - 光标在末尾，执行合并到下一块');
                    e.preventDefault();
                    handleMergeWithNextBlock();
                  } else {
                    console.log('🎹 Delete键处理 - 光标不在末尾，允许默认行为');
                  }
                }
              }}
            />
            
            {/* 占位符提示 - 悬浮时显示，获得焦点时隐藏 */}
            {isHovered && !isFocused && !block.content?.trim() && (
              <div className={cn(
                "absolute inset-0 py-2 px-3 pointer-events-none text-muted-foreground/40 flex items-start",
                // 为不同标题级别设置相同的字体大小和加粗
                block.block_type === 'heading_1' && "text-2xl font-bold leading-tight",
                block.block_type === 'heading_2' && "text-xl font-bold leading-tight", 
                block.block_type === 'heading_3' && "text-lg font-bold leading-snug",
                block.block_type === 'heading_4' && "text-base font-bold leading-snug",
                block.block_type === 'text' && "text-sm"
              )}>
                {block.block_type === 'text' && '空语境块，点击输入内容'}
                {block.block_type === 'heading_1' && '一级标题'}
                {block.block_type === 'heading_2' && '二级标题'}
                {block.block_type === 'heading_3' && '三级标题'}
                {block.block_type === 'heading_4' && '四级标题'}
              </div>
            )}
            
            {/* 占位符提示 - 只在焦点状态且内容为空时显示 */}
            {isFocused && !block.content?.trim() && (
              <div className={cn(
                "absolute inset-0 py-2 px-3 pointer-events-none text-muted-foreground/50",
                // 为不同标题级别设置相同的字体大小和加粗
                block.block_type === 'heading_1' && "text-2xl font-bold leading-tight",
                block.block_type === 'heading_2' && "text-xl font-bold leading-tight", 
                block.block_type === 'heading_3' && "text-lg font-bold leading-snug",
                block.block_type === 'heading_4' && "text-base font-bold leading-snug",
                block.block_type === 'text' && "text-sm"
              )}>
                {block.block_type === 'text' && '空语境块，请输入内容'}
                {block.block_type === 'heading_1' && '请输入一级标题'}
                {block.block_type === 'heading_2' && '请输入二级标题'}
                {block.block_type === 'heading_3' && '请输入三级标题'}
                {block.block_type === 'heading_4' && '请输入四级标题'}
              </div>
            )}
          </div>
        )}
        
        {/* 渲染含义块信息 */}
        {renderMeaningBlocksInfo()}
        
        {/* 为普通文本块和标题块添加功能按钮 */}
        {(block.block_type === 'text' || block.block_type.startsWith('heading_')) && block.content && (
          <div className="absolute right-1 bottom-1 flex gap-1">
            {/* 翻译图标 */}
            <button
              onClick={() => handleShowTranslation()}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all opacity-0 group-hover:opacity-100 transition-opacity"
              title="翻译"
            >
              <Globe className="h-3 w-3" />
            </button>
            
            <button
              onClick={handleEnterAnchorMode}
              className="p-0.5 rounded-full bg-background/80 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100 transition-opacity"
              title="词锚点"
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // 在ContextBlocks中添加对全局循环模式的响应
  useEffect(() => {
    // 监听全局循环模式变更
    const handleLoopModeChange = (e: CustomEvent) => {
      const { mode } = e.detail;
      if (mode && ['sentence', 'block', 'continuous'].includes(mode)) {
        // 更新本地循环模式
        // 注意：这里假设你的组件有一个prop或state来存储playMode
        if (onPlayModeChange) {
          onPlayModeChange(mode);
        }
      }
    };
    
    window.addEventListener('global-loop-mode-change', handleLoopModeChange as EventListener);
    
    return () => {
      window.removeEventListener('global-loop-mode-change', handleLoopModeChange as EventListener);
    };
  }, [onPlayModeChange]);

  // 修改句子点击处理函数
  const handleSentenceClick = useCallback((sentence: any, sentenceIndex: number) => {
    isClicking.current = true;
    
    // 播放句子
    playSentence(sentence, sentenceIndex);
    
    // 点击后重置标志
    setTimeout(() => {
      isClicking.current = false;
    }, 100);
  }, [playSentence]);

  // 恢复关键的事件处理函数，这是我之前删除的
  // 处理句子播放事件
  useEffect(() => {
    const handlePlayBlockSentence = (e: CustomEvent) => {
      const { blockId, sentenceIndex } = e.detail;
      
      if (blockId === block.id) {
        console.log(`接收到播放事件: 块=${blockId}, 句子索引=${sentenceIndex}`);
        
        // 如果没有加载句子数据，需要先加载
        if (embeddedSentences.size === 0) {
          parseAndLoadEmbeddedSentences().then(() => {
            triggerPlaySentence(sentenceIndex);
          });
        } else {
          triggerPlaySentence(sentenceIndex);
        }
      }
    };
    
    // 直接播放指定索引的句子
    const triggerPlaySentence = (sentenceIndex: number) => {
      // 从content中提取所有句子ID
      const sentenceIds: string[] = [];
      const pattern = /\[\[([a-f0-9-]+)\]\]/g;
      let match;
      while ((match = pattern.exec(block.content || '')) !== null) {
        sentenceIds.push(match[1]);
      }
      
      // 确保索引有效
      if (sentenceIndex >= 0 && sentenceIndex < sentenceIds.length) {
        const sentenceId = sentenceIds[sentenceIndex];
        const sentence = embeddedSentences.get(sentenceId);
        
        if (sentence) {
          // 实际开始播放
          console.log(`开始播放句子: ${sentenceId}, 索引: ${sentenceIndex}`);
          playSentence(sentence, sentenceIndex);
        } else {
          console.error(`句子数据未找到: ${sentenceId}`);
        }
      }
    };
    
    window.addEventListener(
      'play-block-sentence', 
      handlePlayBlockSentence as EventListener
    );
    
    return () => {
      window.removeEventListener(
        'play-block-sentence', 
        handlePlayBlockSentence as EventListener
      );
    };
  }, [block.id, block.content, embeddedSentences, parseAndLoadEmbeddedSentences, playSentence]);

  // 使用 isBlockActive 来区分 prop 中的 isSelected
  const isBlockActive = activeBlockId === block.id;

  // 在组件顶部添加事件监听
  useEffect(() => {
    const handleAudioSwitch = (e: CustomEvent) => {
      toast("检测到不同音频，停顿跳转中", {
        duration: 2000,  // 显示2秒
        className: "bg-primary/10",  // 可选：自定义样式
      });
    };

    window.addEventListener('audio-switch-start', handleAudioSwitch as EventListener);
    
    return () => {
      window.removeEventListener('audio-switch-start', handleAudioSwitch as EventListener);
    };
  }, []);

  // 修改播放模式变化的useEffect
  useEffect(() => {
    if (!audioUrl || activeIndex === null) return;
    
    console.log('[ContextBlocks] 播放模式变化', {
      playMode,
      activeIndex,
      audioUrl
    });
    
    // 获取当前句子的时间范围
    const sentenceIds = getSentenceIdsFromContent();
    if (activeIndex >= 0 && activeIndex < sentenceIds.length) {
      const sentenceId = sentenceIds[activeIndex];
      const sentence = embeddedSentences.get(sentenceId);
      
      if (sentence) {
        console.log('[ContextBlocks] 当前活动句子', {
          sentenceId,
          beginTime: sentence.begin_time,
          endTime: sentence.end_time
        });
        
        // 根据播放模式设置循环
        switch (playMode) {
          case 'sentence':
            console.log('[ContextBlocks] 切换到句子循环模式');
            AudioController.setPlayMode('sentence', sentence.begin_time, sentence.end_time);
            break;
          
          case 'block':
            // 语境块循环 - 使用整个块的时间范围
            const firstSentence = embeddedSentences.get(sentenceIds[0]);
            const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
            
            if (firstSentence && lastSentence) {
              console.log('[ContextBlocks] 切换到块循环模式', {
                blockStart: firstSentence.begin_time,
                blockEnd: lastSentence.end_time
              });
              AudioController.setPlayMode('block', firstSentence.begin_time, lastSentence.end_time);
            }
            break;
        }
      }
    }
  }, [playMode, activeIndex, audioUrl, embeddedSentences, getSentenceIdsFromContent]);

  // 添加对循环事件的监听
  useEffect(() => {
    const handleAudioLoop = (e: CustomEvent) => {
      const { startTime, endTime, mode } = e.detail;
      
      console.log('[ContextBlocks] 收到循环事件', {
        startTime,
        endTime,
        mode,
        blockId: block.id
      });
      
      // 检查是否是当前块的循环
      const sentenceIds = getSentenceIdsFromContent();
      const firstSentence = embeddedSentences.get(sentenceIds[0]);
      const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
      
      if (firstSentence && lastSentence) {
        const blockStart = firstSentence.begin_time;
        const blockEnd = lastSentence.end_time;
        
        console.log('[ContextBlocks] 检查循环范围', {
          blockStart,
          blockEnd,
          loopStart: startTime,
          loopEnd: endTime
        });
        
        // 如果循环范围在当前块内，更新状态
        if (startTime >= blockStart && endTime <= blockEnd) {
          // 找到对应的句子索引
          for (let i = 0; i < sentenceIds.length; i++) {
            const sentence = embeddedSentences.get(sentenceIds[i]);
            if (sentence && sentence.begin_time === startTime) {
              console.log('[ContextBlocks] 找到循环句子', {
                index: i,
                sentenceId: sentenceIds[i]
              });
              setActiveIndex(i);
              setIsPlaying(true);
              break;
            }
          }
        }
      }
    };
    
    window.addEventListener('audio-loop', handleAudioLoop as EventListener);
    
    return () => {
      window.removeEventListener('audio-loop', handleAudioLoop as EventListener);
    };
  }, [getSentenceIdsFromContent, embeddedSentences, block.id]);

  // 添加对模式变更事件的监听
  useEffect(() => {
    const handleAudioModeChange = (e: CustomEvent) => {
      const { mode, currentTime, endTime } = e.detail;
      
      // 检查是否是当前块的模式变更
      const sentenceIds = getSentenceIdsFromContent();
      const firstSentence = embeddedSentences.get(sentenceIds[0]);
      const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
      
      if (firstSentence && lastSentence) {
        const blockStart = firstSentence.begin_time;
        const blockEnd = lastSentence.end_time;
        
        // 如果时间范围在当前块内，更新状态
        if (currentTime >= blockStart && currentTime <= blockEnd) {
          // 找到对应的句子索引
          for (let i = 0; i < sentenceIds.length; i++) {
            const sentence = embeddedSentences.get(sentenceIds[i]);
            if (sentence && 
                currentTime >= sentence.begin_time && 
                currentTime <= sentence.end_time) {
              setActiveIndex(i);
              setIsPlaying(true);
              break;
            }
          }
        }
      }
    };
    
    window.addEventListener('audio-mode-change', handleAudioModeChange as EventListener);
    
    return () => {
      window.removeEventListener('audio-mode-change', handleAudioModeChange as EventListener);
    };
  }, [getSentenceIdsFromContent, embeddedSentences]);

  // 添加ContextBlocks组件的useEffect来处理单词对齐完成事件
  useEffect(() => {
    // 监听words-alignment-complete事件，刷新单词数据
    const handleWordsAlignmentComplete = (e: CustomEvent) => {
      const detail = e.detail as { 
        sentenceIds?: string[],
        speechId?: string,
        blockId?: string
      };
      
      // 检查是否是针对当前块的事件
      if (detail.blockId === block.id) {
        console.log('ContextBlocks: 收到单词对齐完成事件，刷新单词数据', detail);
        
        // 重新加载涉及到的句子数据
        if (detail.sentenceIds && detail.sentenceIds.length > 0) {
          parseAndLoadEmbeddedSentences();
        }
      }
    };
    
    window.addEventListener('words-alignment-complete', handleWordsAlignmentComplete as EventListener);
    
    return () => {
      window.removeEventListener('words-alignment-complete', handleWordsAlignmentComplete as EventListener);
    };
  }, [block.id, parseAndLoadEmbeddedSentences]);

  // 监听是否需要聚焦到当前块
  useEffect(() => {
    const handleFocusBlock = (e: CustomEvent) => {
      const { blockId, cursorPosition } = e.detail;
      if (blockId === block.id && contentEditableRef.current && block.block_type === 'text') {
        // 延迟聚焦，确保DOM已经更新
        setTimeout(() => {
          if (contentEditableRef.current) {
            contentEditableRef.current.focus();
            
            // 检查是否是空块
            const currentContent = block.content || '';
            const isEmpty = !currentContent.trim();
            
            console.log('🎯 聚焦块信息:', {
              blockId,
              cursorPosition,
              isEmpty,
              contentLength: currentContent.length,
              innerHTML: contentEditableRef.current.innerHTML
            });
            
            if (isEmpty) {
              // 空块使用简单的光标设置方法
              try {
                const selection = window.getSelection();
                if (selection) {
                  selection.removeAllRanges();
                  const range = document.createRange();
                  
                  // 直接设置到contentEditable元素内部
                  range.setStart(contentEditableRef.current, 0);
                  range.setEnd(contentEditableRef.current, 0);
                  selection.addRange(range);
                  
                  console.log('🎯 空块光标设置成功');
                }
              } catch (error) {
                console.error('🎯 空块光标设置失败:', error);
              }
              return;
            }
            
            // 非空块的光标设置
            const range = document.createRange();
            const selection = window.getSelection();
            
            if (selection) {
              // 使用 TreeWalker 找到第一个文本节点
              const walker = document.createTreeWalker(
                contentEditableRef.current,
                NodeFilter.SHOW_TEXT,
                null
              );
              
              const firstTextNode = walker.nextNode();
              
              if (firstTextNode && firstTextNode.textContent !== null) {
                const textContent = firstTextNode.textContent || '';
                
                // 如果指定了光标位置，设置到指定位置；否则设置到开头
                // 确保位置不超过文本长度
                const position = typeof cursorPosition === 'number' 
                  ? Math.min(Math.max(0, cursorPosition), textContent.length) 
                  : 0;
                
                console.log('🎯 准备设置光标:', {
                  requestedPosition: cursorPosition,
                  actualPosition: position,
                  textLength: textContent.length
                });
                
                try {
                  range.setStart(firstTextNode, position);
                  range.setEnd(firstTextNode, position);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  
                  console.log(`🎯 设置光标位置成功: ${position}`);
                } catch (error) {
                  console.error('🎯 设置光标位置失败:', error);
                  
                  // 备用方案：设置到文本末尾
                  try {
                    range.setStart(firstTextNode, textContent.length);
                    range.setEnd(firstTextNode, textContent.length);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    console.log(`🎯 备用方案：设置光标到文本末尾`);
                  } catch (fallbackError) {
                    console.error('🎯 备用方案也失败:', fallbackError);
                  }
                }
              } else {
                console.warn('🎯 未找到有效的文本节点，使用简单方法');
                
                // 备用方法：直接设置到contentEditable元素
                try {
                  const element = contentEditableRef.current;
                  selection.removeAllRanges();
                  const range = document.createRange();
                  range.setStart(element, 0);
                  range.setEnd(element, 0);
                  selection.addRange(range);
                  console.log('🎯 使用简单方法设置光标成功');
                } catch (fallbackError) {
                  console.error('🎯 简单方法也失败:', fallbackError);
                }
              }
            }
          }
        }, 150);
      }
    };

    // 监听强制更新块内容事件
    const handleForceUpdateContent = (e: CustomEvent) => {
      const { blockId, content } = e.detail;
      if (blockId === block.id && contentEditableRef.current && block.block_type === 'text') {
        console.log('🔄 强制更新块内容:', {
          blockId,
          newContent: content.substring(0, 50) + '...',
          currentContent: (contentEditableRef.current.textContent || '').substring(0, 50) + '...'
        });
        
        // 立即更新DOM内容
        contentEditableRef.current.textContent = content;
      }
    };

    window.addEventListener('focus-block', handleFocusBlock as EventListener);
    window.addEventListener('force-update-block-content', handleForceUpdateContent as EventListener);
    
    return () => {
      window.removeEventListener('focus-block', handleFocusBlock as EventListener);
      window.removeEventListener('force-update-block-content', handleForceUpdateContent as EventListener);
    };
  }, [block.id, block.block_type]);

  // 添加合并块的处理函数
  const handleMergeWithPreviousBlock = useCallback(async () => {
    console.log('🔄 尝试合并块 - 开始检查条件');
    
    if (!contentEditableRef.current || block.block_type !== 'text') {
      console.log('❌ 合并块失败：不是文本块或 contentEditableRef 不存在', {
        hasRef: !!contentEditableRef.current,
        blockType: block.block_type
      });
      return;
    }
    
    // 检查当前块是否是临时块
    const isTemporaryBlock = block.id.startsWith('temp-');
    if (isTemporaryBlock) {
      console.log('⚠️ 当前块是临时块，暂时无法合并，请稍后再试');
      toast.warning('新块正在创建中，请稍后再试合并');
      return;
    }
    
    try {
      // 检查是否有父级ID和排序信息
      const parentId = block.parent_id;
      const currentOrderIndex = block.order_index;
      
      console.log('🔄 合并块 - 当前块信息:', {
        blockId: block.id,
        parentId,
        currentOrderIndex,
        blockType: block.block_type,
        contentPreview: (block.content || '').substring(0, 30) + '...'
      });
      
      if (!parentId || currentOrderIndex === undefined) {
        console.warn('❌ 无法合并块：缺少父级ID或排序信息', {
          hasParentId: !!parentId,
          hasOrderIndex: currentOrderIndex !== undefined,
          parentId,
          currentOrderIndex
        });
        return;
      }
      
      // 查找上一个可合并的文本块
      console.log('🔍 开始查找上一个文本块...');
      const previousBlock = await ContextBlocksService.getPreviousTextBlock(
        block.id,
        parentId,
        currentOrderIndex
      );
      
      console.log('🔍 查找上一个文本块结果:', {
        found: !!previousBlock,
        previousBlock: previousBlock ? {
          id: previousBlock.id,
          order_index: previousBlock.order_index,
          contentPreview: (previousBlock.content || '').substring(0, 30) + '...'
        } : null
      });
      
      if (!previousBlock) {
        console.log('❌ 没有找到可合并的上一个文本块');
        return;
      }
      
      console.log('🔄 准备合并块:', {
        current: { id: block.id, content: block.content?.substring(0, 30) + '...' },
        target: { id: previousBlock.id, content: previousBlock.content?.substring(0, 30) + '...' }
      });
      
      // === 第一步：立即更新UI，提供即时反馈 ===
      const currentContent = block.content || '';
      const targetContent = previousBlock.content || '';
      const mergedContent = targetContent + currentContent;
      const cursorPosition = targetContent.length;
      
      // 立即通知父组件更新目标块内容
      onBlockUpdate?.(previousBlock.id, 'text', mergedContent);
      
      // 强制更新目标块的DOM内容（因为目标块可能不会立即同步）
      // 通过自定义事件通知目标块立即更新其DOM
      window.dispatchEvent(new CustomEvent('force-update-block-content', {
        detail: { 
          blockId: previousBlock.id,
          content: mergedContent
        }
      }));
      
      // 立即通知父组件删除当前块
      window.dispatchEvent(new CustomEvent('remove-temp-block', {
        detail: { tempId: block.id }
      }));
      
      // 立即聚焦到目标块并设置光标位置
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('focus-block', {
          detail: { 
            blockId: previousBlock.id,
            cursorPosition: cursorPosition
          }
        }));
      }, 50);
      
      // 显示成功提示（乐观）
      toast.success('正在合并文本块...');
      
      // === 第二步：后台验证数据库操作 ===
      console.log('📡 后台验证数据库合并操作');
      
      const result = await ContextBlocksService.mergeBlocks(
        block.id,
        previousBlock.id,
        currentContent,
        targetContent
      );
      
      if (result.success) {
        console.log('✅ 数据库合并成功:', result);
        toast.success('文本块合并成功');
        
        // 数据库操作成功，UI已经更新，不需要再次触发事件
        
      } else {
        console.error('❌ 数据库合并失败:', result);
        
        // === 第三步：如果数据库操作失败，回滚UI更改 ===
        console.log('🔄 回滚UI更改');
        
        // 1. 恢复目标块原内容
        onBlockUpdate?.(previousBlock.id, 'text', targetContent);
        
        // 强制恢复目标块的DOM内容
        window.dispatchEvent(new CustomEvent('force-update-block-content', {
          detail: { 
            blockId: previousBlock.id,
            content: targetContent
          }
        }));
        
        // 2. 恢复当前块（重新添加）
        window.dispatchEvent(new CustomEvent('create-temp-block', {
          detail: { 
            tempId: block.id,
            content: currentContent,
            orderIndex: currentOrderIndex,
            parentId: parentId,
            afterBlockId: previousBlock.id
          }
        }));
        
        // 3. 聚焦回当前块
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('focus-block', {
            detail: { blockId: block.id }
          }));
        }, 100);
        
        // 4. 显示错误提示
        toast.error(`合并块失败: ${result.error || '未知错误'}`);
      }
      
    } catch (error) {
      console.error('💥 合并块异常:', error);
      toast.error('合并块时发生错误');
    }
  }, [block.id, block.block_type, block.parent_id, block.order_index, block.content, onBlockUpdate]);

  // 检查光标是否在内容开头
  const isCursorAtStart = useCallback(() => {
    if (!contentEditableRef.current) {
      console.log('🔍 光标检测：contentEditableRef 不存在');
      return false;
    }
    
    const element = contentEditableRef.current;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      console.log('🔍 光标检测：没有选择范围');
      return false;
    }
    
    const range = selection.getRangeAt(0);
    
    // 检查是否是折叠的选择（光标而不是选择区域）
    if (!range.collapsed) {
      console.log('🔍 光标检测：存在选择区域，不是单纯的光标');
      return false;
    }
    
    // 更准确的光标位置检测
    const isAtStart = range.startOffset === 0 && range.endOffset === 0;
    
    // 检查是否在第一个文本节点或者元素的开头
    const container = range.startContainer;
    
    // 改进的第一个节点检测逻辑
    let isInFirstNode = false;
    
    if (container === element) {
      // 光标直接在编辑元素中
      isInFirstNode = true;
    } else if (container.nodeType === Node.TEXT_NODE) {
      // 光标在文本节点中，需要检查这个文本节点是否是编辑元素中的第一个文本节点
      // 使用 TreeWalker 找到第一个文本节点
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      const firstTextNode = walker.nextNode();
      isInFirstNode = container === firstTextNode;
      
      console.log('🔍 文本节点检测:', {
        containerText: container.textContent?.substring(0, 20) + '...',
        firstTextNodeText: firstTextNode?.textContent?.substring(0, 20) + '...',
        isSameNode: container === firstTextNode
      });
    }
    
    const result = isAtStart && isInFirstNode;
    
    console.log('🔍 光标检测结果:', {
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      collapsed: range.collapsed,
      isAtStart,
      isInFirstNode,
      containerType: container.nodeType,
      containerNodeName: container.nodeName,
      isTextNode: container.nodeType === Node.TEXT_NODE,
      elementTextContent: element.textContent,
      elementInnerHTML: element.innerHTML,
      firstChildType: element.firstChild?.nodeType,
      firstChildContent: element.firstChild?.textContent,
      result
    });
    
    return result;
  }, []);

  // 检查光标是否在内容末尾
  const isCursorAtEnd = useCallback(() => {
    if (!contentEditableRef.current) {
      console.log('🔍 光标末尾检测：contentEditableRef 不存在');
      return false;
    }
    
    const element = contentEditableRef.current;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      console.log('🔍 光标末尾检测：没有选择范围');
      return false;
    }
    
    const range = selection.getRangeAt(0);
    
    // 检查是否是折叠的选择（光标而不是选择区域）
    if (!range.collapsed) {
      console.log('🔍 光标末尾检测：存在选择区域，不是单纯的光标');
      return false;
    }
    
    const container = range.startContainer;
    
    // 使用 TreeWalker 找到最后一个文本节点
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let lastTextNode = null;
    let node;
    while ((node = walker.nextNode())) {
      lastTextNode = node;
    }
    
    if (!lastTextNode) {
      console.log('🔍 光标末尾检测：没有找到文本节点');
      return false;
    }
    
    const textContent = lastTextNode.textContent || '';
    const isAtEnd = container === lastTextNode && range.startOffset === textContent.length;
    
    console.log('🔍 光标末尾检测结果:', {
      startOffset: range.startOffset,
      textLength: textContent.length,
      containerText: container.textContent?.substring(-20) || '',
      lastTextNodeText: lastTextNode.textContent?.substring(-20) || '',
      isSameNode: container === lastTextNode,
      isAtEnd
    });
    
    return isAtEnd;
  }, []);

  // 添加合并到下一个块的处理函数
  const handleMergeWithNextBlock = useCallback(async () => {
    console.log('🔄 尝试合并到下一个块 - 开始检查条件');
    
    if (!contentEditableRef.current || block.block_type !== 'text') {
      console.log('❌ 合并到下一块失败：不是文本块或 contentEditableRef 不存在', {
        hasRef: !!contentEditableRef.current,
        blockType: block.block_type
      });
      return;
    }
    
    // 检查当前块是否是临时块
    const isTemporaryBlock = block.id.startsWith('temp-');
    if (isTemporaryBlock) {
      console.log('⚠️ 当前块是临时块，暂时无法合并，请稍后再试');
      toast.warning('新块正在创建中，请稍后再试合并');
      return;
    }
    
    try {
      // 检查是否有父级ID和排序信息
      const parentId = block.parent_id;
      const currentOrderIndex = block.order_index;
      
      if (!parentId || currentOrderIndex === undefined) {
        console.warn('无法合并到下一块：缺少父级ID或排序信息');
        return;
      }
      
      // 查找下一个可合并的文本块
      const nextBlock = await ContextBlocksService.getNextTextBlock(
        block.id,
        parentId,
        currentOrderIndex
      );
      
      if (!nextBlock) {
        console.log('没有找到可合并的下一个文本块');
        return;
      }
      
      console.log('🔄 准备合并到下一块:', {
        current: { id: block.id, content: block.content?.substring(0, 30) + '...' },
        target: { id: nextBlock.id, content: nextBlock.content?.substring(0, 30) + '...' }
      });
      
      // === 第一步：立即更新UI，提供即时反馈 ===
      const currentContent = block.content || '';
      const nextContent = nextBlock.content || '';
      const mergedContent = currentContent + nextContent;
      const cursorPosition = currentContent.length;
      
      // 立即通知父组件更新当前块内容
      onBlockUpdate?.(block.id, 'text', mergedContent);
      
      // 强制更新当前块的DOM内容（确保合并后的文本立即显示）
      window.dispatchEvent(new CustomEvent('force-update-block-content', {
        detail: { 
          blockId: block.id,
          content: mergedContent
        }
      }));
      
      // 立即通知父组件删除下一个块
      window.dispatchEvent(new CustomEvent('remove-temp-block', {
        detail: { tempId: nextBlock.id }
      }));
      
      // 立即设置光标位置到合并点
      setTimeout(() => {
        if (contentEditableRef.current) {
          // 设置光标到原当前块内容的末尾
          const walker = document.createTreeWalker(
            contentEditableRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let currentPos = 0;
          let targetNode = null;
          let targetOffset = 0;
          
          let node;
          while ((node = walker.nextNode())) {
            const textLength = node.textContent?.length || 0;
            if (currentPos + textLength >= cursorPosition) {
              targetNode = node;
              targetOffset = cursorPosition - currentPos;
              break;
            }
            currentPos += textLength;
          }
          
          if (targetNode) {
            const range = document.createRange();
            const selection = window.getSelection();
            
            if (selection) {
              try {
                range.setStart(targetNode, targetOffset);
                range.setEnd(targetNode, targetOffset);
                selection.removeAllRanges();
                selection.addRange(range);
                console.log(`🎯 设置光标到合并点: ${cursorPosition}`);
              } catch (error) {
                console.error('🎯 设置光标失败:', error);
              }
            }
          }
        }
      }, 50);
      
      // 显示成功提示（乐观）
      toast.success('正在合并文本块...');
      
      // === 第二步：后台验证数据库操作 ===
      console.log('📡 后台验证数据库合并操作');
      
      const result = await ContextBlocksService.mergeWithNextBlock(
        block.id,
        nextBlock.id,
        currentContent,
        nextContent
      );
      
      if (result.success) {
        console.log('✅ 数据库合并到下一块成功:', result);
        toast.success('文本块合并成功');
        
        // 数据库操作成功，UI已经更新，不需要再次触发事件
        
      } else {
        console.error('❌ 数据库合并到下一块失败:', result);
        
        // === 第三步：如果数据库操作失败，回滚UI更改 ===
        console.log('🔄 回滚UI更改');
        
        // 1. 恢复当前块原内容
        onBlockUpdate?.(block.id, 'text', currentContent);
        
        // 强制恢复当前块的DOM内容
        window.dispatchEvent(new CustomEvent('force-update-block-content', {
          detail: { 
            blockId: block.id,
            content: currentContent
          }
        }));
        
        // 2. 恢复下一个块（重新添加）
        window.dispatchEvent(new CustomEvent('create-temp-block', {
          detail: { 
            tempId: nextBlock.id,
            content: nextContent,
            orderIndex: nextBlock.order_index,
            parentId: parentId,
            afterBlockId: block.id
          }
        }));
        
        // 3. 显示错误提示
        toast.error(`合并块失败: ${result.error || '未知错误'}`);
      }
      
    } catch (error) {
      console.error('💥 合并到下一块异常:', error);
      toast.error('合并块时发生错误');
    }
  }, [block.id, block.block_type, block.parent_id, block.order_index, block.content, onBlockUpdate]);

  // 添加粘贴处理函数
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    // 只处理文本块的粘贴
    if (block.block_type !== 'text' || !contentEditableRef.current) return;
    
    // 获取粘贴的文本
    const pastedText = e.clipboardData.getData('text/plain');
    
    // 如果没有文本或没有换行符，使用默认行为
    if (!pastedText || !pastedText.includes('\n')) {
      return; // 让浏览器处理默认粘贴行为
    }
    
    // 阻止默认粘贴行为
    e.preventDefault();
    
    console.log('📋 检测到包含换行符的粘贴文本:', {
      textLength: pastedText.length,
      lineCount: pastedText.split('\n').length,
      preview: pastedText.substring(0, 100) + '...'
    });
    
    try {
      // 分割文本为段落，合并连续的空行
      const paragraphs = pastedText
        .split(/\n+/) // 按一个或多个换行符分割
        .map(p => p.trim()) // 去除每段的首尾空白
        .filter(p => p.length > 0); // 过滤掉空段落
      
      console.log('📋 分割后的段落:', paragraphs.map((p, i) => `${i}: ${p.substring(0, 30)}...`));
      
      if (paragraphs.length === 0) {
        console.log('📋 没有有效段落，取消粘贴');
        return;
      }
      
      if (paragraphs.length === 1) {
        // 只有一个段落，直接粘贴到当前位置
        console.log('📋 单段落粘贴，使用默认行为');
        document.execCommand('insertText', false, paragraphs[0]);
        return;
      }
      
      // 多个段落，需要创建多个块
      console.log('📋 多段落粘贴，开始创建多个块');
      
      // 获取当前光标位置和内容
      const { beforeContent, afterContent, position } = ContextBlocksService.splitContentAtCursor(
        contentEditableRef.current
      );
      
      console.log('📋 当前光标位置信息:', {
        position,
        beforeLength: beforeContent.length,
        afterLength: afterContent.length,
        beforePreview: beforeContent.substring(Math.max(0, beforeContent.length - 20)),
        afterPreview: afterContent.substring(0, 20)
      });
      
      // 检查父级ID
      const parentId = block.parent_id;
      if (!parentId) {
        toast.error('无法创建多个块：缺少父级ID');
        return;
      }
      
      // 定义类型接口
      interface TempBlock {
        tempId: string;
        content: string;
        orderIndex: number;
        realId?: string;
      }
      
      interface BlockToCreate {
        content: string;
        tempId: string;
        realId?: string;
      }
      
      // === 第一步：立即更新UI ===
      
      // 1. 更新当前块内容为：光标前内容 + 第一段落
      const firstBlockContent = beforeContent + paragraphs[0];
      if (contentEditableRef.current) {
        contentEditableRef.current.textContent = firstBlockContent;
      }
      onBlockUpdate?.(block.id, block.block_type, firstBlockContent);
      
      // 2. 为剩余段落创建临时块
      const tempBlocks: TempBlock[] = [];
      for (let i = 1; i < paragraphs.length; i++) {
        const tempId = `temp-paste-${Date.now()}-${i}`;
        const tempOrderIndex = block.order_index + i * 0.1;
        
        tempBlocks.push({
          tempId,
          content: paragraphs[i],
          orderIndex: tempOrderIndex
        });
        
        // 立即通知父组件创建临时块
        window.dispatchEvent(new CustomEvent('create-temp-block', {
          detail: { 
            tempId,
            content: paragraphs[i],
            orderIndex: tempOrderIndex,
            parentId: parentId,
            afterBlockId: i === 1 ? block.id : tempBlocks[i-2].tempId
          }
        }));
      }
      
      // 3. 如果光标后还有内容，创建最后一个块
      if (afterContent.trim()) {
        const lastTempId = `temp-paste-${Date.now()}-last`;
        const lastOrderIndex = block.order_index + paragraphs.length * 0.1;
        
        tempBlocks.push({
          tempId: lastTempId,
          content: afterContent,
          orderIndex: lastOrderIndex
        });
        
        window.dispatchEvent(new CustomEvent('create-temp-block', {
          detail: { 
            tempId: lastTempId,
            content: afterContent,
            orderIndex: lastOrderIndex,
            parentId: parentId,
            afterBlockId: tempBlocks[tempBlocks.length - 2]?.tempId || block.id
          }
        }));
      }
      
      // 4. 显示乐观提示
      toast.success(`正在创建 ${paragraphs.length + (afterContent.trim() ? 1 : 0)} 个文本块...`);
      
      // === 第二步：后台数据库操作 ===
      console.log('📡 开始后台数据库操作');
      
      // 准备所有需要创建的块内容
      const blocksToCreate: BlockToCreate[] = [];
      
      // 剩余段落
      for (let i = 1; i < paragraphs.length; i++) {
        blocksToCreate.push({
          content: paragraphs[i],
          tempId: tempBlocks[i-1].tempId
        });
      }
      
      // 光标后内容（如果有）
      if (afterContent.trim()) {
        blocksToCreate.push({
          content: afterContent,
          tempId: tempBlocks[tempBlocks.length - 1].tempId
        });
      }
      
      // 批量创建块
      const results = await Promise.allSettled(
        blocksToCreate.map(async (blockData, index) => {
          const result = await ContextBlocksService.createBlockAfter(
            index === 0 ? block.id : (blocksToCreate[index - 1]?.realId || block.id),
            blockData.content,
            parentId
          );
          
          if (result.success) {
            // 记录真实ID
            blockData.realId = result.block_id;
            
            // 如果真实ID和临时ID不同，通知父组件替换
            if (result.block_id !== blockData.tempId) {
              window.dispatchEvent(new CustomEvent('replace-temp-block', {
                detail: { 
                  tempId: blockData.tempId, 
                  realId: result.block_id,
                  content: blockData.content
                }
              }));
            }
          }
          
          return result;
        })
      );
      
      // 检查结果
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failCount = results.length - successCount;
      
      if (failCount === 0) {
        console.log('✅ 所有块创建成功');
        toast.success(`成功创建了 ${successCount + 1} 个文本块`);
        
        // 更新当前块内容（包含第一段落）
        const result = await ContextBlocksService.updateBlockContent(block.id, firstBlockContent);
        if (!result.success) {
          console.warn('⚠️ 更新当前块内容失败，但其他块创建成功');
        }
        
        // 聚焦到最后一个创建的块的末尾
        const lastCreatedBlock = blocksToCreate[blocksToCreate.length - 1];
        if (lastCreatedBlock?.realId) {
          // 聚焦到最后一个块的末尾
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('focus-block', {
              detail: { 
                blockId: lastCreatedBlock.realId,
                cursorPosition: lastCreatedBlock.content.length // 设置光标到内容末尾
              }
            }));
          }, 200);
        } else if (tempBlocks.length > 0) {
          // 如果没有真实ID，使用临时ID
          const lastTempBlock = tempBlocks[tempBlocks.length - 1];
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('focus-block', {
              detail: { 
                blockId: lastTempBlock.tempId,
                cursorPosition: lastTempBlock.content.length
              }
            }));
          }, 200);
        }
        
      } else {
        console.error('❌ 部分块创建失败');
        
        // 回滚失败的块
        results.forEach((result, index) => {
          if (result.status === 'rejected' || !result.value.success) {
            const failedBlock = blocksToCreate[index];
            window.dispatchEvent(new CustomEvent('remove-temp-block', {
              detail: { tempId: failedBlock.tempId }
            }));
          }
        });
        
        toast.error(`创建块时出现错误：${successCount} 个成功，${failCount} 个失败`);
      }
      
    } catch (error) {
      console.error('💥 粘贴处理异常:', error);
      toast.error('处理粘贴内容时发生错误');
      
      // 完全回滚
      if (contentEditableRef.current) {
        contentEditableRef.current.textContent = block.content || '';
      }
      onBlockUpdate?.(block.id, block.block_type, block.content || '');
    }
  }, [block.id, block.block_type, block.parent_id, block.order_index, block.content, onBlockUpdate]);

  // 处理翻译功能
  const handleShowTranslation = useCallback(() => {
    onShowSplitView?.(block.id, 'translation');
  }, [block.id, onShowSplitView]);

  // 添加分享链接处理函数
  const handleShareBlock = useCallback(async () => {
    try {
      // 获取当前页面URL并添加blockId参数
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('blockId', block.id);
      
      // 复制到剪贴板
      await navigator.clipboard.writeText(currentUrl.toString());
      
      // 显示成功提示
      toast.success('块链接已复制到剪贴板');
    } catch (error) {
      console.error('复制块链接失败:', error);
      toast.error('复制块链接失败');
    }
  }, [block.id]);

  // 监听键盘快捷键事件
  useEffect(() => {
    const handleKeyboardPrevious = () => {
      if (activeBlockId !== block.id) return; // 只在当前活动块中响应
      
      const sentenceIds = getSentenceIdsFromContent();
      if (activeIndex !== null && activeIndex > 0) {
        const prevIndex = activeIndex - 1;
        const sentenceId = sentenceIds[prevIndex];
        const sentence = embeddedSentences.get(sentenceId);
        
        if (sentence) {
          console.log('键盘触发：播放上一句', { prevIndex, sentenceId });
          playSentence(sentence, prevIndex);
        }
      }
    };

    const handleKeyboardNext = () => {
      if (activeIndex !== null && sentences.length > 0) {
        const nextIndex = activeIndex + 1;
        if (nextIndex < sentences.length) {
          const nextSentence = sentences[nextIndex];
          if (nextSentence) {
            playWord(nextSentence, new MouseEvent('click') as any);
          }
        }
      }
    };

    // 添加键盘翻译显隐事件监听
    const handleKeyboardToggleTranslation = () => {
      // 只有当前块是活动块时才响应
      if (activeBlockId === block.id) {
        const newState = !showInlineTranslation;
        
        // 更新全局状态
        (window as any).globalTranslationState = newState;
        
        // 发送全局翻译切换事件
        window.dispatchEvent(new CustomEvent('global-translation-toggle', {
          detail: { show: newState, activeBlockId: block.id }
        }));
        
        toast.success(newState ? '显示翻译' : '隐藏翻译', {
          position: 'bottom-right',
          duration: 1000,
        });
      }
    };

    window.addEventListener('keyboard-next-sentence', handleKeyboardNext);
    window.addEventListener('keyboard-previous-sentence', handleKeyboardPrevious);
    window.addEventListener('keyboard-toggle-translation', handleKeyboardToggleTranslation);
    
    return () => {
      window.removeEventListener('keyboard-next-sentence', handleKeyboardNext);
      window.removeEventListener('keyboard-previous-sentence', handleKeyboardPrevious);
      window.removeEventListener('keyboard-toggle-translation', handleKeyboardToggleTranslation);
    };
  }, [activeIndex, sentences, activeBlockId, block.id, showInlineTranslation]);

  // 监听全局翻译显示状态
  useEffect(() => {
    const handleGlobalTranslationToggle = (e: CustomEvent) => {
      const { show, activeBlockId } = e.detail;
      // 只有当前块是活动块时才显示翻译
      if (activeBlockId === block.id) {
        setShowInlineTranslation(show);
      } else {
        setShowInlineTranslation(false);
      }
    };

    window.addEventListener('global-translation-toggle', handleGlobalTranslationToggle as EventListener);
    
    return () => {
      window.removeEventListener('global-translation-toggle', handleGlobalTranslationToggle as EventListener);
    };
  }, [block.id]);

  // 当活动块变化时，根据全局翻译状态决定是否显示翻译
  useEffect(() => {
    if (activeBlockId === block.id) {
      // 检查全局翻译状态
      const globalTranslationState = (window as any).globalTranslationState || false;
      setShowInlineTranslation(globalTranslationState);
    } else {
      setShowInlineTranslation(false);
    }
  }, [activeBlockId, block.id]);

  // 监听活动块变化事件，同步翻译状态
  useEffect(() => {
    const handleActiveBlockChange = (e: CustomEvent) => {
      const { activeBlockId: newActiveBlockId } = e.detail;
      const globalTranslationState = (window as any).globalTranslationState || false;
      
      if (newActiveBlockId === block.id && globalTranslationState) {
        // 当前块成为活动块且全局翻译状态为开启时，显示翻译
        setShowInlineTranslation(true);
      } else {
        // 其他情况隐藏翻译
        setShowInlineTranslation(false);
      }
    };

    window.addEventListener('active-block-changed', handleActiveBlockChange as EventListener);
    
    return () => {
      window.removeEventListener('active-block-changed', handleActiveBlockChange as EventListener);
    };
  }, [block.id]);

  return (
    <div
      ref={blockRef}
      data-block-id={block.id}
      className={cn(
        'group relative my-1 p-2 rounded-md transition-all duration-300',
        isBlockActive ? 'bg-accent/20 border border-primary/30' : 'hover:bg-accent/10 border border-transparent',
        isDragOver ? 'border-2 border-dashed border-primary/50 bg-primary/5' : '',
        dropPosition === 'before' ? 'border-t-2 border-t-primary' : '',
        dropPosition === 'after' ? 'border-b-2 border-b-primary' : '',
        localAligning ? 'bg-primary/5 border border-primary/30 shadow-md' : '',
        showCompleteAnimation ? 'alignment-complete' : '',
        isInAnchorMode ? 'bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800' : '',
        // 选择模式的预选择状态（悬浮高亮）
        isSelectionMode && isBlockSelectable && !isSelectedAsStart && !isSelectedAsEnd && !isTTSStartBlock && !isTTSSelectedBlock ? (
          selectionType === 'start' 
            ? 'hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 dark:hover:from-orange-900/10 dark:hover:to-red-900/10 hover:border-orange-200 dark:hover:border-orange-800 cursor-pointer'
            : selectionType === 'tts'
              ? 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/10 dark:hover:to-indigo-900/10 hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer'
              : 'hover:bg-gradient-to-r hover:from-green-50 hover:to-teal-50 dark:hover:from-green-900/10 dark:hover:to-teal-900/10 hover:border-green-200 dark:hover:border-green-800 cursor-pointer'
        ) : '',
        // 选择模式的已选择状态
        isSelectedAsStart ? cn('bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border-orange-400 dark:border-orange-600 shadow-lg ring-2 ring-orange-300 dark:ring-orange-700', styles.selectionStartAnimated) : '',
        isSelectedAsEnd ? cn('bg-gradient-to-r from-green-100 to-teal-100 dark:from-green-900/30 dark:to-teal-900/30 border-green-400 dark:border-green-600 shadow-lg ring-2 ring-green-300 dark:ring-green-700', styles.selectionEndAnimated) : '',
        // TTS选择状态
        isTTSStartBlock ? 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-400 dark:border-blue-600 shadow-lg ring-2 ring-blue-300 dark:ring-blue-700' : '',
        isTTSSelectedBlock && !isTTSStartBlock ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300 dark:border-blue-700 shadow-md' : '',
        // 处理中状态
        isProcessingAlignment ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-400 dark:border-purple-600 shadow-lg' : ''
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      draggable={!isInAnchorMode && !isSelectionMode && !isAlignmentProcessing} // 锚定模式、选择模式和对齐处理中时禁用拖拽
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 选择模式指示器 - 只在真正选中时显示 */}
      {(isSelectedAsStart || isSelectedAsEnd) && (
        <div className={cn(
          styles.selectionIndicator,
          isSelectedAsStart ? styles.selectionIndicatorStart : styles.selectionIndicatorEnd
        )}>
          {isSelectedAsStart ? '始' : '终'}
        </div>
      )}

      {/* TTS选择指示器 */}
      {(isTTSStartBlock || isTTSSelectedBlock) && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-10 shadow-lg">
          {isTTSStartBlock ? 'T' : '✓'}
        </div>
      )}

      {/* 处理中动画指示器 - 无闪烁版本 */}
      {isProcessingAlignment && (
        <div className={styles.processingOverlay}>
          {/* 流畅的边框效果 */}
          <div className={styles.processingAnimatedBorder} />
          
          {/* 静态背景 */}
          <div className={styles.processingBackground} />
          
          {/* 中心内容 */}
          <div className={styles.processingCenter}>
            <div className={styles.processingCard}>
              <div className={styles.processingContent}>
                {/* 静态处理图标 */}
                <div className={styles.processingIcon}>
                  <Sparkles className="h-5 w-5" />
                </div>
                
                {/* 文字和静态点点 */}
                <div className={styles.processingText}>
                  <span className={styles.processingLabel}>
                    AI对齐处理中
                  </span>
                  {/* 静态点点 */}
                  <div className={styles.processingDots}>
                    <div className={styles.processingDot} />
                    <div className={styles.processingDot} />
                    <div className={styles.processingDot} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 拖拽手柄 - 对不同块类型使用不同位置，锚定模式、选择模式和对齐处理中时隐藏 */}
      {!isInAnchorMode && !isSelectionMode && !isAlignmentProcessing && (
      <div
        className={cn(
          "absolute flex items-center justify-center opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity cursor-grab hover:cursor-pointer",
          block.block_type === 'audio_aligned' 
            ? "left-2 top-3 w-8 h-8" 
            : "left-0 top-2.5 w-8 h-8"
        )}
        onClick={handleDragHandleClick}
        draggable={true}
        onDragStart={(e) => {
          // 设置拖拽数据
          e.dataTransfer.setData('text/plain', block.id);
          e.dataTransfer.effectAllowed = 'move';
          setIsDragging(true);
        }}
        onDragEnd={() => {
          setIsDragging(false);
        }}
      >
        <DragHandleDots2Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      )}
      
      {/* 块内容 */}
      <div className={cn(
        isInAnchorMode || isSelectionMode ? 'pl-0' : 'pl-6', // 锚定模式和选择模式下不需要左内边距
        // 确保选中状态下文本颜色正确
        isSelectedAsStart ? 'text-orange-900 dark:text-orange-100' : '',
        isSelectedAsEnd ? 'text-green-900 dark:text-green-100' : '',
        isTTSStartBlock ? 'text-blue-900 dark:text-blue-100' : '',
        isTTSSelectedBlock && !isTTSStartBlock ? 'text-blue-800 dark:text-blue-200' : '',
        isProcessingAlignment ? 'text-purple-900 dark:text-purple-100' : ''
      )}>
        {renderContent()}
      </div>
      
      {/* 内联翻译显示 */}
      <AnimatePresence>
        {showInlineTranslation && block.translation_content && (
          <motion.div
            className={cn(
              "mt-2 p-3 rounded-lg border-l-4 border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20 overflow-hidden",
              isInAnchorMode ? 'ml-0' : 'ml-6'
            )}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ 
              duration: 0.2, 
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            style={{ transformOrigin: 'top' }}
          >
            {renderTranslationWithHighlight(block.translation_content)}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 对齐中状态指示器 */}
      {localAligning && (
        <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] rounded-md flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <div className="text-sm font-medium">正在对齐文本...</div>
            <div className="text-xs text-muted-foreground mt-1">请稍候片刻</div>
          </div>
        </div>
      )}

      {/* 块操作菜单 */}
      <SimpleBlockMenu
        isOpen={showBlockMenu}
        onClose={() => setShowBlockMenu(false)}
        position={blockMenuPosition}
        currentBlockType={block.block_type}
        onTypeChange={handleBlockTypeChange}
        onDelete={() => {}} // 空函数，SimpleBlockMenu内部自己处理删除
        onShare={handleShareBlock}
        blockId={block.id}
        blockData={{
          content: block.content || '',
          order_index: block.order_index,
          parent_id: block.parent_id || ''
        }}
      />
    </div>
  );
}