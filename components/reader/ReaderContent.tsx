'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { ContentBlock } from './ContentBlock';
import { toast } from 'sonner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Image from 'next/image';
import { AudioController } from '@/lib/audio-controller';
import { cn } from '@/lib/utils';
import { throttle } from 'lodash';

// 定义格式化工具函数 - 移到文件顶层
function formatTime(beginTime?: number, endTime?: number) {
  if (beginTime === undefined) return '无时间信息';
  
  const formatMs = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return `${formatMs(beginTime)} - ${endTime ? formatMs(endTime) : '?'}`;
}

function formatWordTime(timeRange?: string) {
  if (!timeRange) return '';
  
  const [start, end] = timeRange.split('~');
  if (!start) return '';
  
  const startMs = parseInt(start, 10);
  const startSec = (startMs / 1000).toFixed(1);
  
  return `${startSec}s`;
}

interface ReaderContentProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
}

export function ReaderContent({ book, arrayBuffer }: ReaderContentProps) {
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

  // 添加块选择处理函数
  const handleBlockSelect = (blockId: string, event: React.MouseEvent) => {
    if (event.shiftKey) {
      // 范围选择
      const blocks = contextBlocks[currentChapter];
      const lastSelectedBlock = Array.from(selectedBlocks).pop();
      if (lastSelectedBlock) {
        const startIdx = blocks.findIndex(b => b.id === lastSelectedBlock);
        const endIdx = blocks.findIndex(b => b.id === blockId);
        if (startIdx !== -1 && endIdx !== -1) {
          const start = Math.min(startIdx, endIdx);
          const end = Math.max(startIdx, endIdx);
          const newSelection = new Set(selectedBlocks);
          for (let i = start; i <= end; i++) {
            newSelection.add(blocks[i].id);
          }
          setSelectedBlocks(newSelection);
          return;
        }
      }
    }

    setSelectedBlocks(prev => {
      const newSelection = new Set(prev);
      if (event.metaKey || event.ctrlKey) {
        // 多选
        if (newSelection.has(blockId)) {
          newSelection.delete(blockId);
        } else {
          newSelection.add(blockId);
        }
      } else {
        // 单选
        newSelection.clear();
        newSelection.add(blockId);
      }
      return newSelection;
    });
  };

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

  // 预加载相邻章节的数据
  const preloadAdjacentChapters = async (currentIndex: number) => {
    const adjacentIndices = [currentIndex - 1, currentIndex + 1].filter(
      index => index >= 0 && index < book.chapters.length
    );

    for (const index of adjacentIndices) {
      if (!contextBlocks[index] && parentIds[index]) {
        const { data } = await supabase
          .from('context_blocks')
          .select('*')
          .eq('parent_id', parentIds[index])
          .order('order_index');

        if (data) {
          setContextBlocks(prev => ({
            ...prev,
            [index]: data
          }));
        }
      }
    }
  };

  // 一次性加载所有章节的 parent_id
  useEffect(() => {
    async function loadAllParentIds() {
      try {
        console.log('当前book对象:', book);
        console.log('正在加载章节，book.id:', book.id);
        
        const { data, error } = await supabase
          .from('chapters')
          .select('order_index, parent_id')
          .eq('book_id', book.id)
          .order('order_index');

        if (error) {
          console.error('加载章节父级ID失败:', error);
          return;
        }

        if (!data || data.length === 0) {
          console.error('未找到任何章节数据，book.id:', book.id);
          return;
        }

        console.log('加载到的章节数据:', data);

        const idMap = data.reduce((acc: Record<number, string>, chapter: { order_index: number; parent_id: string }) => {
          acc[chapter.order_index] = chapter.parent_id;
          return acc;
        }, {});

        setParentIds(idMap);
        console.log('设置的parentIds:', idMap);
      } catch (err) {
        console.error('加载章节父级ID失败:', err);
      }
    }

    loadAllParentIds();
  }, [book.id]);

  // 加载资源信息(只加载一次)
  useEffect(() => {
    async function loadResources() {
      try {
        const { data, error } = await supabase
          .from('book_resources')
          .select('original_path, oss_path')
          .eq('book_id', book.id);

        if (error) {
          console.error('加载资源信息失败:', error);
          return;
        }

        // 规范化资源路径
        const normalizedResources = (data || []).map(resource => ({
          original_path: resource.original_path.replace(/^OEBPS\//, '').replace(/^OPS\//, ''),
          oss_path: resource.oss_path
        }));

        console.log('加载的资源:', normalizedResources);
        setResources(normalizedResources);
      } catch (err) {
        console.error('加载资源信息失败:', err);
      }
    }

    if (resources.length === 0) {
      loadResources();
    }
  }, [book.id, resources.length]);

  // 在组件中添加调试日志
  useEffect(() => {
    console.log('加载的上下文块:', contextBlocks);
    console.log('当前章节:', currentChapter);
    console.log('当前章节的块:', contextBlocks[currentChapter]);
  }, [contextBlocks, currentChapter]);

  // 修改loadContextBlocksForChapter函数，添加更多错误处理
  const loadContextBlocksForChapter = async (chapterIndex: number) => {
    console.log(`开始加载章节 ${chapterIndex} 的内容，parentId: ${parentIds[chapterIndex]}`);
    
    if (!parentIds[chapterIndex]) {
      console.error('没有找到章节的parentId，尝试重新获取', chapterIndex);
      // 尝试重新获取parentId
      await loadParentIds();
      // 如果还是没有，则放弃
      if (!parentIds[chapterIndex]) {
        toast.error('无法加载章节内容，请刷新页面');
        return;
      }
    }
    
    try {
      setLoading(true);
      
      const parentId = parentIds[chapterIndex];
      if (!parentId) {
        console.error('未找到章节对应的parent_id:', chapterIndex, '当前parentIds:', parentIds);
        toast.error('加载失败', { description: '未找到章节标识信息' });
        return;
      }

      console.log(`正在重新加载章节内容，chapterIndex: ${chapterIndex}, parentId: ${parentId}`);

      const { data: blocks, error: blocksError } = await supabase
        .from('context_blocks')
        .select('*')
        .eq('parent_id', parentId)
        .order('order_index');

      if (blocksError) {
        console.error('加载语境块失败:', blocksError);
        toast.error('加载失败', { description: blocksError.message });
        return;
      }

      console.log(`成功加载了 ${blocks?.length || 0} 个语境块`);

      // 使用函数式更新来确保基于最新状态
      setContextBlocks(prev => {
        const newBlocks = { ...prev };
        newBlocks[chapterIndex] = blocks || [];
        console.log('更新后的blocks状态:', newBlocks);
        return newBlocks;
      });

      console.log(`章节 ${chapterIndex} 的内容已重新加载`);

    } catch (err) {
      console.error('加载语境块失败:', err);
      toast.error('加载失败', { description: '请刷新页面重试' });
    } finally {
      setLoading(false);
    }
  };

  // 修改原来的useEffect
  useEffect(() => {
    async function loadContextBlocksInitial() {
      if (contextBlocks[currentChapter]) {
        return;
      }

      try {
        setLoading(true);
        
        const parentId = parentIds[currentChapter];
        if (!parentId) {
          console.error('未找到章节对应的parent_id:', currentChapter);
          return;
        }

        console.log('正在加载章节内容，parentId:', parentId);

        const { data: blocks, error: blocksError } = await supabase
          .from('context_blocks')
          .select('*')
          .eq('parent_id', parentId)
          .order('order_index');

        if (blocksError) {
          console.error('加载语境块失败:', blocksError);
          return;
        }

        console.log('加载到的blocks:', blocks);

        setContextBlocks(prev => ({
          ...prev,
          [currentChapter]: blocks || []
        }));

        // 预加载相邻章节
        preloadAdjacentChapters(currentChapter);

      } catch (err) {
        console.error('加载语境块失败:', err);
      } finally {
        setLoading(false);
      }
    }

    if (book.id && currentChapter >= 0 && parentIds[currentChapter]) {
      loadContextBlocksInitial();
    }
  }, [book.id, currentChapter, parentIds, contextBlocks]);

  const handleChapterChange = (newChapter: number) => {
    setCurrentChapter(newChapter);
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

  const renderBlocks = () => {
    if (!contextBlocks[currentChapter]) {
      return <div className="p-4 text-muted-foreground">无内容</div>;
    }

    const blocks = contextBlocks[currentChapter];
    return blocks.map((block) => {
      // 检查是否有活动的分栏视图
      const hasSplitView = activeSplitViewBlockId === block.id;
      
      return (
        <div key={block.id} className={`${hasSplitView ? 'grid grid-cols-2 gap-2' : ''}`}>
          {/* 主语境块 */}
          <div className={hasSplitView ? 'col-span-1' : ''}>
      <ContentBlock
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
            />
          </div>
          
          {/* 分栏视图块 - 修改为与语境块相匹配的大小 */}
          {hasSplitView && (
            <div className="col-span-1">
              <div 
                className={cn(
                  'group relative my-1 p-2 rounded-md border transition-all duration-300',
                  'bg-primary/5 border-primary/20',
                  'hover:bg-primary/10',
                  'h-full flex flex-col' // 添加flex和h-full使其高度与语境块匹配
                )}
              >
                {/* 小标签 - 更大且居中 */}
                <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-0.5 bg-background text-[14px] font-medium text-muted-foreground">
                  对齐原文
                </div>
                
                {/* 右上角操作按钮组 */}
                <div className="absolute right-2 top-2 flex space-x-2">
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
                
                {/* 内容部分 - 添加flex-grow使其填充可用空间 */}
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
          )}
        </div>
      );
    });
  };

  // 添加事件监听器以接收循环模式变更
  useEffect(() => {
    const handleSetPlayMode = (e: CustomEvent) => {
      const mode = e.detail.mode;
      if (mode && ['sentence', 'block', 'continuous'].includes(mode)) {
        setPlayMode(mode as any);
        toast.info(`已设置全局播放模式为: ${
          mode === 'sentence' ? '句子循环' : 
          mode === 'block' ? '段落循环' : '连续播放'
        }`);
      }
    };
    
    window.addEventListener('set-play-mode', handleSetPlayMode as EventListener);
    
    return () => {
      window.removeEventListener('set-play-mode', handleSetPlayMode as EventListener);
    };
  }, []);

  // 在组件挂载和卸载时清理音频
  useEffect(() => {
    // 组件挂载时强制清理
    AudioController.stop();
    
    // 组件卸载时也清理
    return () => {
      AudioController.stop();
    };
  }, []);

  // 修改播放模式
  const handlePlayModeChange = (newMode: 'sentence' | 'block' | 'continuous') => {
    setPlayMode(newMode);
    
    // 通知AudioController
    AudioController.setPlayMode(newMode);
    
    // 修正toast的用法
    toast(`已设置全局播放模式为: ${
      newMode === 'continuous' ? '连续播放' :
      newMode === 'block' ? '段落循环' : '句子循环'
    }`);
  };

  // 如果你在多个地方调用，也可以添加节流逻辑
  const throttledSetPlayMode = useCallback(
    throttle((newMode: 'sentence' | 'block' | 'continuous') => {
      handlePlayModeChange(newMode);
    }, 2000), // 2秒内不重复显示
    [handlePlayModeChange]
  );

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

  // 修正翻译功能toast
  const handleTranslate = () => {
    // 未来实现翻译功能...
    toast("翻译功能开发中", {
      description: "敬请期待"
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 阅读器导航栏 */}
      <div className="fixed top-16 left-0 right-0 h-12 border-b bg-card/95 backdrop-blur flex items-center px-4 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-1.5 hover:bg-accent rounded-md transition-colors ${
              showToc ? 'bg-accent/30' : ''
            }`}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleChapterChange(Math.max(0, currentChapter - 1))}
              disabled={currentChapter === 0}
              className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleChapterChange(Math.min(book.chapters.length - 1, currentChapter + 1))}
              disabled={currentChapter === book.chapters.length - 1}
              className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 px-4">
          <div className="text-center">
            <h1 className="text-base font-semibold truncate">{book.title}</h1>
            <h2 className="text-sm text-muted-foreground truncate">
              {book.chapters[currentChapter]?.title}
            </h2>
          </div>
        </div>
        <button
          onClick={() => setShowAudioPanel(!showAudioPanel)}
          className={`p-1.5 hover:bg-accent/50 rounded-md transition-colors relative ${
            showAudioPanel ? 'bg-accent/30' : ''
          }`}
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

      {/* 主要内容区域 */}
      <div className="flex-1 pt-28 pb-16">
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
        fixed left-0 top-28 w-64 h-[calc(100vh-7rem)]
        transform transition-all duration-300 ease-in-out border-r shadow-lg z-30
        bg-card/95 backdrop-blur
        ${showToc ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-3 border-b bg-card/95 backdrop-blur sticky top-0">
            <h3 className="text-sm font-medium">目录</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              {book.chapters.map((chapter, index) => (
                <button
                  key={index}
                  onClick={() => {
                    handleChapterChange(index);
                    setShowToc(false);
                  }}
                  className={`block w-full text-left px-2 py-1.5 rounded-md text-sm ${
                    currentChapter === index 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-accent'
                  }`}
                >
                  {chapter.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 音频处理抽屉面板 */}
      <div className={`
        fixed right-0 top-28 w-[400px] h-[calc(100vh-7rem)]
        transform transition-all duration-300 ease-in-out
        bg-card/95 backdrop-blur border-l shadow-lg z-30
        ${showAudioPanel ? 'translate-x-0' : 'translate-x-full'}
        group
      `}>
        {/* 拖拽调整宽度的把手 */}
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

        {/* 音频处理区域 */}
        <div className="flex-1 flex flex-col h-full">
          <div className="p-2 border-b bg-card/95 backdrop-blur sticky top-0 z-30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Mic className="w-4 h-4 text-primary/80" />
                <h2 className="text-sm font-medium">音频处理</h2>
              </div>
              <button
                onClick={() => setShowAudioPanel(false)}
                className="p-1 hover:bg-accent rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <AudioRecognizer
              bookContent={book.chapters[currentChapter]?.content || ''}
              bookId={book.id}
              onAudioUrlChange={setAudioUrl}
              onTimeChange={setCurrentTime}
            />
          </div>
        </div>
      </div>

      {/* 可拖拽音频播放器 */}
      {audioUrl && (
        <DraggableAudioPlayer
          key={audioUrl}
          bookId={book.id}
          audioUrl={audioUrl}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          passiveMode={true}
        />
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
    </div>
  );
}

// 添加自定义终端风格悬浮窗组件
function TerminalPopover({ 
  blockId, 
  contextBlocks,
  position,
  onClose,
  audioUrl
}: { 
  blockId: string, 
  contextBlocks: any[],
  position: { x: number, y: number },
  onClose: () => void,
  audioUrl?: string
}) {
  const [alignmentData, setAlignmentData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(true);
  
  // 自动关闭逻辑
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hovering) {
        onClose();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [hovering, onClose]);
  
  // 数据加载逻辑保持不变...
  useEffect(() => {
    async function loadAlignmentData() {
      try {
        setIsLoading(true);
        console.log('开始加载块的音频对齐数据, blockId:', blockId);
        
        // 从block_sentences表直接获取对齐数据
        const { data: blockSentencesData, error: blockSentencesError } = await supabase
          .from('block_sentences')
          .select(`
            block_id,
            sentence_id,
            order_index,
            alignment_score,
            segment_begin_offset,
            segment_end_offset,
            alignment_metadata,
            sentences (id, text_content, begin_time, end_time)
          `)
          .eq('block_id', blockId)
          .order('order_index');
        
        if (blockSentencesError) {
          console.error('获取block_sentences对齐数据失败:', blockSentencesError);
          return;
        }
        
        console.log('从block_sentences表获取的数据:', blockSentencesData);
        
        if (!blockSentencesData || blockSentencesData.length === 0) {
          console.log('未找到块相关的句子对齐数据');
          return;
        }
        
        // 处理获取到的数据
        const processedData = blockSentencesData.map(item => ({
          id: item.sentence_id,
          order_index: item.order_index,
          alignment_score: item.alignment_score,
          segment_begin_offset: item.segment_begin_offset,
          segment_end_offset: item.segment_end_offset,
          alignment_metadata: item.alignment_metadata || {},
          // 句子信息
          text_content: item.sentences?.text_content || '',
          begin_time: item.sentences?.begin_time || 0,
          end_time: item.sentences?.end_time || 0
        }));
        
        console.log('处理后的对齐数据:', processedData);
        setAlignmentData(processedData);
      } catch (err) {
        console.error('加载音频对齐数据失败:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (blockId) {
      loadAlignmentData();
    }
  }, [blockId]);
  
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
  
  // 复制功能
  const copyToClipboard = () => {
    const textContent = alignmentData.map((item, idx) => {
      // 创建纯文本内容
      let result = `[句子 ${idx + 1}] ${item.text_content}\n`;
      result += `时间范围: ${item.begin_time.toFixed(2)}s - ${item.end_time.toFixed(2)}s\n`;
      
      if (item.alignment_metadata?.alignment_summary) {
        const summary = item.alignment_metadata.alignment_summary;
        result += `原始文本: ${summary.original_text || ''}\n`;
        result += `对齐文本: ${summary.aligned_text || ''}\n`;
      }
      
      if (item.alignment_metadata?.word_changes?.words) {
        result += "词语对齐:\n";
        item.alignment_metadata.word_changes.words.forEach((word: any, widx: number) => {
          result += `  ${widx.toString().padStart(2, ' ')}: ${word.time_range} "${word.original}"${
            word.original !== word.aligned ? ` → "${word.aligned}"` : ""
          } 置信度:${word.confidence}\n`;
        });
      }
      
      if (item.alignment_metadata?.alignment_method) {
        result += `\n对齐方法: ${item.alignment_metadata.alignment_method}\n`;
        result += `算法版本: ${item.alignment_metadata.algorithm_version || '未知'}\n`;
        if (item.alignment_metadata?.alignment_summary?.alignment_date) {
          result += `对齐日期: ${item.alignment_metadata.alignment_summary.alignment_date}\n`;
        }
      }
      
      return result + "\n";
    }).join("");
    
    navigator.clipboard.writeText(textContent);
    toast.success("已复制到剪贴板");
  };

  if (isLoading) {
    return (
      <div 
        ref={popoverRef}
        className="fixed z-50 bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded shadow-lg w-96 h-48"
        style={{ 
          top: `${position.y}px`, 
          left: `${position.x}px`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">正在加载对齐数据...</div>
        </div>
      </div>
    );
  }
  
  if (!alignmentData.length) {
    return (
      <div 
        ref={popoverRef}
        className="fixed z-50 bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded shadow-lg w-96 h-48"
        style={{ 
          top: `${position.y}px`, 
          left: `${position.x}px`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">未找到对齐数据</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={popoverRef}
      className="fixed z-50 bg-[#1e1e1e] text-[#d4d4d4] p-2 rounded shadow-lg 
                 w-[420px] max-h-[380px] overflow-auto custom-scrollbar border border-gray-700"
      style={{ 
        top: `${position.y - 140}px`,
        left: `${position.x - 210}px`
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* 标题和复制按钮 - 增加padding */}
      <div className="flex justify-between items-center mb-3 sticky top-0 bg-[#1e1e1e] py-2 border-b border-gray-700 z-10">
        <span className="text-sm font-medium text-gray-300">对齐细节表</span>
        <button 
          onClick={copyToClipboard}
          className="text-gray-400 hover:text-white p-1 rounded"
          title="复制全部"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      
      {/* 句子对齐详情 */}
      <div className="space-y-3">
        {alignmentData.map((item, idx) => {
          // 从alignment_metadata中获取原始文本和对齐文本
          const originalText = item.alignment_metadata?.alignment_summary?.original_text || item.text_content;
          const alignedText = item.alignment_metadata?.alignment_summary?.aligned_text || item.text_content;
          
          return (
            <div key={idx} className="pb-2 mb-1 border-b border-gray-700">
              {/* 句子标题和播放按钮 */}
              <div className="flex justify-between items-center mb-1">
                <div className="text-green-300 font-bold flex items-center">
                  <span>[句子 {idx + 1}]</span>
                  {item.alignment_score && (
                    <span className="ml-2 text-[10px] text-yellow-400">
                      匹配度: {(parseFloat(item.alignment_score) * 100).toFixed(1)}%
                    </span>
                  )}
                  {item.alignment_status && (
                    <span className="ml-2 text-[10px] text-blue-400">
                      {item.alignment_status === 'automated' ? '自动' : '人工'}
                    </span>
                  )}
                  {audioUrl && item.begin_time !== undefined && (
                    <button 
                      onClick={() => playAudio(item.begin_time, item.end_time)}
                      className="ml-2 text-gray-400 hover:text-white"
                      title="播放句子"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </button>
                  )}
                </div>
                <span className="text-yellow-300 text-[10px]">
                  {formatTime(item.begin_time, item.end_time)}
                </span>
              </div>
              
              {/* 添加句子文本显示区域 */}
              <div className="mb-2 pl-1">
                {originalText !== alignedText ? (
                  <>
                    <div className="flex">
                      <span className="text-gray-500 w-10 text-[10px]">原文:</span>
                      <span className="text-red-300 text-[10px]">{originalText}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-10 text-[10px]">对齐:</span>
                      <span className="text-green-300 text-[10px]">{alignedText}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-white text-[10px]">{alignedText}</div>
                )}
              </div>
              
              {/* 词语对齐表 - 终端风格 */}
              {item.alignment_metadata?.word_changes?.words && (
                <div className="mt-1 text-[10px]">
                  <div className="font-mono">
                    <div className="grid grid-cols-10 text-gray-500 border-b border-gray-700 pb-1">
                      <span className="col-span-1">序号</span>
                      <span className="col-span-2 text-cyan-300">时间</span>
                      <span className="col-span-3 text-gray-500">原词</span>
                      <span className="col-span-3 text-green-300">对齐词</span>
                      <span className="col-span-1"></span>
                    </div>
                    {item.alignment_metadata.word_changes.words.map((word: any, widx: number) => {
                      const timeRange = word.time_range?.split('~');
                      const startTime = timeRange?.[0] ? parseInt(timeRange[0], 10) : null;
                      const isDifferent = word.original !== word.aligned;
                      
                      return (
                        <div key={widx} className="grid grid-cols-10 items-center hover:bg-gray-800 border-b border-gray-900">
                          <span className="col-span-1 text-gray-500">{widx}</span>
                          <span className="col-span-2 text-cyan-300">{formatWordTime(word.time_range)}</span>
                          <span className={`col-span-3 ${isDifferent ? 'text-red-400' : 'text-white'} truncate`} title={word.original}>
                            {word.original !== null && word.original !== undefined ? word.original : '(空)'}
                          </span>
                          <span className={`col-span-3 ${isDifferent ? 'text-green-400' : 'text-white'} truncate`} title={word.aligned}>
                            {word.aligned}
                          </span>
                          <span className="col-span-1 text-right">
                            {audioUrl && startTime && (
                              <button
                                onClick={() => playAudio(startTime)}
                                className="text-gray-500 hover:text-white"
                                title="播放单词"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 