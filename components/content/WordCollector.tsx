'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { SelectedWord } from './AnchorWordBlock';

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的英语词汇解释助手。请为用户提供的单词/短语提供详细的解释，格式如下：

1. **单词** - 原型, [音标], 词性. 中文解释。结合上下文的具体解释。

## 注意事项
- 给出的单词原型主要是时态、复数等等语法规则的原型，不是形容词变名词的词性原型
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
3. **Bobbing** - Bobbing, [ˈbɑbɪŋ], n. 浮沉训练。指一种在水中上下浮动的训练。
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
16. **down** - down, [daʊn], adv. 向下；深处。这里指在水下某个深度的位置。
17. **swirled** - swirl, [swɜrl], v. 旋转；打转。指快速旋转或搅动。`
  }
];

// 词汇解释状态接口
export interface WordExplanation {
  wordId: string;
  word: string;
  meaning: string;
  original: string;
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
}

export function useWordCollector({
  selectedWords,
  currentBlocks,
  onExplanationUpdate,
  onFullContentUpdate,
  onLoadingChange
}: WordCollectorProps) {
  const { session } = useAuthStore();
  
  // 构建用户消息内容
  const buildUserMessage = (words: SelectedWord[]) => {
    // 按原文顺序排序
    const sortedWords = [...words].sort((a, b) => a.startIndex - b.startIndex);
    
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
    
    // 提取单词列表
    const wordList = sortedWords.map(word => word.text).join('、');
    
    return `${contextText}\n${wordList}`;
  };

  // 流式解析解释结果
  const parseStreamingExplanation = (content: string) => {
    const lines = content.split('\n');
    const newExplanations = new Map<string, WordExplanation>();
    
    for (const line of lines) {
      // 匹配详细格式：1. **单词** - 原型, [音标], 词性. 中文解释。结合上下文的具体解释。
      const detailedMatch = line.match(/\d+\.\s*\*\*(.+?)\*\*\s*-\s*(.+?),\s*\[(.+?)\],\s*(.+?)\.\s*(.+?)。/);
      if (detailedMatch) {
        const word = detailedMatch[1].trim();
        const original = detailedMatch[2].trim();
        const meaning = detailedMatch[5].trim();
        
        // 找到对应的词汇ID - 使用精确匹配
        const selectedWord = selectedWords.find(w => w.text === word);
        if (selectedWord) {
          newExplanations.set(selectedWord.id, {
            wordId: selectedWord.id,
            word,
            original,
            meaning // 只显示基本中文解释，不包括音标等
          });
        }
        continue;
      }
      
      // 兼容简化格式：1. **单词** - 原型, 中文解释
      const simpleMatch = line.match(/\d+\.\s*\*\*(.+?)\*\*\s*-\s*(.+?),\s*(.+)/);
      if (simpleMatch) {
        const word = simpleMatch[1].trim();
        const original = simpleMatch[2].trim();
        const meaning = simpleMatch[3].trim();
        
        // 找到对应的词汇ID - 使用精确匹配
        const selectedWord = selectedWords.find(w => w.text === word);
        if (selectedWord) {
          newExplanations.set(selectedWord.id, {
            wordId: selectedWord.id,
            word,
            original,
            meaning
          });
        }
      }
    }
    
    return newExplanations;
  };

  // 处理流式响应
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
    }
  };

  // 处理收集词汇
  const collectWords = async () => {
    if (!selectedWords || selectedWords.length === 0) {
      toast.error('请先选择要解释的词汇');
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
      
      // 构建请求消息
      const messages = [
        ...EXAMPLE_CONVERSATION,
        {
          role: 'user' as const,
          content: userMessage
        }
      ];

      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          provider: 'mnapi',
          modelName: 'claude-3.7-sonnet', // 使用 Claude 3.7 Sonnet 作为默认模型
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
      throw error;
    } finally {
      onLoadingChange(false);
    }
  };

  return { collectWords };
} 