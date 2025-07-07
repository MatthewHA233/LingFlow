import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Loader2, X, ChevronDown, ArrowDownToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranslationService } from '@/lib/services/translation-service';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { supabase } from '@/lib/supabase-client';

// LLM模型接口
interface LLMModel {
  id: string;
  provider: string;
  name: string;
  displayName: string;
  description: string;
  iconSrc: string;
  maxTokens: number;
  temperature: number;
}

// 默认可用模型列表
const DEFAULT_MODELS: LLMModel[] = [
  {
    id: 'gemini-2.5-flash',
    provider: 'mnapi',
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Google快速响应模型',
    iconSrc: '/icons/gemini-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'claude-sonnet-4',
    provider: 'mnapi',
    name: 'claude-sonnet-4',
    displayName: 'Claude Sonnet 4',
    description: 'Anthropic最新一代高性能模型',
    iconSrc: '/icons/anthropic-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'deepseek-v3',
    provider: 'mnapi',
    name: 'deepseek-v3',
    displayName: 'DeepSeek V3',
    description: '性能强大的多语言模型',
    iconSrc: '/icons/deepseek-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'gpt-4o',
    provider: 'mnapi',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'OpenAI顶级多模态大语言模型',
    iconSrc: '/icons/openai-logo.svg',
    maxTokens: 8192,
    temperature: 0.7
  }
];

// 简化的模型选择器组件
interface ModelSelectorProps {
  models: LLMModel[];
  selectedModel: LLMModel;
  onSelect: (model: LLMModel) => void;
  onClose: () => void;
}

