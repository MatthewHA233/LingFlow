import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { X, Send, Trash2, Eye, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectedWord } from './AnchorWordBlock';
import { WordExplainer } from './WordExplainer';
import { useWordCollector, WordExplanation } from './WordCollector';
import { toast } from 'sonner';

interface WordCloudSidebarProps {
  selectedWords: SelectedWord[];
  isOpen: boolean;
  onClose: () => void;
  onWordsChange: (words: SelectedWord[]) => void;
  isAnchorMode?: boolean;
  currentBlocks?: Array<{
    id: string;
    block_type: string;
    content: string;
    original_content?: string;
  }>; // 所有处于锚定模式的语境块
}

export function WordCloudSidebar({
  selectedWords,
  isOpen,
  onClose,
  onWordsChange,
  isAnchorMode = true,
  currentBlocks
}: WordCloudSidebarProps) {
  
  const [showWordExplainer, setShowWordExplainer] = useState(false);
  const [isCollectingAnimation, setIsCollectingAnimation] = useState(false);
  const [wordExplanations, setWordExplanations] = useState<Map<string, WordExplanation>>(new Map());
  const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
  const [hasExplanations, setHasExplanations] = useState(false);
  const [fullExplanationContent, setFullExplanationContent] = useState<string>(''); // 保存完整的解释内容

  // 使用词汇收集器
  const { collectWords } = useWordCollector({
    selectedWords,
    currentBlocks,
    onExplanationUpdate: (explanations) => {
      setWordExplanations(explanations);
    },
    onFullContentUpdate: (content) => {
      setFullExplanationContent(content);
      setHasExplanations(true);
    },
    onLoadingChange: (loading) => {
      setIsLoadingExplanations(loading);
      setIsCollectingAnimation(loading);
    }
  });

  // 统计信息
  const stats = useMemo(() => {
    const wordCount = selectedWords.filter(w => w.type === 'word').length;
    const phraseCount = selectedWords.filter(w => w.type === 'phrase').length;
    return { wordCount, phraseCount, total: selectedWords.length };
  }, [selectedWords]);

  // 移除单个词
  const removeWord = (wordId: string) => {
    const newWords = selectedWords.filter(w => w.id !== wordId);
    onWordsChange(newWords);
    // 同时移除对应的解释
    setWordExplanations(prev => {
      const newMap = new Map(prev);
      newMap.delete(wordId);
      return newMap;
    });
  };

  // 清空所有词
  const clearAllWords = () => {
    onWordsChange([]);
    setWordExplanations(new Map());
    setHasExplanations(false);
    setFullExplanationContent('');
  };

  // 处理收集词汇
  const handleCollectWords = async () => {
    if (selectedWords.length === 0) return;
    
    try {
      await collectWords();
    } catch (error) {
      console.error('收集词汇失败:', error);
      toast.error('收集词汇失败');
    }
  };

  // 处理查看详情 - 直接展示已有内容
  const handleViewDetails = () => {
    setShowWordExplainer(true);
  };

  // 处理解释完成
  const handleExplainComplete = (explanation: string) => {
    console.log('词汇解释完成:', explanation);
  };

  // 渲染标签式词汇列表
  const renderTagView = () => (
    <div className="space-y-3">
      {/* 单词区域 */}
      {stats.wordCount > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">单词 ({stats.wordCount})</div>
          <div className="flex flex-wrap gap-2">
            {selectedWords
              .filter(w => w.type === 'word')
              .sort((a, b) => a.startIndex - b.startIndex) // 按原文顺序排序
              .map((word) => {
                const explanation = wordExplanations.get(word.id);
                return (
                  <motion.div
                    key={word.id}
                    className="group relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md text-sm transition-all hover:bg-blue-200/80">
                      <span>{word.text}</span>
                      <button
                        onClick={() => removeWord(word.id)}
                        className="opacity-0 group-hover:opacity-100 w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-all"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                    {/* 解释文本 */}
                    {explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-blue-50/50 dark:bg-blue-950/30 rounded text-xs text-blue-600 dark:text-blue-400"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ delay: 0.1 }}
                      >
                        {explanation.meaning}
                      </motion.div>
                    )}
                    {/* 加载状态 */}
                    {isLoadingExplanations && !explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-blue-50/50 dark:bg-blue-950/30 rounded text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        解释中...
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* 短语区域 */}
      {stats.phraseCount > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">短语 ({stats.phraseCount})</div>
          <div className="flex flex-wrap gap-2">
            {selectedWords
              .filter(w => w.type === 'phrase')
              .sort((a, b) => a.startIndex - b.startIndex) // 按原文顺序排序
              .map((word) => {
                const explanation = wordExplanations.get(word.id);
                return (
                  <motion.div
                    key={word.id}
                    className="group relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100/70 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md text-sm transition-all hover:bg-purple-200/80">
                      <span>{word.text}</span>
                      <button
                        onClick={() => removeWord(word.id)}
                        className="opacity-0 group-hover:opacity-100 w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-all"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                    {/* 解释文本 */}
                    {explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-purple-50/50 dark:bg-purple-950/30 rounded text-xs text-purple-600 dark:text-purple-400"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ delay: 0.1 }}
                      >
                        {explanation.meaning}
                      </motion.div>
                    )}
                    {/* 加载状态 */}
                    {isLoadingExplanations && !explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-purple-50/50 dark:bg-purple-950/30 rounded text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        解释中...
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {selectedWords.length === 0 && (
        <div className="text-center py-8 text-muted-foreground/60">
          <div className="text-sm">还没有选择任何词汇</div>
          <div className="text-xs mt-1">在左侧文本中选择单词或短语</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 遮罩层 - 只在非锚定模式下显示 */}
            {!isAnchorMode && (
              <motion.div
                className="fixed inset-0 bg-black/20 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
              />
            )}
            
            {/* 侧边栏 */}
            <motion.div
              className="fixed right-0 top-0 h-full w-80 bg-card/95 backdrop-blur border-l shadow-xl z-50 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            >
              {/* 头部 */}
              <div className="p-3 border-b bg-gradient-to-r from-blue-50/60 to-purple-50/60 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-sm"></div>
                    <h3 className="font-semibold text-sm">智能词锚点建立</h3>
                  </div>
                  {!isAnchorMode && (
                    <button
                      onClick={onClose}
                      className="p-1 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                
                {/* 统计和控制 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>共 {stats.total}</span>
                    {currentBlocks && currentBlocks.length > 0 && (
                      <span>语境块 {currentBlocks.length}</span>
                    )}
                  </div>
                  
                  {/* 清空按钮 */}
                  {selectedWords.length > 0 && (
                    <button
                      onClick={clearAllWords}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                      title="清空所有词汇"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* 主体内容 */}
              <div className="flex-1 p-3 overflow-y-auto space-y-4">
                {/* 词汇标签区域 */}
                <AnimatePresence mode="popLayout">
                  {renderTagView()}
                </AnimatePresence>
                
                {/* 加载状态 */}
                {isLoadingExplanations && (
                  <motion.div
                    className="flex items-center justify-center py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <div className="text-xs text-muted-foreground">正在解释词汇...</div>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {/* 底部操作区域 */}
              <div className="p-3 border-t space-y-2">
                {/* 查看详情按钮 - 只在有解释结果时显示 */}
                {hasExplanations && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleViewDetails}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      查看详情
                    </button>
                  </div>
                )}
                
                {/* 收集按钮 */}
                {selectedWords.length > 0 && (
                  <motion.button
                    onClick={handleCollectWords}
                    disabled={isCollectingAnimation || isLoadingExplanations}
                    className={cn(
                      "w-full py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2",
                      isCollectingAnimation || isLoadingExplanations
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-sm hover:shadow-md"
                    )}
                    whileHover={{ scale: isCollectingAnimation ? 1 : 1.02 }}
                    whileTap={{ scale: isCollectingAnimation ? 1 : 0.98 }}
                  >
                    {isCollectingAnimation ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Send className="w-4 h-4" />
                        </motion.div>
                        收集中...
                      </>
                    ) : hasExplanations ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        重新收集
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        收集 ({selectedWords.length})
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 词汇解释器组件 - 详细版 */}
      <WordExplainer
        selectedWords={selectedWords}
        isOpen={showWordExplainer}
        onClose={() => setShowWordExplainer(false)}
        onExplainComplete={handleExplainComplete}
        currentBlocks={currentBlocks}
        existingContent={fullExplanationContent}
      />
    </>
  );
} 