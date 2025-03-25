"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import Image from 'next/image';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import ReactMarkdown from 'react-markdown';

// 导入UI组件
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// 导入图标
import { 
  Send, 
  Bot, 
  User, 
  Settings, 
  Trash2, 
  Loader2, 
  Plus, 
  X, 
  Copy, 
  Check, 
  ChevronDown, 
  History,
  Brain,
  Menu,
  Star,
  PanelLeft
} from 'lucide-react';

// 导入子组件
import { ModelSelector } from './ModelSelector';
import { ChatOptions } from './ChatOptions';
import { ChatSidebar } from './ChatSidebar';

// 类型定义
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  isLoading?: boolean;
  reasoningContent?: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

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

interface ChatSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  defaultModelId: string;
}

// 更新默认模型列表
const DEFAULT_MODELS: LLMModel[] = [
  {
    id: 'deepseek-v3',
    provider: 'mnapi',
    name: 'deepseek-v3',
    displayName: 'DeepSeek V3',
    description: '性能强大的多语言模型，支持中英文对话',
    iconSrc: '/icons/deepseek-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'deepseek-r1',
    provider: 'mnapi',
    name: 'deepseek-r1',
    displayName: 'DeepSeek R1',
    description: '极佳的开源推理模型，支持中英文对话',
    iconSrc: '/icons/deepseek-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'gpt-4o',
    provider: 'mnapi',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'OpenAI最新的顶级多模态大语言模型',
    iconSrc: '/icons/openai-logo.svg',
    maxTokens: 8192,
    temperature: 0.7
  },
  {
    id: 'gpt-4o-mini',
    provider: 'mnapi',
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    description: 'OpenAI轻量级高性能模型，兼顾速度与性能',
    iconSrc: '/icons/openai-logo.svg',
    maxTokens: 8192,
    temperature: 0.7
  },
  {
    id: 'claude-3.5-sonnet',
    provider: 'mnapi',
    name: 'claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    description: 'Anthropic高性能模型',
    iconSrc: '/icons/anthropic-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'claude-3.7-sonnet',
    provider: 'mnapi',
    name: 'claude-3.7-sonnet',
    displayName: 'Claude 3.7 Sonnet',
    description: 'Anthropic最新一代高性能模型',
    iconSrc: '/icons/anthropic-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'claude-3.7-thinking',
    provider: 'mnapi',
    name: 'claude-3.7-thinking',
    displayName: 'Claude 3.7 Thinking',
    description: 'Anthropic带思考链模型，提供更详细推理过程',
    iconSrc: '/icons/anthropic-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'mnapi',
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: 'Google快速响应模型，速度与质量兼顾',
    iconSrc: '/icons/gemini-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'gemini-2.0-flash-thinking',
    provider: 'mnapi',
    name: 'gemini-2.0-flash-thinking',
    displayName: 'Gemini 2.0 Flash Thinking',
    description: 'Google带思考模式的快速响应模型',
    iconSrc: '/icons/gemini-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'gemini-2.0-pro',
    provider: 'mnapi',
    name: 'gemini-2.0-pro',
    displayName: 'Gemini 2.0 Pro',
    description: 'Google最强大的大语言模型',
    iconSrc: '/icons/gemini-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'command-r',
    provider: 'mnapi',
    name: 'command-r',
    displayName: 'command R',
    description: '响应速度极快，非常适合沉浸式翻译的模型',
    iconSrc: '/icons/cohere-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'grok-3',
    provider: 'mnapi',
    name: 'grok-3',
    displayName: 'Grok 3',
    description: 'xAI开发的新一代大语言模型',
    iconSrc: '/icons/grok-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'grok-3-deepsearch',
    provider: 'mnapi',
    name: 'grok-3-deepsearch',
    displayName: 'Grok 3 DeepSearch',
    description: 'Grok的深度搜索增强版本',
    iconSrc: '/icons/grok-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  },
  {
    id: 'grok-3-reasoner',
    provider: 'mnapi',
    name: 'grok-3-reasoner',
    displayName: 'Grok 3 Reasoner',
    description: 'Grok的增强推理版本，擅长逻辑思考',
    iconSrc: '/icons/grok-logo.svg',
    maxTokens: 4096,
    temperature: 0.7
  }
];

// 默认设置
const DEFAULT_SETTINGS: ChatSettings = {
  temperature: 0.7,
  maxTokens: 2000,
  systemPrompt: "你是一个专业的AI助手，提供准确、有用的回答。",
  defaultModelId: 'deepseek-v3',
};

export default function ChatWindow() {
  // 用户认证状态
  const { user, session } = useAuthStore();
  
  // 添加会话令牌缓存
  const [cachedToken, setCachedToken] = useState<string | null>(null);
  
  // 添加generateId函数，在组件内部可以被任何地方使用
  const generateId = () => Math.random().toString(36).substring(2, 11);
  
  // 在组件初始化时获取并缓存令牌
  useEffect(() => {
    if (session?.access_token && !cachedToken) {
      setCachedToken(session.access_token);
    }
  }, [session, cachedToken]);
  
  // 聊天状态
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  // 对话历史
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // UI状态
  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // LLM模型和设置
  const [availableModels] = useState<LLMModel[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODELS[0]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  
  // 引用
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatContainerRef] = useAutoAnimate<HTMLDivElement>();
  
  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current && autoScrollEnabled) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScrollEnabled]);
  
  // 添加一个运行时状态来跟踪用户是否刚刚手动选择了模型
  const [justManuallySelected, setJustManuallySelected] = useState(false);
  
  // 辅助函数：从消息中获取最后使用的模型
  const getLastModelUsedFromMessages = (messages: Message[]): string | null => {
    // 反向遍历消息找到最后一个带有model属性的助手消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.model) {
        return msg.model;
      }
    }
    return null;
  };
  
  // 修改载入历史消息的useEffect
  useEffect(() => {
    // 重置手动选择标记
    setJustManuallySelected(false);
    
    let hasLoadedHistory = false;
    const savedConversations = localStorage.getItem('chat_conversations');
    const savedCurrentId = localStorage.getItem('current_conversation_id');
    
    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations) as Conversation[];
        
        // 修复日期
        const fixedConversations = parsed.map(conv => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        
        setConversations(fixedConversations);
        
        // 如果有保存的当前对话ID，则加载该对话的消息
        if (savedCurrentId) {
          const currentConv = fixedConversations.find(c => c.id === savedCurrentId);
          if (currentConv) {
            setCurrentConversationId(savedCurrentId);
            setMessages(currentConv.messages);
            hasLoadedHistory = true;
            
            // 从消息中查找最后使用的模型
            const lastModelUsed = getLastModelUsedFromMessages(currentConv.messages);
            if (lastModelUsed) {
              const modelToUse = availableModels.find(m => m.name === lastModelUsed);
              if (modelToUse) {
                setSelectedModel(modelToUse);
                console.log('从历史对话恢复模型:', modelToUse.displayName);
              }
            }
          }
        }
        
        // 如果没有当前对话或找不到对应的对话，加载第一个对话
        if (!hasLoadedHistory && fixedConversations.length > 0) {
          setCurrentConversationId(fixedConversations[0].id);
          setMessages(fixedConversations[0].messages);
          hasLoadedHistory = true;
          
          // 从消息中查找最后使用的模型
          const lastModelUsed = getLastModelUsedFromMessages(fixedConversations[0].messages);
          if (lastModelUsed) {
            const modelToUse = availableModels.find(m => m.name === lastModelUsed);
            if (modelToUse) {
              setSelectedModel(modelToUse);
              console.log('从第一个对话恢复模型:', modelToUse.displayName);
            }
          }
        }
      } catch (e) {
        console.error('无法解析保存的对话历史:', e);
        localStorage.removeItem('chat_conversations');
        localStorage.removeItem('current_conversation_id');
      }
    }
    
    // 如果没有任何历史对话，显示欢迎消息并使用默认模型
    if (!hasLoadedHistory) {
      console.log('没有历史对话，显示欢迎消息，使用默认模型');
      setCurrentConversationId(null);
      
      // 对于全新对话，使用设置中的默认模型
      const defaultModel = availableModels.find(m => m.id === settings.defaultModelId);
      if (defaultModel && defaultModel.id !== selectedModel.id) {
        setSelectedModel(defaultModel);
      }
      
      // 确保设置了欢迎消息
      setMessages([{
        id: generateId(),
        role: 'assistant',
        content: `你好！我是基于${selectedModel.displayName}的AI助手。${settings.systemPrompt ? '我被指示：' + settings.systemPrompt : '有什么我可以帮助你的？'}`,
        timestamp: new Date()
      }]);
    }
  }, [availableModels, settings.defaultModelId, settings.systemPrompt]);
  
  // 修改切换对话的函数
  const switchConversation = (conversationId: string) => {
    if (conversationId === currentConversationId) {
      return; // 如果是当前对话,直接返回
    }

    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversationId(conversationId);
      setMessages(conversation.messages || []);
      localStorage.setItem('current_conversation_id', conversationId);
      
      // 只有在用户没有刚刚手动选择模型时，才从对话中加载模型
      if (!justManuallySelected) {
        const lastModelUsed = getLastModelUsedFromMessages(conversation.messages);
        if (lastModelUsed) {
          const modelToUse = availableModels.find(m => m.name === lastModelUsed);
          if (modelToUse) {
            console.log(`从对话加载模型: ${modelToUse.displayName}`);
            setSelectedModel(modelToUse);
          }
        }
      }
    }
  };
  
  // 修改创建新对话的函数
  const createNewConversation = () => {
    // 优先使用默认模型
    const modelToUse = availableModels.find(m => m.id === settings.defaultModelId) || selectedModel;

    // 设置要使用的模型
    setSelectedModel(modelToUse);
    
    const newConversationId = generateId();
    const newConversation: Conversation = {
      id: newConversationId,
      title: "新对话",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: generateId(),
          role: 'system',
          content: settings.systemPrompt,
          timestamp: new Date(),
        }
      ]
    };
    
    console.log("创建新对话:", newConversationId, "使用模型:", modelToUse.displayName);
    
    // 更新状态
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversationId);
    
    // 清空当前消息，然后设置系统消息
    setMessages(newConversation.messages);
    
    // 保存到localStorage
    const updatedConversations = [newConversation, ...conversations];
    localStorage.setItem('chat_conversations', JSON.stringify(updatedConversations));
    localStorage.setItem('current_conversation_id', newConversationId);
  };
  
  // 更新设置
  const updateSettings = (newSettings: ChatSettings) => {
    setSettings(newSettings);
    // 保存到 localStorage
    localStorage.setItem('chat_settings', JSON.stringify(newSettings));
  };
  
  // 复制消息内容
  const copyMessageContent = (message: Message) => {
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
  
  // 找出当前对话
  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

  // 修改保存对话函数
  const saveConversation = (conversation: Conversation) => {
    // 更新对话列表中的对话
    const updatedConversations = conversations.map(c => 
      c.id === conversation.id ? conversation : c
    );
    
    // 更新状态
    setConversations(updatedConversations);
    
    // 保存到本地存储
    localStorage.setItem('chat_conversations', JSON.stringify(updatedConversations));
    localStorage.setItem('current_conversation_id', conversation.id);
  };

  // 添加辅助函数获取模型信息
  const getModelIconByName = (modelName: string): string => {
    const model = availableModels.find(m => m.name === modelName);
    return model?.iconSrc || selectedModel.iconSrc;
  };

  const getModelDisplayName = (modelName: string): string => {
    const model = availableModels.find(m => m.name === modelName);
    return model?.displayName || selectedModel.displayName;
  };

  // 修复类型错误的正确方式
  const handleDeleteConversation = (id: string) => {
    // 从对话列表中删除指定ID的对话
    const updatedConversations = conversations.filter(c => c.id !== id);
    setConversations(updatedConversations);
    
    // 如果删除的是当前对话，需要切换到其他对话或清空当前对话
    if (id === currentConversationId) {
      if (updatedConversations.length > 0) {
        // 切换到列表中的第一个对话
        const newCurrentId = updatedConversations[0].id;
        setCurrentConversationId(newCurrentId);
        setMessages(updatedConversations[0].messages);
        localStorage.setItem('current_conversation_id', newCurrentId);
      } else {
        // 如果没有对话了，清空当前对话
        setCurrentConversationId(null);
        setMessages([]);
        localStorage.removeItem('current_conversation_id');
      }
    }
    
    // 更新本地存储
    localStorage.setItem('chat_conversations', JSON.stringify(updatedConversations));
  };

  // 调试辅助函数
  const logMessage = (tag: string, ...args: any[]) => {
    console.log(`[${tag}]`, ...args);
  };
  
  // 处理思维链内容的函数
  const processThinkTags = (content: string) => {
    if (!content || !content.includes('<think>')) {
      return { content, reasoning: '' };
    }
    
    try {
      // 创建内容副本
      let processedContent = content;
      let reasoning = '';
      
      // 逐个替换所有<think>内容
      while (processedContent.includes('<think>') && processedContent.includes('</think>')) {
        const startIdx = processedContent.indexOf('<think>');
        const endIdx = processedContent.indexOf('</think>');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          // 提取思维内容
          const thinkContent = processedContent.substring(startIdx + 7, endIdx);
          reasoning += thinkContent + '\n';
          
          // 从原内容中删除思维部分
          processedContent = 
            processedContent.substring(0, startIdx) + 
            processedContent.substring(endIdx + 8);
        } else {
          // 标签不匹配，退出循环
          break;
        }
      }
      
      // 清理可能存在的空白行
      processedContent = processedContent.trim();
      reasoning = reasoning.trim();
      
      logMessage('处理结果', { processedContent, reasoning });
      
      return {
        content: processedContent,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('解析思维链出错:', error);
      return { content, reasoning: '' };
    }
  };
  
  // 2. 简化handleStream函数，使其更可靠
  const handleStream = async (response: Response) => {
    if (!response.ok) throw new Error(`API响应错误: ${response.status}`);
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');
    
    const decoder = new TextDecoder('utf-8');
    
    try {
      // 跟踪累积的内容
      let accumulatedContent = '';
      let reasoningContent = '';
      let inThinkTag = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码流数据
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          
          try {
            // 解析JSON数据
            const jsonStr = line.slice(5);
            const data = JSON.parse(jsonStr);
            const chunk = data.text || '';
            
            // 从当前流块中处理思维链
            if (chunk.includes('<think>')) {
              inThinkTag = true;
              const startIndex = chunk.indexOf('<think>') + 7;
              reasoningContent += chunk.substring(startIndex);
              accumulatedContent += chunk.substring(0, chunk.indexOf('<think>'));
            } else if (chunk.includes('</think>')) {
              inThinkTag = false;
              const endIndex = chunk.indexOf('</think>');
              reasoningContent += chunk.substring(0, endIndex);
              accumulatedContent += chunk.substring(endIndex + 8);
            } else if (inThinkTag) {
              reasoningContent += chunk;
            } else {
              accumulatedContent += chunk;
            }
            
            // 直接更新消息
            setMessages(prev => {
              const updated = [...prev];
              const current = updated[updated.length - 1];
              current.content = accumulatedContent;
              current.reasoningContent = reasoningContent;
              return updated;
            });
          } catch (e) {
            console.error('解析流数据出错:', e, line);
          }
        }
      }
    } finally {
      reader.releaseLock();
      setIsLoading(false);
      
      // 清除所有loading状态并保存更新后的消息
      setMessages(prev => {
        const updated = [...prev];
        const current = updated[updated.length - 1];
        current.isLoading = false;
        
        // 更新对话历史中的消息并保存
        if (currentConversationId) {
          const updatedConversations = conversations.map(conv => {
            if (conv.id === currentConversationId) {
              return {
                ...conv,
                messages: updated,
                updatedAt: new Date()
              };
            }
            return conv;
          });
          
          setConversations(updatedConversations);
          localStorage.setItem('chat_conversations', JSON.stringify(updatedConversations));
          
          // 如果消息数量达到阈值，触发总结
          const currentConversation = updatedConversations.find(c => c.id === currentConversationId);
          if (currentConversation) {
            const userMessages = currentConversation.messages.filter(m => m.role === 'user');
            
            // 当用户消息达到2条且对话标题是默认的或包含"新对话"时触发总结
            if (
              userMessages.length >= 2 && 
              (currentConversation.title.includes('新对话') || 
               currentConversation.title === userMessages[0].content.substring(0, 25) + '...' ||
               currentConversation.title === userMessages[0].content)
            ) {
              // 异步触发总结，不阻塞UI
              setTimeout(() => {
                summarizeConversation(currentConversation.messages, currentConversationId);
              }, 500);
            }
          }
        }
        
        return updated;
      });
    }
  };
  
  // 发送消息
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const originalInput = inputText.trim(); // 保存原始输入
    
    // 如果没有当前对话，先创建一个
    if (!currentConversationId) {
      const newConvId = generateId();
      const newConversation: Conversation = {
        id: newConvId,
        title: inputText.length > 30 ? inputText.substring(0, 30) + '...' : inputText,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          {
            id: generateId(),
            role: 'system',
            content: settings.systemPrompt,
            timestamp: new Date()
          }
        ]
      };
      
      setCurrentConversationId(newConvId);
      setConversations([newConversation, ...conversations]);
      
      // 保存到本地存储
      localStorage.setItem('chat_conversations', JSON.stringify([newConversation, ...conversations]));
      localStorage.setItem('current_conversation_id', newConvId);
    }
    
    // 获取当前对话
    const conversationId = currentConversationId || conversations[0]?.id;
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation) return;
    
    // 创建用户消息和助手消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: originalInput,
      timestamp: new Date()
    };
    
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      model: selectedModel.name
    };
    
    // 更新消息状态
    setMessages(prevMessages => [...prevMessages, userMessage, assistantMessage]);
    
    // 更新对话历史
    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage, assistantMessage],
      updatedAt: new Date(),
      title: conversation.title === "新对话" || conversation.title.includes("新对话") ? 
        (userMessage.content.length > 25 ? 
          userMessage.content.substring(0, 25) + '...' : 
          userMessage.content) : 
        conversation.title
    };
    
    setConversations(prevConversations =>
      prevConversations.map(c => 
        c.id === currentConversationId ? updatedConversation : c
      )
    );
    
    // 保存到本地存储
    localStorage.setItem('chat_conversations', JSON.stringify(
      conversations.map(c => 
        c.id === currentConversationId ? updatedConversation : c
      )
    ));
    
    // 清空输入
    setInputText('');
    setIsLoading(true);
    
    try {
      // 使用缓存的令牌或当前会话令牌
      const tokenToUse = cachedToken || session?.access_token;
      
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({
          provider: selectedModel.provider,
          modelName: selectedModel.name,
          messages: [...conversation.messages, userMessage, assistantMessage].map(({ role, content }) => ({ role, content })),
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          stream: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '请求失败');
      }
      
      // 调用handleStream处理流式响应
      if (response.body) {
        await handleStream(response);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      
      // 回退到发送消息前的状态
      setMessages(prev => prev.slice(0, -2)); // 移除最后两条消息(用户消息和助手消息)
      setInputText(originalInput); // 恢复输入框内容
      setIsLoading(false);
      
      // 从对话历史中也移除这两条消息
      const revertedConversation = {
        ...conversation,
        messages: conversation.messages,
        updatedAt: new Date()
      };
      
      setConversations(prevConversations =>
        prevConversations.map(c => 
          c.id === currentConversationId ? revertedConversation : c
        )
      );
      
      // 更新本地存储
      localStorage.setItem('chat_conversations', JSON.stringify(
        conversations.map(c => 
          c.id === currentConversationId ? revertedConversation : c
        )
      ));
      
      // 显示简单的错误提示
      toast.error(error instanceof Error ? error.message : '发送消息失败');
    }
  };

  // 简化对话标题功能，直接使用最后一个用户问题
  const summarizeConversation = async (messages: Message[], conversationId: string) => {
    try {
      // 查找最后一个用户问题作为标题
      const userMessages = messages.filter(m => m.role === 'user');
      
      if (userMessages.length === 0) {
        // 没有用户消息，使用默认标题
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId
            ? { ...conv, title: '新对话' } 
            : conv
        ));
        return;
      }
      
      // 使用最后一个用户问题作为标题
      const lastUserMsg = userMessages[userMessages.length - 1];
      const title = lastUserMsg.content.length > 20 
        ? lastUserMsg.content.substring(0, 20) + '...' 
        : lastUserMsg.content;
      
      console.log('使用用户最后一个问题作为标题:', title);
      
      // 更新对话列表
      setConversations(prev => {
        const updated = prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, title: title } 
            : conv
        );
        
        // 保存到本地存储
        localStorage.setItem('chat_conversations', JSON.stringify(updated));
        
        return updated;
      });
      
    } catch (error) {
      console.error('设置对话标题失败:', error);
    }
  };

  // 修改滚动到特定消息的函数参数类型
  const scrollToMessage = (messageId: string, matchIndex: number) => {
    // 函数实现不变
    setTimeout(() => {
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 使用内联样式添加高亮效果
        const originalBackground = messageElement.style.backgroundColor || '';
        messageElement.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        messageElement.style.transition = 'background-color 2s';
        
        setTimeout(() => {
          messageElement.style.backgroundColor = originalBackground;
        }, 2000);
      }
    }, 200);
  };

  // 修改默认模型变更的useEffect，添加一个标记防止循环
  const [isSettingDefaultModel, setIsSettingDefaultModel] = useState(false);

  // 修改处理默认模型变更的逻辑
  useEffect(() => {
    if (settings.defaultModelId && !justManuallySelected) {
      const defaultModel = availableModels.find(m => m.id === settings.defaultModelId);
      if (defaultModel && defaultModel.id !== selectedModel.id) {
        console.log('设置变更，应用新的默认模型:', defaultModel.displayName);
        setSelectedModel(defaultModel);
      }
    }
  }, [settings.defaultModelId, availableModels]); // 监听设置中的默认模型ID变化

  // 修改初始化设置的 useEffect
  useEffect(() => {
    // 从 localStorage 加载设置
    const savedSettings = localStorage.getItem('chat_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
        
        // 如果有默认模型设置，立即应用
        if (parsedSettings.defaultModelId) {
          const defaultModel = availableModels.find(m => m.id === parsedSettings.defaultModelId);
          if (defaultModel && defaultModel.id !== selectedModel.id) {
            console.log('应用保存的默认模型:', defaultModel.displayName);
            setSelectedModel(defaultModel);
          }
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    }
  }, [availableModels]); // 依赖 availableModels 确保模型数据已加载

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <ChatSidebar 
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelect={switchConversation}
        onDelete={handleDeleteConversation}
        onNew={createNewConversation}
        open={showSidebar}
        setOpen={setShowSidebar}
        getModelIcon={getModelIconByName}
        getModelDisplayName={getModelDisplayName}
        scrollToMessage={scrollToMessage}
        availableModels={availableModels}
        settings={settings}
        selectedModel={selectedModel}
      />
      
      <div className="flex flex-col flex-1 p-2 h-full overflow-hidden">
        <div className="flex flex-col flex-1 rounded-xl bg-[#0a0e14] border border-white/10 h-full overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between p-2 md:p-3 border-b border-white/10">
            <div className="flex items-center">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="mr-1.5 md:mr-2 text-gray-400 hover:text-white hover:bg-white/10 h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded"
              >
                <PanelLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
              
              <div className="flex items-center">
                <div className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center mr-1.5 md:mr-2">
                  <Image 
                    src={selectedModel.iconSrc} 
                    alt={selectedModel.provider} 
                    width={20} 
                    height={20} 
                    className="h-4.5 w-4.5 md:h-5 md:w-5"
                  />
                </div>
                <h3 className="text-sm md:text-base font-medium text-white">
                  {currentConversation?.title || "AI助手"}
                </h3>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-2">
              <button
                onClick={() => {
                  // 清空当前对话时显示欢迎界面
                  setMessages([{
                    id: generateId(),
                    role: 'assistant',
                    content: `你好！我是基于${selectedModel.displayName}的AI助手。${settings.systemPrompt ? '我被指示：' + settings.systemPrompt : '有什么我可以帮助你的？'}`,
                    timestamp: new Date()
                  }]);
                  setCurrentConversationId(null);
                  localStorage.removeItem('current_conversation_id');
                }}
                className="text-gray-400 hover:text-white hover:bg-white/10 h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={messages.length === 0 && !currentConversationId}
              >
                <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-gray-400 hover:text-white hover:bg-white/10 h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded"
              >
                <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </div>
          </div>
          
          <div 
            className="flex-1 overflow-y-auto p-4 scrollbar-custom"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(107, 114, 128, 0.2) transparent'
            }}
          >
            {messages.length === 0 || (!currentConversationId && messages.length <= 1) ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-medium text-white mb-2">欢迎使用AI助手</h2>
                <p className="text-gray-400 max-w-md mb-8">有什么可以帮助您的吗？</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  <button
                    onClick={() => setInputText("介绍一下你自己，你能做什么？")}
                    className="p-3 rounded-lg border border-white/10 hover:bg-white/5 text-left text-sm text-gray-300 transition-colors"
                  >
                    介绍一下你自己，你能做什么？
                  </button>
                  <button
                    onClick={() => setInputText("写一篇短文，描述人工智能的未来发展")}
                    className="p-3 rounded-lg border border-white/10 hover:bg-white/5 text-left text-sm text-gray-300 transition-colors"
                  >
                    写一篇短文，描述人工智能的未来发展
                  </button>
                  <button
                    onClick={() => setInputText("如何提高自己的编程能力？")}
                    className="p-3 rounded-lg border border-white/10 hover:bg-white/5 text-left text-sm text-gray-300 transition-colors"
                  >
                    如何提高自己的编程能力？
                  </button>
                  <button
                    onClick={() => setInputText("为我解释一下量子计算的基本原理")}
                    className="p-3 rounded-lg border border-white/10 hover:bg-white/5 text-left text-sm text-gray-300 transition-colors"
                  >
                    为我解释一下量子计算的基本原理
                  </button>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={message.id} 
                  id={`message-${message.id}`}
                  className={`animate-fade-in ${index > 0 ? 'mt-3 md:mt-4' : ''}`}
                >
                  <div className={`flex flex-col gap-1.5 md:gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center mb-1 md:mb-2">
                      {message.role === 'user' ? (
                        <div className="flex items-center text-blue-400">
                          <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-600 flex items-center justify-center">
                            <User className="h-3 w-3 md:h-3.5 md:w-3.5 text-white" />
                          </div>
                          <span className="ml-1.5 md:ml-2 text-xs md:text-sm font-medium">你</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-purple-400">
                          <div className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center">
                            <Image 
                              src={getModelIconByName(message.model || selectedModel.name)}
                              alt="AI"
                              width={22}
                              height={22}
                              className="w-5 h-5 md:w-6 md:h-6 rounded-full"
                            />
                          </div>
                          <span className="ml-1.5 md:ml-2 text-xs md:text-sm font-medium">AI助手</span>
                          {message.model && (
                            <span className="ml-1.5 md:ml-2 text-[10px] md:text-xs text-gray-500">
                              使用{getModelDisplayName(message.model)}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {message.role === 'assistant' && message.content && !message.isLoading && (
                        <button
                          className="ml-1.5 md:ml-2 text-gray-500 hover:text-gray-300 focus:outline-none"
                          onClick={() => copyMessageContent(message)}
                          title="复制到剪贴板"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3 md:h-3.5 md:w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    <div>
                      {message.role === 'user' ? (
                        <div className="bg-blue-600/20 border border-blue-500/30 px-2.5 py-2 md:px-3 md:py-2.5 rounded-2xl rounded-tr-sm text-white shadow-md">
                          <div className="prose prose-invert prose-sm max-w-none text-xs md:text-sm whitespace-pre-wrap">
                            {message.content}
                          </div>
                        </div>
                      ) : (
                        <div className={`rounded-2xl rounded-tl-sm ${message.isLoading ? 'bg-[#0f1218] border border-blue-500/30 shadow-blue-500/10' : 'bg-[#15192a]'} px-2.5 py-2 md:px-3 md:py-2.5 text-white shadow-md`}>
                          {message.reasoningContent && message.reasoningContent.trim() !== '' && (
                            <div className="mb-2 md:mb-3 overflow-hidden">
                              <div className="flex items-center mb-1.5 md:mb-2">
                                <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-0.5 md:p-1 mr-1.5 md:mr-2 shadow-lg shadow-purple-500/20">
                                  <Brain className="h-3 w-3 md:h-3.5 md:w-3.5 text-white" />
                                </div>
                                <span className="text-[10px] md:text-xs font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">思维过程</span>
                              </div>
                              <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm p-2 md:p-3 rounded-lg border border-purple-500/20 shadow-inner shadow-purple-500/5">
                                <div className="prose prose-invert prose-sm max-w-none text-[10px] md:text-xs leading-relaxed text-gray-300 font-mono">
                                  <ReactMarkdown>{message.reasoningContent}</ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="prose prose-invert prose-sm max-w-none text-xs md:text-sm leading-relaxed">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                            {message.isLoading && (
                              <span className="inline-block w-1 md:w-1.5 h-3 md:h-4 bg-blue-400 ml-0.5 animate-pulse"></span>
                            )}
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
          
          <div className="flex-shrink-0 p-2 md:p-3 border-t border-white/10">
            <div className="w-full">
              <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                <div 
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="inline-flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-0.5 md:py-1 bg-[#111520]/70 border border-white/10 rounded-full cursor-pointer hover:bg-[#111520] hover:border-blue-500/30 transition-colors shadow-sm"
                >
                  <Image 
                    src={selectedModel.iconSrc} 
                    alt={selectedModel.provider} 
                    width={18}
                    height={18} 
                    className="w-4 h-4 md:w-5 md:h-5 rounded-full"
                  />
                  <span className="text-[10px] md:text-xs text-gray-300">{selectedModel.displayName}</span>
                  <ChevronDown className="h-2.5 w-2.5 md:h-3 md:w-3 text-gray-400" />
                </div>
                
                <button
                  onClick={createNewConversation}
                  className="bg-[#111520]/70 border border-white/10 hover:bg-[#111520] hover:border-blue-500/30 text-gray-300 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 h-6 md:h-7 rounded flex items-center"
                >
                  <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-0.5 md:mr-1" />
                  新对话
                </button>
              </div>
              
              <div className="relative">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="发送消息..."
                  className="w-full bg-[#111520]/80 border border-white/10 focus:border-blue-500/50 focus-visible:ring-0 focus-visible:ring-offset-0 text-white text-xs md:text-sm p-2 md:p-3 pr-10 md:pr-12 rounded-xl min-h-[38px] md:min-h-[44px] max-h-[120px] md:max-h-[150px] resize-none shadow-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.1) transparent'
                  }}
                />
                
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="absolute right-2 bottom-2 md:right-2.5 md:bottom-2.5 rounded-full w-7 h-7 md:w-8 md:h-8 p-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white shadow-md shadow-blue-500/20 flex items-center justify-center"
                >
                  {isLoading ? 
                    <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" /> : 
                    <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="chat-window-portals">
        <AnimatePresence>
          {showSettings && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1000]"
                onClick={() => setShowSettings(false)}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                className="fixed top-16 right-4 z-[1100] w-[90%] max-w-md bg-[#0a0e14]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                style={{ 
                  maxHeight: 'min(600px, calc(100vh - 100px))',
                  maxWidth: 'min(400px, calc(100vw - 32px))'
                }}
              >
                <ChatOptions
                  settings={settings}
                  onChange={updateSettings}
                  onClose={() => setShowSettings(false)}
                  availableModels={availableModels}
                  selectedModel={selectedModel}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showModelSelector && (
            <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
                onClick={() => setShowModelSelector(false)}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-20 left-8 z-[1100] bg-[#0a0e14]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              <ModelSelector
                models={availableModels}
                selectedModel={selectedModel}
                onSelect={(model) => {
                  setSelectedModel(model);
                  // 标记用户刚刚手动选择了模型
                  setJustManuallySelected(true);
                  setShowModelSelector(false);
                  localStorage.setItem('selectedModel', JSON.stringify(model));
                }}
                onClose={() => setShowModelSelector(false)}
              />
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}