function SimpleModelSelector({ models, selectedModel, onSelect, onClose }: ModelSelectorProps) {
  return (
    <div className="p-2 w-[200px] max-w-[90vw]">
      <div className="space-y-1">
        {models.map(model => (
          <div
            key={model.id}
            className={`p-1.5 rounded-md cursor-pointer transition-all duration-200 ${
              selectedModel.id === model.id
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-accent border border-transparent'
            }`}
            onClick={() => onSelect(model)}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-1.5">
                <Image 
                  src={model.iconSrc} 
                  alt={model.provider} 
                  width={14} 
                  height={14} 
                  className="w-3.5 h-3.5 rounded-full"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <h4 className="text-xs font-medium truncate">{model.displayName}</h4>
                  {model.id === selectedModel.id && (
                    <div className="w-1.5 h-1.5 bg-primary rounded-full ml-1.5 flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TranslationPanelProps {
  blockId: string;
  originalContent: string;
  blockType: string;
  onClose: () => void;
  initialTranslation?: string;
  className?: string;
}

export function TranslationPanel({
  blockId,
  originalContent,
  blockType,
  onClose,
  initialTranslation = '',
  className
}: TranslationPanelProps) {
  const [translationContent, setTranslationContent] = useState(initialTranslation);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isBatchInserting, setIsBatchInserting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODELS[0]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [availableModels] = useState<LLMModel[]>(DEFAULT_MODELS);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 从浏览器缓存加载选择的模型
  useEffect(() => {
    const savedModel = localStorage.getItem('translationPanel_selectedModel');
    if (savedModel) {
      try {
        const parsedModel = JSON.parse(savedModel);
        const foundModel = availableModels.find(m => m.id === parsedModel.id);
        if (foundModel) {
          setSelectedModel(foundModel);
        }
      } catch (error) {
        console.error('加载保存的模型失败:', error);
      }
    }
  }, [availableModels]);

  // 保存选择的模型到浏览器缓存
  const saveModelToCache = (model: LLMModel) => {
    localStorage.setItem('translationPanel_selectedModel', JSON.stringify(model));
  };

  // 处理模型选择
  const handleModelSelect = (model: LLMModel) => {
    setSelectedModel(model);
    saveModelToCache(model);
    setShowModelSelector(false);
    toast.success(`已切换到 ${model.displayName}`);
  };

  // 加载翻译内容
  useEffect(() => {
    const loadTranslation = async () => {
      if (initialTranslation) {
        setTranslationContent(initialTranslation);
        return;
      }

      setIsLoading(true);
      try {
        const result = await TranslationService.getTranslation(blockId);
        if (result.success && result.data?.translation_content) {
          setTranslationContent(result.data.translation_content);
        }
      } catch (error) {
        console.error('加载翻译内容失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslation();
  }, [blockId, initialTranslation]);

  // 自动调整文本域高度
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = window.innerHeight * 0.6;
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);

  // 处理内容变化
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setTranslationContent(newContent);
    setHasUnsavedChanges(true);
    
    // 自动调整高度
    adjustTextareaHeight();
    
    // 防抖保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave(newContent);
    }, 1000);
  }, []);

  // 自动保存
  const handleAutoSave = useCallback(async (content: string) => {
    if (!content.trim() && !translationContent.trim()) return;
    
    try {
      const result = await TranslationService.updateTranslation({
        blockId,
        content: content.trim(),
        status: 'completed',
        metadata: {
          block_type: blockType,
          auto_saved: true,
          saved_at: new Date().toISOString()
        }
      });

      if (result.success) {
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('保存翻译异常:', error);
    }
  }, [blockId, blockType, translationContent]);

  // AI翻译功能
  const handleAITranslate = useCallback(async () => {
    if (!originalContent.trim()) {
      toast.error('原文内容为空，无法进行翻译');
      return;
    }

    setIsTranslating(true);
    try {
      // 获取用户认证token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('用户未登录，无法使用AI翻译');
        return;
      }

      // 构建翻译提示词
      const blockTypeLabel = blockType === 'heading_1' ? '一级标题' : 
                           blockType === 'heading_2' ? '二级标题' : 
                           blockType === 'heading_3' ? '三级标题' : 
                           blockType === 'heading_4' ? '四级标题' : '文本';
      
      const prompt = `请将以下${blockTypeLabel}翻译成中文，保持原文的语气和风格：

${originalContent}

要求：
1. 翻译要准确、自然、流畅
2. 保持原文的语气和风格
3. 如果是标题，翻译后仍要保持标题的简洁性
4. 只返回翻译结果，不要添加任何解释或说明`;

      // 调用LLM API
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          provider: selectedModel.provider,
          modelName: selectedModel.name,
          prompt: prompt,
          temperature: selectedModel.temperature,
          maxTokens: selectedModel.maxTokens
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '翻译请求失败');
      }

      const result = await response.json();
      
      if (result.text) {
        const translatedText = result.text.trim();
        setTranslationContent(translatedText);
        setHasUnsavedChanges(true);
        
        // 自动调整高度
        setTimeout(() => {
          adjustTextareaHeight();
        }, 100);
        
        // 自动保存翻译结果
        setTimeout(() => {
          handleAutoSave(translatedText);
        }, 500);
        
        toast.success('AI翻译完成');
      } else {
        throw new Error('翻译结果为空');
      }
    } catch (error) {
      console.error('AI翻译失败:', error);
      toast.error('AI翻译失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsTranslating(false);
    }
  }, [originalContent, blockType, selectedModel, handleAutoSave, adjustTextareaHeight]);

  // 批量插入翻译到后续语境块
  const handleBatchInsert = useCallback(async () => {
    if (!translationContent.trim()) {
      toast.error('翻译内容为空');
      return;
    }
    
    setIsBatchInserting(true);
    try {
      // 按段落分割翻译内容
      const paragraphs = translationContent
        .split(/\n+/)  // 按一个或多个换行分割段落
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      if (paragraphs.length <= 1) {
        toast.error('需要至少两个段落才能进行批量分配');
        return;
      }

      // 获取当前块的信息
      const { data: currentBlock, error: currentBlockError } = await supabase
        .from('context_blocks')
        .select('order_index, parent_id')
        .eq('id', blockId)
        .single();

      if (currentBlockError || !currentBlock) {
        throw new Error('获取当前块信息失败');
      }

      // 获取同一父级下的后续块
      const { data: nextBlocks, error: nextBlocksError } = await supabase
        .from('context_blocks')
        .select('id, order_index, translation_content')
        .eq('parent_id', currentBlock.parent_id)
        .gt('order_index', currentBlock.order_index)
        .order('order_index', { ascending: true })
        .limit(paragraphs.length - 1); // 减1因为第一段留给当前块

      if (nextBlocksError) {
        throw new Error('获取后续块失败');
      }

      if (!nextBlocks || nextBlocks.length === 0) {
        toast.error('没有找到后续的语境块');
        return;
      }

      // 第一段：更新当前块（只保留第一段）
      const firstParagraph = paragraphs[0];
      const currentBlockResult = await TranslationService.updateTranslation({
        blockId: blockId,
        content: firstParagraph,
        status: 'completed',
        metadata: {
          batch_split: true,
          original_content: translationContent,
          split_at: new Date().toISOString(),
          paragraph_index: 0
        }
      });

      if (!currentBlockResult.success) {
        throw new Error('更新当前块失败');
      }

      // 更新界面上的翻译内容为第一段
      setTranslationContent(firstParagraph);
      setHasUnsavedChanges(false);

      // 后续段落：分配给后续的语境块
      const remainingParagraphs = paragraphs.slice(1); // 从第二段开始
      const blocksToUpdate = nextBlocks.slice(0, remainingParagraphs.length);
      let successCount = 1; // 当前块已经成功
      let failCount = 0;

      for (let i = 0; i < blocksToUpdate.length; i++) {
        const block = blocksToUpdate[i];
        const paragraph = remainingParagraphs[i];
        
        try {
          const result = await TranslationService.updateTranslation({
            blockId: block.id,
            content: paragraph,
            status: 'completed',
            metadata: {
              batch_inserted: true,
              source_block_id: blockId,
              inserted_at: new Date().toISOString(),
              paragraph_index: i + 1 // +1因为第一段是0
            }
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            console.error(`更新块 ${block.id} 失败:`, result.error);
          }
        } catch (error) {
          failCount++;
          console.error(`更新块 ${block.id} 异常:`, error);
        }
      }

      if (successCount > 1) {
        toast.success(`成功分配翻译内容：当前块保留第一段，${successCount - 1} 个后续块获得新翻译${failCount > 0 ? `，${failCount} 个失败` : ''}`);
        
        // 构建详细的更新数据
        const detailedUpdates = [
          // 当前块的更新
          {
            blockId: blockId,
            translationData: {
              translation_content: firstParagraph,
              translation_status: 'completed',
              translation_metadata: {
                batch_split: true,
                original_content: translationContent,
                split_at: new Date().toISOString(),
                paragraph_index: 0
              },
              translation_updated_at: new Date().toISOString()
            }
          },
          // 后续块的更新
          ...blocksToUpdate.slice(0, successCount - 1).map((block, index) => ({
            blockId: block.id,
            translationData: {
              translation_content: remainingParagraphs[index],
              translation_status: 'completed',
              translation_metadata: {
                batch_inserted: true,
                source_block_id: blockId,
                inserted_at: new Date().toISOString(),
                paragraph_index: index + 1
              },
              translation_updated_at: new Date().toISOString()
            }
          }))
        ];
        
        // 触发缓存批量更新事件
        window.dispatchEvent(new CustomEvent('translation-batch-updated', {
          detail: { 
            updates: detailedUpdates,
            sourceBlockId: blockId,
            successCount,
            failCount,
            splitMode: true
          }
        }));
      } else {
        toast.error('只有当前块更新成功，后续块分配都失败了');
      }

    } catch (error) {
      console.error('批量插入翻译失败:', error);
      toast.error('批量插入翻译失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsBatchInserting(false);
    }
  }, [blockId, translationContent]);

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      TranslationService.cancelPendingSave(blockId);
    };
  }, [blockId]);

  // 初始化时调整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, translationContent]);

  return (
    <div className={cn(
      'group relative my-1 p-2 rounded-md border transition-all duration-300',
      'bg-primary/5 border-primary/20',
      'hover:bg-primary/10',
      'h-full flex flex-col',
      className
    )}>
      {/* 顶部标签 */}
      <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-0.5 bg-background text-[14px] font-medium text-muted-foreground">
        翻译
      </div>
      
      {/* 右上角操作按钮组 */}
      <div className="absolute right-2 top-2 flex space-x-1">
        {/* 批量插入翻译按钮 */}
        <button
          onClick={handleBatchInsert}
          disabled={!translationContent.trim() || isBatchInserting}
          className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors disabled:opacity-30"
          title="批量插入翻译到后续块"
        >
          {isBatchInserting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ArrowDownToLine className="h-3 w-3" />
          )}
        </button>
        
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-muted/80 text-muted-foreground hover:text-primary transition-colors"
          title="关闭"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      
      {/* 内容部分 */}
      <div className="pl-6 pt-3 flex-grow overflow-auto">
        <div className="py-2 px-3 text-sm leading-relaxed h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none h-full">
              <textarea
                ref={textareaRef}
                value={translationContent}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder="输入翻译内容..."
                className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed focus:outline-none placeholder:text-muted-foreground/60 whitespace-pre-wrap"
                style={{ 
                  minHeight: '120px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 右下角按钮组 */}
      <div className="absolute bottom-2 right-2 flex items-center space-x-1">
        {/* AI翻译按钮 */}
        <button
          onClick={handleAITranslate}
          disabled={isTranslating || !originalContent.trim()}
          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTranslating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          <span className="text-xs">{isTranslating ? '翻译中...' : 'AI翻译'}</span>
        </button>

        {/* 模型选择器 */}
        <div className="relative">
          <div 
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-muted/50 border border-border rounded cursor-pointer hover:bg-muted transition-colors"
          >
            <Image 
              src={selectedModel.iconSrc} 
              alt={selectedModel.provider} 
              width={12}
              height={12} 
              className="w-3 h-3 rounded-full"
            />
            <span className="text-xs text-muted-foreground">{selectedModel.displayName}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>
          
          {/* 模型选择弹出窗 */}
          <AnimatePresence>
            {showModelSelector && (
              <>
                <motion.div
                  className="fixed inset-0 z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowModelSelector(false)}
                />
                <motion.div
                  className="absolute right-0 bottom-full mb-1 z-20 bg-popover border border-border rounded-lg shadow-lg"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                >
                  <SimpleModelSelector
                    models={availableModels}
                    selectedModel={selectedModel}
                    onSelect={handleModelSelect}
                    onClose={() => setShowModelSelector(false)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 