'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { SelectedWord } from './AnchorWordBlock';
import { X, Bot, Copy, Check, BookOpen, ChevronDown } from 'lucide-react';

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
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'mnapi',
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Google快速响应模型',
    iconSrc: '/icons/gemini-logo.svg',
    maxTokens: 4096,
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
    <div className="p-2 w-[260px] max-w-[90vw]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-white">选择AI模型</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white h-4 w-4 flex items-center justify-center"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      
      <div className="space-y-1">
        {models.map(model => (
          <div
            key={model.id}
            className={`p-2 rounded-md cursor-pointer transition-all duration-200 ${
              selectedModel.id === model.id
                ? 'bg-blue-600/20 border border-blue-500/30'
                : 'hover:bg-white/5 border border-transparent'
            }`}
            onClick={() => onSelect(model)}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-2">
                <Image 
                  src={model.iconSrc} 
                  alt={model.provider} 
                  width={16} 
                  height={16} 
                  className="w-4 h-4 rounded-full"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <h4 className="text-xs font-medium text-white truncate">{model.displayName}</h4>
                  {model.id === selectedModel.id && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-gray-400 leading-tight truncate">{model.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WordExplainerProps {
  selectedWords: SelectedWord[];
  isOpen: boolean;
  onClose: () => void;
  onExplainComplete?: (explanation: string) => void;
  currentBlocks?: Array<{
    id: string;
    block_type: string;
    content: string;
    original_content?: string;
  }>; // 所有处于锚定模式的语境块
  existingContent?: string; // 已有的完整解释内容，如果提供则不重新请求
  processingLogs?: Array<{
    word: string;
    type: 'anchor_creation' | 'meaning_duplicate_check';
    log: any;
    timestamp: Date;
  }>; // LLM处理日志
}

interface ExplanationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function WordExplainer({ 
  selectedWords, 
  isOpen, 
  onClose, 
  onExplainComplete, 
  currentBlocks,
  existingContent = '',
  processingLogs = []
}: WordExplainerProps) {
  // 生成消息ID
  const generateId = () => Math.random().toString(36).substring(2, 11);

  // 状态管理
  const [messages, setMessages] = useState<ExplanationMessage[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODELS[0]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [availableModels] = useState<LLMModel[]>(DEFAULT_MODELS);

  // 引用
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 从浏览器缓存加载选择的模型
  useEffect(() => {
    const savedModel = localStorage.getItem('wordExplainer_selectedModel');
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
    localStorage.setItem('wordExplainer_selectedModel', JSON.stringify(model));
  };

  // 处理模型选择
  const handleModelSelect = (model: LLMModel) => {
    setSelectedModel(model);
    saveModelToCache(model);
    setShowModelSelector(false);
    toast.success(`已切换到 ${model.displayName}`);
  };

  // 初始化消息
  useEffect(() => {
    if (isOpen) {
      if (existingContent) {
        // 构建发送的完整内容
        const contextContent = buildContextContent();
        const wordsList = buildWordsList();
        const fullUserMessage = contextContent ? `${contextContent}\n${wordsList}` : wordsList;
        
        // 如果有现成的内容，直接显示
        const initialMessages: ExplanationMessage[] = [
          {
            id: generateId(),
            role: 'user',
            content: fullUserMessage,
            timestamp: new Date()
          },
          {
            id: generateId(),
            role: 'assistant',
            content: existingContent,
            timestamp: new Date()
          }
        ];

        // 如果有处理日志，添加独立的对话消息
        if (processingLogs && processingLogs.length > 0) {
          // 过滤出真正进行了重复检测的词汇（即有existingMeanings且不是空数组，或者有parsedResult的）
          const duplicateCheckLogs = processingLogs.filter(logEntry => 
            (logEntry.log.existingMeanings && logEntry.log.existingMeanings.length > 0) ||
            logEntry.log.parsedResult ||
            (logEntry.log.decision && logEntry.log.decision.includes('LLM判断'))
          );
          
          // 按词汇去重，确保每个词汇只显示一次重复检测过程
          const uniqueWords = new Map<string, typeof duplicateCheckLogs[0]>();
          duplicateCheckLogs.forEach(logEntry => {
            const word = logEntry.word;
            if (!uniqueWords.has(word)) {
              uniqueWords.set(word, logEntry);
            }
          });
          
          const uniqueDuplicateCheckLogs = Array.from(uniqueWords.values());
          
          if (uniqueDuplicateCheckLogs.length > 0) {
            // 添加说明消息
            initialMessages.push({
              id: generateId(),
              role: 'assistant',
              content: `## 🤖 AI含义重复检测过程\n\n检测到 ${uniqueDuplicateCheckLogs.length} 个词汇需要进行重复检测：`,
              timestamp: new Date()
            });
            
            // 为每个需要检测的词汇添加独立的对话
            uniqueDuplicateCheckLogs.forEach((logEntry) => {
              // 用户问题
              initialMessages.push({
                id: generateId(),
                role: 'user',
                content: `检测「${logEntry.word}」的新含义是否与现有含义重复`,
                timestamp: new Date()
              });
              
              // AI回答
              let aiResponse = '';
              if (logEntry.log.parsedResult) {
                const result = logEntry.log.parsedResult;
                const isDuplicate = result.isDuplicate || result.is_duplicate || result.isRedundant;
                const reason = result.reason || result.explanation || '未提供理由';
                
                // 添加调试日志
                console.log('判断结果调试:', {
                  word: logEntry.word,
                  isDuplicate,
                  result,
                  reason
                });
                
                if (isDuplicate) {
                  aiResponse = `✅ **判断为重复含义**\n\n💭 ${reason}\n\n🔄 **处理方式：** 合并到现有含义块，新例句追加到例句列表中`;
                } else {
                  aiResponse = `❌ **判断为不同含义**\n\n💭 ${reason}\n\n➕ **处理方式：** 创建新的含义块`;
                }
              } else {
                const isLikelyDuplicate = logEntry.log.decision?.includes('重复') || 
                                        logEntry.log.decision?.includes('合并');
                aiResponse = `${isLikelyDuplicate ? '✅' : '❌'} ${logEntry.log.decision}`;
              }
              
              initialMessages.push({
                id: generateId(),
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
              });
            });
          } else {
            // 所有词汇都是新词汇 - 统计实际的新词汇数量
            const newWords = selectedWords.filter(word => !word.isExisting);
            const totalWords = newWords.length;
            initialMessages.push({
              id: generateId(),
              role: 'assistant',
              content: `## 📝 处理结果\n\n本次处理了 **${totalWords}** 个词汇，全部为新词汇，直接创建含义块。`,
              timestamp: new Date()
            });
          }
        }
        
        setMessages(initialMessages);
      } else {
        // 清空消息
        setMessages([]);
      }
    }
  }, [isOpen, existingContent, processingLogs]);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 复制消息内容
  const copyMessageContent = (message: ExplanationMessage) => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        setCopiedMessageId(message.id);
        setTimeout(() => setCopiedMessageId(null), 2000);
        toast.success('已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制失败:', err);
        toast.error('复制失败');
      });
  };

  // 构建上下文内容
  const buildContextContent = (): string => {
    if (!currentBlocks || currentBlocks.length === 0) {
      return '';
    }

    return currentBlocks.map(block => {
      if (block.block_type === 'audio' && block.original_content) {
        return block.original_content;
      } else if (block.block_type === 'text' && block.content) {
        return block.content;
      }
      return '';
    }).filter(content => content.trim() !== '').join('\n\n');
  };

  // 构建词汇列表
  const buildWordsList = (): string => {
    if (!selectedWords || selectedWords.length === 0) {
      return '';
    }

    // 按原文中的顺序排序
    const sortedWords = [...selectedWords].sort((a, b) => a.startIndex - b.startIndex);
    return sortedWords.map(word => word.text).join('、');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#0a0e14]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl max-h-[85vh] flex flex-col"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-blue-50/5 to-purple-50/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-sm flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold text-base text-white">词汇详细解释</h3>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 模型选择器 */}
              <div className="relative">
                <div 
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#111520]/70 border border-white/10 rounded-full cursor-pointer hover:bg-[#111520] hover:border-blue-500/30 transition-colors"
                >
                  <Image 
                    src={selectedModel.iconSrc} 
                    alt={selectedModel.provider} 
                    width={16}
                    height={16} 
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="text-xs text-gray-300">{selectedModel.displayName}</span>
                  <ChevronDown className="h-3 w-3 text-gray-400" />
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
                        className="absolute right-0 top-full mt-2 z-20 bg-[#0a0e14]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl"
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
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
              
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 主体内容 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-custom">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-medium text-white mb-3">详细词汇解释</h2>
                <p className="text-sm text-gray-400 max-w-md">
                  选择的词汇: {buildWordsList()}
                </p>
                <p className="text-sm text-gray-400 max-w-md mt-2">
                  使用 {selectedModel.displayName} 进行解释
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={message.id} className={`animate-fade-in ${index > 0 ? 'mt-4' : ''}`}>
                  <div className={`flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center mb-2">
                      {message.role === 'user' ? (
                        <div className="flex items-center text-blue-400">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-xs text-white font-medium">你</span>
                          </div>
                          <span className="ml-2 text-sm font-medium">发送的内容</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-purple-400">
                          <div className="w-7 h-7 flex items-center justify-center">
                            <Image 
                              src={selectedModel.iconSrc}
                              alt="AI"
                              width={20}
                              height={20}
                              className="w-6 h-6 rounded-full"
                            />
                          </div>
                          <span className="ml-2 text-sm font-medium">AI助手</span>
                          <span className="ml-2 text-xs text-gray-500">
                            使用{selectedModel.displayName}
                          </span>
                        </div>
                      )}
                      
                      {message.role === 'assistant' && (
                        <button
                          className="ml-3 text-gray-500 hover:text-gray-300 focus:outline-none"
                          onClick={() => copyMessageContent(message)}
                          title="复制到剪贴板"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    <div className="max-w-[85%]">
                      {message.role === 'user' ? (
                        <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-3 rounded-xl rounded-tr-sm text-white shadow-md">
                          <div className="prose prose-invert prose-sm max-w-none text-sm whitespace-pre-wrap">
                            {message.content}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#15192a] px-4 py-3 rounded-xl rounded-tl-sm text-white shadow-md">
                          <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 底部信息 */}
          {selectedWords.length > 0 && (
            <div className="p-4 border-t border-white/10 bg-[#111520]/30">
              <div className="text-xs text-gray-400">
                <div className="mb-1">
                  <span className="font-medium">选中词汇:</span> {buildWordsList()}
                </div>
                {currentBlocks && currentBlocks.length > 0 && (
                  <div>
                    <span className="font-medium">语境块:</span> {currentBlocks.length} 个
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 