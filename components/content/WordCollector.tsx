'use client';

import React, { useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { SelectedWord } from './AnchorWordBlock';
import { processWordExplanations, WordExplanation as AnchorWordExplanation } from '@/lib/services/anchor-service';

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的英语词汇解释助手。请为用户提供的单词/短语提供详细的解释，格式如下：

1. **单词** - 原型, [音标], 词性. 中文解释。结合上下文的具体解释。

## 注意事项
- 给出的单词原型主要是时态、复数等等语法规则的原型，不是形容词变名词的词性原型
- **重要：句首大写字母、印刷体标题等大写形式必须还原成小写的单词原型**（例如：Bobbing → bobbing, The → the）
- 专有名词除外（如人名、地名、品牌名等）
- 解释要准确、简洁
- 结合上下文给出最贴切的解释
- 音标要准确
- 中文解释要通俗易懂
- 按照用户提供的单词顺序进行解释`;

// 预设对话示例
const EXAMPLE_CONVERSATION = [
  {
    role: 'user',
    content: `In Pararescue training, water confidence is part of the ten-week program, and it's filled with specific evolutions designed to test how well we perform in the water under stress. One of the worst evolutions for me was called Bobbing. The class was divided into groups of five, lined up from gutter to gutter in the shallow end, and fully kitted up. Our backs were strapped with twin eighty-liter tanks made from galvanized steel, and we wore sixteen-pound weight belts too. We were loaded the fuck down, which would have been fine, except in this evolution we weren't allowed to breathe from those tanks. Instead, we were told to walk backward down the slope of the pool from the three-foot section to the deep end, about ten feet down, and on that slow walk into position, my mind swirled with doubt and negativity.
specific、evolutions、Bobbing、was divided into、lined up、gutter、shallow、end、kitted up、liter、tanks、galvanized、load、down、breathe、slope、section、swirled`
  },
  {
    role: 'assistant',
    content: `1. **specific** - specific, [spəˈsɪfɪk], adj. 具体的；特定的。指某个特别指定的。
2. **evolutions** - evolution, [ˌɛvəˈluʃən], n. 进阶；演变。这里指训练中的特定训练项目或过程。
3. **Bobbing** - bobbing, [ˈbɑbɪŋ], n. 浮沉训练。指一种在水中上下浮动的训练。
4. **was divided into** - be divided into, [bɪ dɪˈvaɪdɪd ˈɪntu], phr. 被分成。表示某物被分成若干部分。
5. **lined up** - line up, [laɪn ʌp], phr. 排列；排成一列。指人或物按顺序排列。
6. **gutter** - gutter, [ˈɡʌtər], n. 排水沟。这里指泳池边缘的排水沟。
7. **shallow** - shallow, [ˈʃæloʊ], adj. 浅的。指水深较浅的区域。
8. **kitted up** - kit up, [ˈkɪt ʌp], phr. 装备齐全。指穿戴全套装备。
9. **liter** - liter, [ˈlitər], n. 升。体积单位。
10. **tanks** - tank, [tæŋk], n. 罐；桶。指装有液体或气体的容器。
11. **galvanized** - galvanized, [ˈɡælvəˌnaɪzd], adj. 镀锌的。通过镀锌处理防止生锈的。
12. **load down** - load down, [loʊd daʊn], phr. 装载；压重。指给某物加重或施加负担。
13. **breathe** - breathe, [brið], v. 呼吸。指吸入或呼出空气。
14. **slope** - slope, [sloʊp], n. 斜坡。倾斜的表面或地带。
15. **section** - section, [ˈsɛkʃən], n. 部分；区域。指整体中的一个部分。
16. **swirled** - swirl, [swɜrl], v. 旋转；打转。指快速旋转或搅动。`
  }
];

// 词汇解释状态接口
export interface WordExplanation {
  wordId: string;
  word: string;
  meaning: string;
  original: string;
  // 新增字段用于锚点系统
  tags?: string[];
  example?: string;
  startIndex?: number;
  endIndex?: number;
  // 新增：支持新表结构的字段
  phonetic?: string;
  chineseMeaning?: string;
  contextExplanation?: string;
}

interface WordCollectorProps {
  selectedWords: SelectedWord[];
  currentBlocks?: Array<{
    id: string;
    block_type: string;
    content: string;
    original_content?: string;
  }>;
  onExplanationUpdate: (explanations: Map<string, WordExplanation>) => void;
  onFullContentUpdate: (content: string) => void;
  onLoadingChange: (loading: boolean) => void;
  // 新增：锚点处理相关回调
  onAnchorProcessed?: (result: {
    success: boolean;
    error?: string;
    processed: number;
    results: any[];
    anchors?: any[];
  }) => void;
  contextBlockId?: string; // 当前语境块ID，用于关联锚点
  // 新增：模型配置
  modelConfig?: {
    provider: string;
    modelName: string;
  };
  // 新增：处理日志回调
  onProcessingLogUpdate?: (logs: Array<{
    word: string;
    type: 'anchor_creation' | 'meaning_duplicate_check';
    log: any;
    timestamp: Date;
  }>) => void;
}

export function useWordCollector({
  selectedWords,
  currentBlocks,
  onExplanationUpdate,
  onFullContentUpdate,
  onLoadingChange,
  onAnchorProcessed,
  contextBlockId,
  modelConfig,
  onProcessingLogUpdate
}: WordCollectorProps) {
  const { session } = useAuthStore();
  
  // 构建用户消息内容
  const buildUserMessage = (words: SelectedWord[]) => {
    // 过滤掉已有锚点，只处理新选择的词汇
    const newWords = words.filter(word => !word.isExisting);
    
    // 如果没有新词汇，返回空
    if (newWords.length === 0) {
      return '';
    }
    
    // 按原文顺序排序
    const sortedWords = [...newWords].sort((a, b) => a.startIndex - b.startIndex);
    
    // 将多个语境块的内容按顺序叠加
    let contextText = 'No context provided';
    if (currentBlocks && currentBlocks.length > 0) {
      const blockTexts: string[] = [];
      
      currentBlocks.forEach(block => {
        // 对于音频对齐块，使用 original_content；对于其他类型，使用 content
        if (block.block_type === 'audio_aligned' && block.original_content) {
          blockTexts.push(block.original_content);
        } else if (block.content) {
          blockTexts.push(block.content);
        }
      });
      
      // 将所有块的内容用换行连接
      contextText = blockTexts.join('\n');
    }
    
    // 提取新词汇列表
    const wordList = sortedWords.map(word => word.text).join('、');
    
    return `${contextText}\n${wordList}`;
  };

  // 解析LLM响应，提取详细信息
  const parseDetailedExplanation = (line: string): {
    word: string;
    lemma: string;
    phonetic?: string;
    partOfSpeech?: string;
    chineseMeaning: string;
    contextExplanation: string;
  } | null => {
    // 统一匹配格式：可选序号 + **单词** - 原型, [音标], 词性. 中文解释。上下文解释
    // 支持：1. **word** 或 **word** 开头
    const match = line.match(/(?:\d+\.\s*)?\*\*(.+?)\*\*\s*-\s*(.+?),\s*\[(.+?)\],\s*(.+?)\.\s*(.+?)(?:。(.*))?$/);
    if (match) {
      return {
        word: match[1].trim(),
        lemma: match[2].trim(),
        phonetic: match[3].trim(),
        partOfSpeech: match[4].trim(),
        chineseMeaning: match[5].trim(),
        contextExplanation: match[6] ? match[6].trim() : ''
      };
    }
    
    // 简化格式兜底：可选序号 + **单词** - 原型, 中文解释
    const simpleMatch = line.match(/(?:\d+\.\s*)?\*\*(.+?)\*\*\s*-\s*(.+?),\s*(.+)/);
    if (simpleMatch) {
      return {
        word: simpleMatch[1].trim(),
        lemma: simpleMatch[2].trim(),
        chineseMeaning: simpleMatch[3].trim(),
        contextExplanation: ''
      };
    }
    
    return null;
  };

  // 流式解析解释结果（增强版本，支持新的数据格式）
  const parseStreamingExplanation = (content: string) => {
    const lines = content.split('\n');
    const newExplanations = new Map<string, WordExplanation>();
    
    // 只处理新词汇，过滤掉已有锚点
    const newWords = selectedWords.filter(word => !word.isExisting);
    
    // 只在开发环境下输出详细日志
    const isDebug = process.env.NODE_ENV === 'development';
    
    for (const line of lines) {
      if (line.trim() === '') continue; // 跳过空行
      
      const parsed = parseDetailedExplanation(line);
      
      if (!parsed) {
        if (isDebug && line.includes('**')) {
          console.log('解析失败的行:', line);
        }
        continue;
      }
      
      const { word, lemma, phonetic, partOfSpeech, chineseMeaning, contextExplanation } = parsed;
      
      // 找到对应的词汇ID - 只在新词汇中查找
      const selectedWord = newWords.find(w => w.text === word);
      if (selectedWord) {
        // 构建音标+中文含义的格式（符合新表结构）
        const formattedMeaning = phonetic 
          ? `/${phonetic}/ ${chineseMeaning}`
          : chineseMeaning;
        
        newExplanations.set(selectedWord.id, {
          wordId: selectedWord.id,
          word,
          original: lemma,
          meaning: formattedMeaning,
          phonetic,
          chineseMeaning,
          contextExplanation,
          tags: partOfSpeech ? [partOfSpeech] : [], // 词性作为标签
          startIndex: selectedWord.startIndex,
          endIndex: selectedWord.endIndex
        });
      } else if (isDebug) {
        console.log('未匹配的单词:', word, '期望:', newWords.map(w => w.text));
      }
    }
    
    if (isDebug) {
      console.log(`解析完成: ${newExplanations.size}/${newWords.length} 个新词汇`);
    }
    
    return newExplanations;
  };

  // 处理锚点创建（使用新的数据格式和流式处理）
  const processAnchorsAfterCollection = async (explanations: Map<string, WordExplanation>) => {
    if (!contextBlockId || explanations.size === 0) {
      console.log('跳过锚点处理：缺少contextBlockId或无解释内容', {
        contextBlockId,
        explanationsSize: explanations.size
      });
      return;
    }

    try {
      // 检查用户登录状态
      const { supabase } = await import('@/lib/supabase-client');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('用户未登录，无法处理锚点');
        onAnchorProcessed?.({
          success: false,
          error: '用户未登录，请先登录后再试',
          processed: 0,
          results: []
        });
        return;
      }

      console.log('用户认证状态正常，开始流式处理锚点', {
        userId: session.user.id,
        userEmail: session.user.email
      });

      // 转换为锚点服务所需的格式（支持新的字段）
      const anchorExplanations: AnchorWordExplanation[] = Array.from(explanations.values()).map(exp => ({
        original: exp.word,
        lemma: exp.original,
        meaning: exp.meaning, // 已经是格式化的音标+中文含义
        example: exp.contextExplanation || '', // 使用上下文解释作为例句
        contextExplanation: exp.contextExplanation, // 新增：上下文解释
        tags: exp.tags || [],
        startIndex: exp.startIndex,
        endIndex: exp.endIndex
      }));

      console.log('开始流式处理锚点，词汇数量:', anchorExplanations.length);
      
      // 使用传递的模型配置，如果没有传递则使用默认配置
      const defaultModelConfig = {
        provider: 'mnapi',
        modelName: 'claude-3.7-sonnet'
      };
      const finalModelConfig = modelConfig || defaultModelConfig;
      
      // 累积处理日志
      const allProcessingLogs: Array<{
        word: string;
        type: 'anchor_creation' | 'meaning_duplicate_check';
        log: any;
        timestamp: Date;
      }> = [];
      
      // 调用流式锚点处理API
      const result = await processWordExplanations(
        anchorExplanations, 
        contextBlockId,
        finalModelConfig,
        {
          stream: true,
          onProgress: (event) => {
            console.log('收到流式事件:', event);
            
            // 根据事件类型更新前端状态
            switch (event.type) {
              case 'start':
                console.log(`🚀 开始处理 ${event.total} 个词汇`);
                break;
                
              case 'anchor_check_complete':
                console.log(`✅ 锚点查询完成: ${event.word} - ${event.log.action}`);
                // 生成锚点查询完成的日志（瞬间完成，不需要查询开始状态）
                allProcessingLogs.push({
                  word: event.word || '未知词汇',
                  type: 'anchor_creation',
                  log: event.log,
                  timestamp: new Date()
                });
                if (onProcessingLogUpdate) {
                  onProcessingLogUpdate([{
                    word: event.word || '未知词汇',
                    type: 'anchor_creation',
                    log: event.log,
                    timestamp: new Date()
                  }]);
                }
                break;
                
              case 'meaning_analysis_start':
                console.log(`🤖 开始LLM辨析: ${event.word} (${event.index}/${event.total})`);
                // 注意：这个事件现在只会对OLD锚点发送，NEW锚点会跳过LLM辨析
                break;
                
              case 'meaning_analysis_complete':
                console.log(`🎯 含义处理完成: ${event.word} - ${event.isNew ? '新建' : '已存在'} (${event.index}/${event.total})`);
                console.log(`📊 真实处理日志:`, event.log);
                
                // 使用真实的后端处理日志，正确映射事件类型
                allProcessingLogs.push({
                  word: event.word || '未知词汇',
                  type: 'meaning_duplicate_check', // 保持现有的日志类型约定
                  log: event.log, // 使用后端真实日志
                  timestamp: new Date()
                });
                
                if (onProcessingLogUpdate) {
                  onProcessingLogUpdate([{
                    word: event.word || '未知词汇',
                    type: 'meaning_duplicate_check',
                    log: event.log, // 使用后端真实日志
                    timestamp: new Date()
                  }]);
                }
                break;
                
              case 'save_start':
                console.log(`💾 开始保存: ${event.word} (${event.index}/${event.total})`);
                break;
                
              case 'save_complete':
                console.log(`✨ 保存完成: ${event.word}`);
                // 生成保存完成的日志
                allProcessingLogs.push({
                  word: event.word || '未知词汇',
                  type: 'meaning_duplicate_check', // 使用现有类型，但添加完成标记
                  log: {
                    action: 'saved',
                    word: event.word || '未知词汇',
                    result: event.result,
                    message: event.message || '保存完成',
                    timestamp: new Date().toISOString()
                  },
                  timestamp: new Date()
                });
                if (onProcessingLogUpdate) {
                  onProcessingLogUpdate([{
                    word: event.word || '未知词汇',
                    type: 'meaning_duplicate_check',
                    log: {
                      action: 'saved',
                      word: event.word || '未知词汇',
                      result: event.result,
                      message: event.message || '保存完成',
                      timestamp: new Date().toISOString()
                    },
                    timestamp: new Date()
                  }]);
                }
                break;
                
              case 'error':
                console.error(`❌ 处理失败: ${event.word} - ${event.error}`);
                break;
                
              case 'complete':
                console.log(`🎉 全部处理完成: ${event.processed} 个词汇`);
                break;
            }
          }
        }
      );
      
      console.log('流式锚点处理完成:', result);
      
      // 通知父组件处理完成
      onAnchorProcessed?.({
        success: result.success,
        processed: anchorExplanations.length,
        results: result.results || [],
        anchors: result.anchors || []
      });
      
    } catch (error) {
      console.error('流式锚点处理失败:', error);
      
      // 通知父组件处理失败
      onAnchorProcessed?.({
        success: false,
        error: error instanceof Error ? error.message : '锚点处理失败',
        processed: 0,
        results: []
      });
    }
  };

  // 处理流式响应（修改版本，在完成后处理锚点）
  const handleStream = async (response: Response) => {
    if (!response.ok) throw new Error(`API响应错误: ${response.status}`);
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');
    
    const decoder = new TextDecoder('utf-8');
    let accumulatedContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          try {
            const jsonStr = line.slice(5);
            const data = JSON.parse(jsonStr);
            const chunk = data.text || '';
            
            accumulatedContent += chunk;
            
            // 实时解析并更新解释
            const explanations = parseStreamingExplanation(accumulatedContent);
            onExplanationUpdate(explanations);
            
          } catch (e) {
            console.error('解析流数据出错:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
      onLoadingChange(false);
      
      // 保存完整的解释内容
      onFullContentUpdate(accumulatedContent);
      
      const finalExplanations = parseStreamingExplanation(accumulatedContent);
      toast.success(`成功解释 ${finalExplanations.size} 个词汇`);
      
      // 处理锚点创建（异步，不阻塞UI）
      if (contextBlockId) {
        processAnchorsAfterCollection(finalExplanations).catch(console.error);
      }
    }
  };

  // 处理收集词汇
  const collectWords = async () => {
    if (!selectedWords || selectedWords.length === 0) {
      toast.error('请先选择要解释的词汇');
      return;
    }

    // 检查是否有新词汇（非已有锚点）
    const newWords = selectedWords.filter(word => !word.isExisting);
    if (newWords.length === 0) {
      toast.error('没有新词汇需要解释，所选词汇都是已有锚点');
      return;
    }

    if (!session?.access_token) {
      toast.error('请先登录');
      return;
    }

    onLoadingChange(true);
    
    try {
      // 构建用户消息
      const userMessage = buildUserMessage(selectedWords);
      
      // 双重检查用户消息是否为空
      if (!userMessage || userMessage.trim() === '') {
        toast.error('没有新词汇需要解释');
        onLoadingChange(false);
        return;
      }
      
      // 构建请求消息
      const messages = [
        ...EXAMPLE_CONVERSATION,
        {
          role: 'user' as const,
          content: userMessage
        }
      ];

      // 使用传递的模型配置，如果没有传递则使用默认配置
      const defaultModelConfig = {
        provider: 'mnapi',
        modelName: 'claude-3.7-sonnet'
      };
      const finalModelConfig = modelConfig || defaultModelConfig;

      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          provider: finalModelConfig.provider,
          modelName: finalModelConfig.modelName,
          messages: messages,
          systemPrompt: SYSTEM_PROMPT,
          temperature: 0.7,
          maxTokens: 4096,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '请求失败');
      }

      if (response.body) {
        await handleStream(response);
      }
    } catch (error) {
      console.error('收集词汇失败:', error);
      onLoadingChange(false); // 只在错误时设置false
      throw error;
    }
  };

  return { collectWords };
} 