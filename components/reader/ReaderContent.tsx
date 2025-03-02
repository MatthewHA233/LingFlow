'use client';

import { useState, useEffect } from 'react';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentBlock } from './ContentBlock';
import { toast } from 'sonner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Image from 'next/image';
import { AudioController } from '@/lib/audio-controller';

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
  
  // 添加处理对齐完成的函数
  const handleAlignmentComplete = (blockId: string) => {
    console.log(`对齐完成，blockId: ${blockId}, 当前章节: ${currentChapter}`);
    
    setAligningBlocks(prev => {
      const newSet = new Set(prev);
      newSet.delete(blockId);
      return newSet;
    });
    
    // 在更新UI前，先重新加载数据
    loadContextBlocksForChapter(currentChapter)
      .then(() => {
        console.log('数据重新加载成功');
        
        toast.success('文本对齐完成', {
          description: '语境块已更新为音频点读模式'
        });
      })
      .catch(err => {
        console.error('重新加载数据失败:', err);
        
        toast.error('数据刷新失败', {
          description: '请刷新页面查看最新结果'
        });
      });
  };

  // 处理播放下一个块的函数
  const handlePlayNext = (currentBlockId: string, lastSentenceIndex: number) => {
    // 找到当前块的索引
    const blockIndex = contextBlocks[currentChapter]?.findIndex(b => b.id === currentBlockId);
    
    if (blockIndex !== undefined && blockIndex >= 0 && contextBlocks[currentChapter]) {
      // 如果有下一个块且是音频对齐类型，则播放它的第一个句子
      const nextBlockIndex = blockIndex + 1;
      
      if (nextBlockIndex < contextBlocks[currentChapter].length) {
        const nextBlock = contextBlocks[currentChapter][nextBlockIndex];
        
        if (nextBlock.block_type === 'audio_aligned') {
          // 使用自定义事件通知下一个块开始播放
          window.dispatchEvent(new CustomEvent('play-block-sentence', {
            detail: {
              blockId: nextBlock.id,
              sentenceIndex: 0
            }
          }));
        }
      } else if (playMode === 'continuous') {
        // 如果是最后一个块且处于连续播放模式，加载下一章
        if (currentChapter < book.chapters.length - 1) {
          // 切换到下一章
          handleChapterChange(currentChapter + 1);
          
          // 使用延迟确保新章节加载后再播放第一个块
          setTimeout(() => {
            if (contextBlocks[currentChapter + 1]?.length > 0) {
              const firstBlock = contextBlocks[currentChapter + 1][0];
              if (firstBlock.block_type === 'audio_aligned') {
                window.dispatchEvent(new CustomEvent('play-block-sentence', {
                  detail: {
                    blockId: firstBlock.id,
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

    return contextBlocks[currentChapter].map((block) => (
      <ContentBlock
        key={block.id}
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
      />
    ));
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
    AudioController.emergencyCleanup();
    
    // 组件卸载时也清理
    return () => {
      AudioController.emergencyCleanup();
    };
  }, []);

  // 添加函数以处理播放模式变更
  const handlePlayModeChange = (newMode: 'sentence' | 'block' | 'continuous') => {
    console.log('设置全局播放模式为:', newMode);
    setPlayMode(newMode);
    
    // 通知其他可能需要知道的组件
    window.dispatchEvent(new CustomEvent('set-play-mode', {
      detail: { mode: newMode }
    }));
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
        fixed right-0 top-28 w-[600px] h-[calc(100vh-7rem)]
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