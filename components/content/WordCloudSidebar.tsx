import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { X, Cloud, Send, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectedWord } from './AnchorWordBlock';

interface WordCloudSidebarProps {
  selectedWords: SelectedWord[];
  isOpen: boolean;
  onClose: () => void;
  onWordsChange: (words: SelectedWord[]) => void;
  onCollectWords: (words: SelectedWord[]) => void;
  isCollecting?: boolean;
  isAnchorMode?: boolean;
}

// 流式布局算法 - 从左上到右下有序排列
const generateFlowLayout = (words: SelectedWord[]) => {
  const positions: Array<{word: SelectedWord, x: number, y: number, size: number}> = [];
  const container = { width: 300, height: 240 };
  
  // 统一的小尺寸
  const baseSize = 12;
  const maxSize = 16;
  
  // 计算词频权重（简化版）
  const wordFrequencies = new Map<string, number>();
  words.forEach(word => {
    const key = word.text.toLowerCase();
    wordFrequencies.set(key, (wordFrequencies.get(key) || 0) + 1);
  });
  
  // 计算大小分数（范围更小）
  const getSizeScore = (word: SelectedWord) => {
    const frequency = wordFrequencies.get(word.text.toLowerCase()) || 1;
    const lengthScore = Math.min(word.text.length, 8) / 8;
    const typeScore = word.type === 'phrase' ? 1.1 : 1;
    const frequencyScore = Math.min(frequency, 3) / 3;
    return (lengthScore * 0.3 + typeScore * 0.4 + frequencyScore * 0.3);
  };
  
  // 按重要性排序
  const sortedWords = [...words].sort((a, b) => {
    // 首先按类型排序：单词在前，短语在后
    if (a.type !== b.type) {
      return a.type === 'word' ? -1 : 1;
    }
    // 同类型内按在content中的出现顺序排序（startIndex）
    return a.startIndex - b.startIndex;
  });
  
  // 流式布局参数
  let currentX = 20; // 起始X位置
  let currentY = 25; // 起始Y位置
  const lineHeight = 22; // 行高
  const wordSpacing = 8; // 单词间距
  const maxWidth = container.width - 40; // 最大宽度（留边距）
  
  // 分离单词和短语
  const wordItems = sortedWords.filter(w => w.type === 'word');
  const phraseItems = sortedWords.filter(w => w.type === 'phrase');
  
  // 先处理单词
  wordItems.forEach((word, index) => {
    const sizeScore = getSizeScore(word);
    const fontSize = baseSize + (maxSize - baseSize) * sizeScore;
    
    // 估算单词宽度（更精确的计算）
    const estimatedWidth = word.text.length * fontSize * 0.6 + 12; // 加上padding
    
    // 检查是否需要换行
    if (currentX + estimatedWidth > maxWidth && currentX > 20) {
      currentX = 20; // 重置到行首
      currentY += lineHeight; // 移到下一行
    }
    
    positions.push({
      word,
      x: currentX + estimatedWidth/2, // 中心点X
      y: currentY, // 中心点Y
      size: fontSize
    });
    
    // 更新X位置到下一个单词
    currentX += estimatedWidth + wordSpacing;
  });
  
  // 短语区域开始 - 如果有单词，则在单词下方留一些空间
  if (wordItems.length > 0) {
    currentX = 20;
    currentY += lineHeight * 1.5; // 在单词和短语之间留更多空间
  }
  
  // 处理短语
  phraseItems.forEach((word, index) => {
    const sizeScore = getSizeScore(word);
    const fontSize = baseSize + (maxSize - baseSize) * sizeScore;
    
    // 估算单词宽度（更精确的计算）
    const estimatedWidth = word.text.length * fontSize * 0.6 + 12; // 加上padding
    
    // 检查是否需要换行
    if (currentX + estimatedWidth > maxWidth && currentX > 20) {
      currentX = 20; // 重置到行首
      currentY += lineHeight; // 移到下一行
    }
    
    // 确保不超出容器底部
    if (currentY + fontSize/2 > container.height - 20) {
      currentY = 25; // 重置到顶部（如果空间不够，重新开始）
      currentX = 20;
    }
    
    positions.push({
      word,
      x: currentX + estimatedWidth/2, // 中心点X
      y: currentY, // 中心点Y
      size: fontSize
    });
    
    // 更新X位置到下一个单词
    currentX += estimatedWidth + wordSpacing;
  });
  
  return positions;
};

