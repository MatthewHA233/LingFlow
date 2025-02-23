'use client';

import { useState, useEffect } from 'react';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentBlock } from './ContentBlock';
import { toast } from 'sonner';

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

  // 加载当前章节的语境块
  useEffect(() => {
    async function loadContextBlocks() {
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
      loadContextBlocks();
    }
  }, [book.id, currentChapter, parentIds, contextBlocks]);

  const handleChapterChange = (newChapter: number) => {
    setCurrentChapter(newChapter);
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
            contextBlocks[currentChapter]?.map((block) => (
              <ContentBlock
                key={block.id}
                block={block}
                resources={resources}
                onBlockUpdate={handleBlockUpdate}
                onOrderChange={handleBlockOrderChange}
                isSelected={selectedBlocks.has(block.id)}
                onSelect={handleBlockSelect}
              />
            ))
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