export function WordCloudSidebar({
  selectedWords,
  isOpen,
  onClose,
  onWordsChange,
  onCollectWords,
  isCollecting = false,
  isAnchorMode = true
}: WordCloudSidebarProps) {
  
  // 生成流式布局
  const flowLayout = useMemo(() => {
    return generateFlowLayout(selectedWords);
  }, [selectedWords]);

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
  };

  // 清空所有词
  const clearAllWords = () => {
    onWordsChange([]);
  };

  // 渲染流式词云视图
  const renderFlowView = () => (
    <div className="relative h-60 word-cloud-container bg-gradient-to-br from-blue-50/60 to-purple-50/60 dark:from-slate-800/30 dark:to-slate-900/30 rounded-lg overflow-hidden border border-border/30">
      <AnimatePresence mode="popLayout">
        {flowLayout.map(({ word, x, y, size }, index) => (
          <motion.div
            key={word.id}
            className={cn(
              "absolute cursor-pointer select-none px-1 py-0.5 rounded-sm transition-all hover:shadow-sm group font-medium word-cloud-item",
              word.type === 'word' 
                ? "bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200/80" 
                : "bg-purple-100/70 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200/80"
            )}
            style={{
              left: x - 20,
              top: y - 8,
              fontSize: `${size}px`,
              transform: 'translate(-50%, -50%)',
              fontWeight: 500
            }}
            initial={{ 
              opacity: 0,
              scale: 0.8
            }}
            animate={{ 
              opacity: 1,
              scale: 1
            }}
            exit={{ 
              opacity: 0,
              scale: 0.8
            }}
            transition={{ 
              delay: index * 0.02, 
              duration: 0.3,
              ease: "easeOut"
            }}
            whileHover={{ 
              scale: 1.05, 
              zIndex: 10
            }}
            whileTap={{ scale: 0.95 }}
            title={`${word.text} (${word.type})`}
          >
            <span className="relative z-10">{word.text}</span>
            <motion.button
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] hover:bg-red-600"
              onClick={(e) => {
                e.stopPropagation();
                removeWord(word.id);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-1 h-1" />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {selectedWords.length === 0 && (
        <motion.div 
          className="absolute inset-0 flex items-center justify-center text-muted-foreground/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-center">
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                duration: 6,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Cloud className="w-6 h-6 mx-auto mb-2 opacity-30" />
            </motion.div>
            <p className="text-xs">还没有选择任何词汇</p>
            <p className="text-[10px] mt-0.5 opacity-60">在左侧文本中选择单词或短语</p>
          </div>
        </motion.div>
      )}
      
      {/* 流式网格背景效果 */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {/* 水平参考线 */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute w-full border-t border-blue-200/40 dark:border-blue-600/30"
            style={{
              top: `${15 + i * 12}%`,
            }}
          />
        ))}
        {/* 垂直参考线 */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute h-full border-l border-purple-200/30 dark:border-purple-600/20"
            style={{
              left: `${20 + i * 20}%`,
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
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
            className="fixed right-0 top-0 h-full w-72 bg-card/95 backdrop-blur border-l shadow-xl z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            style={{ pointerEvents: 'auto' }}
          >
            {/* 紧凑的头部 */}
            <div className="p-2.5 border-b bg-gradient-to-r from-blue-50/60 to-purple-50/60 dark:from-blue-950/20 dark:to-purple-950/20">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-sm">词锚点云图</h3>
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>共 {stats.total}</span>
                  <span>{stats.wordCount} 词</span>
                  <span>{stats.phraseCount} 短语</span>
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
            
            {/* 主体内容 - 流式词云 */}
            <div className="flex-1 p-2.5 overflow-hidden">
              {renderFlowView()}
            </div>
            
            {/* 紧凑的操作区域 - 为未来功能预留空间 */}
            <div className="p-2.5 space-y-2">
              {/* 收集按钮 */}
              {selectedWords.length > 0 && (
                <button
                  onClick={() => onCollectWords(selectedWords)}
                  disabled={isCollecting}
                  className={cn(
                    "w-full py-1.5 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1",
                    isCollecting
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-sm hover:shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
                  )}
                >
                  {isCollecting ? (
                    <>
                      <div className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      收集词锚点 ({selectedWords.length})
                    </>
                  )}
                </button>
              )}
              
              {/* 为未来功能预留的空间区域 */}
              <div className="h-16 bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-900/30 rounded-md border border-dashed border-slate-300/50 dark:border-slate-600/30 flex items-center justify-center">
                <p className="text-xs text-muted-foreground/60">功能扩展区域</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
} 