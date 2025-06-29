import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LLMFactory } from '@/lib/llm/factory';
import { rateLimit } from '@/lib/rate-limit';

// 指定运行时，避免静态生成错误
export const runtime = 'nodejs';

// 设置速率限制器
const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500
});

// 验证用户身份并创建用户客户端
async function createUserSupabaseClient(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('未授权访问');
  }

  const token = authHeader.split(' ')[1];
  
  // 创建用户客户端，使用用户的访问令牌
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );

  // 验证用户身份
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('用户验证失败');
  }
  
  return { supabase, userId: user.id };
}

// 智能提取句子（根据位置信息）
function extractSentenceFromText(
  text: string, 
  startPos: number, 
  endPos: number
): string {
  if (!text || startPos < 0 || endPos > text.length) {
    return text?.substring(startPos, endPos) || '';
  }

  // 句子结束标记
  const sentenceEnders = /[.!?。！？]/;
  // 句子开始标记（通常是大写字母或段落开头）
  const sentenceStarters = /[A-Z]|^/;
  
  // 找到句子的开始位置
  let sentenceStart = startPos;
  for (let i = startPos - 1; i >= 0; i--) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    
    // 如果遇到句子结束符，且下一个字符是大写或空白后的大写
    if (sentenceEnders.test(prevChar)) {
      // 跳过空白字符
      while (i < text.length && /\s/.test(text[i])) {
        i++;
      }
      sentenceStart = i;
      break;
    }
    
    // 如果到达文本开头
    if (i === 0) {
      sentenceStart = 0;
      break;
    }
  }
  
  // 找到句子的结束位置
  let sentenceEnd = endPos;
  for (let i = endPos; i < text.length; i++) {
    const char = text[i];
    
    // 如果遇到句子结束符
    if (sentenceEnders.test(char)) {
      sentenceEnd = i + 1;
      break;
    }
    
    // 如果到达文本末尾
    if (i === text.length - 1) {
      sentenceEnd = text.length;
      break;
    }
  }
  
  return text.substring(sentenceStart, sentenceEnd).trim();
}

// 获取语境块内容
async function getContextBlockContent(supabase: any, contextBlockId: string): Promise<string> {
  const { data: contextBlock, error } = await supabase
    .from('context_blocks')
    .select('content, original_content, block_type')
    .eq('id', contextBlockId)
    .single();

  if (error) {
    throw new Error(`获取语境块失败: ${error.message}`);
  }

  // 对于音频对齐块，优先使用 original_content
  if (contextBlock.block_type === 'audio_aligned' && contextBlock.original_content) {
    return contextBlock.original_content;
  }
  
  return contextBlock.content || '';
}

// 查找或创建锚点（带日志版本）
async function findOrCreateAnchorWithLog(supabase: any, userId: string, word: string, language: string = 'en') {
  const startTime = Date.now();
  
  try {
    // 查找现有锚点
    const { data: existingAnchor, error: findError } = await supabase
      .from('anchors')
      .select('*')
      .eq('text', word)
      .eq('language', language)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      throw new Error(`查询锚点失败: ${findError.message}`);
    }

    const processingTime = Date.now() - startTime;
    
    if (existingAnchor) {
      // 找到现有锚点
      return {
        anchor: existingAnchor,
        log: {
          action: 'found_existing',
          word,
          language,
          anchorId: existingAnchor.id,
          processingTime,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      // 创建新锚点
      const newAnchor = {
        text: word,
        type: word.includes(' ') ? 'phrase' : 'word',
        language,
        // user_id 由触发器自动设置
      };

      const { data: createdAnchor, error: createError } = await supabase
        .from('anchors')
        .insert(newAnchor)
        .select()
        .single();

      if (createError) {
        throw new Error(`创建锚点失败: ${createError.message}`);
      }

      const totalProcessingTime = Date.now() - startTime;
      
      return {
        anchor: createdAnchor,
        log: {
          action: 'created_new',
          word,
          language,
          anchorId: createdAnchor.id,
          processingTime: totalProcessingTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    const errorTime = Date.now() - startTime;
    throw new Error(`锚点处理失败: ${(error as Error).message}`);
  }
}

// 查找或创建锚点（使用新的表结构）- 保持向后兼容
async function findOrCreateAnchor(supabase: any, userId: string, word: string, language: string = 'en') {
  const result = await findOrCreateAnchorWithLog(supabase, userId, word, language);
  return result.anchor;
}

// 解析LLM生成的含义文本，提取音标和中文含义
function parseMeaningText(meaningText: string): {
  phonetic?: string;
  chineseMeaning: string;
  formattedMeaning: string;
} {
  // 尝试匹配音标格式：/音标/ 中文含义
  const phoneticMatch = meaningText.match(/\/([^\/]+)\/\s*(.+)/);
  
  if (phoneticMatch) {
    return {
      phonetic: phoneticMatch[1].trim(),
      chineseMeaning: phoneticMatch[2].trim(),
      formattedMeaning: meaningText.trim()
    };
  }
  
  // 如果没有音标，直接使用原文
  return {
    chineseMeaning: meaningText.trim(),
    formattedMeaning: meaningText.trim()
  };
}

// 检查含义是否重复（使用汇总视图）
async function checkMeaningDuplicate(
  supabase: any, 
  anchorId: string, 
  newMeaning: string,
  newContextExplanation?: string,
  newOriginalSentence?: string,
  modelConfig?: { provider: string; modelName: string }
): Promise<{
  isDuplicate: boolean;
  existingMeaningBlock?: any;
  mergedMeaning?: string;
  processingLog?: {
    existingMeanings: string[];
    llmPrompt: string;
    llmResponse: string;
    parsedResult: any;
    decision: string;
  };
}> {
  // 获取该锚点的所有现有含义块（使用汇总视图）
  const { data: existingMeanings, error } = await supabase
    .from('meaning_blocks_summary')
    .select('*')
    .eq('anchor_id', anchorId);

  if (error) {
    throw new Error(`查询现有含义失败: ${error.message}`);
  }

  if (!existingMeanings || existingMeanings.length === 0) {
    return { 
      isDuplicate: false,
      processingLog: {
        existingMeanings: [],
        llmPrompt: '',
        llmResponse: '',
        parsedResult: null,
        decision: '无现有含义，直接创建新含义块'
      }
    };
  }

  // 使用传递的模型配置或默认配置
  const defaultModelConfig = {
    provider: 'mnapi',
    modelName: 'claude-3.7-sonnet'
  };
  const finalModelConfig = modelConfig || defaultModelConfig;

  // 使用LLM判断含义是否重复
  const llm = LLMFactory.create(finalModelConfig.provider, { 
    modelName: finalModelConfig.modelName,
    systemPrompt: `你是一个语言专家，负责判断词汇含义是否重复。

请严格按照以下JSON格式回复，不要添加任何额外的文字说明：

{
  "isDuplicate": true | false,
  "reason": "详细的判断理由",
  "mergedMeaning": "如果是重复的，提供合并后的含义（可选）"
}

判断规则：
- 如果新含义与现有含义基本相同或高度重叠，设置 "isDuplicate": true
- 如果新含义与现有含义完全不同或只是部分重叠，设置 "isDuplicate": false
- 即使只是添加了音标或略微不同的表述，如果核心含义相同，也应该判断为重复
- 考虑语境和例句的相似性，如果在相似语境下表达相同含义，应判断为重复
- 只返回JSON，不要任何前缀、后缀或代码块标记`
  });

  // 构建更详细的现有含义信息
  const existingMeaningsDetails = existingMeanings.map((m: any, i: number) => {
    let detail = `${i + 1}. 含义：${m.chinese_meaning || m.meaning}`;
    
    // 添加例句统计信息
    if (m.example_count > 0) {
      detail += `\n   已有 ${m.example_count} 个例句`;
      
      // 显示第一个例句作为代表
      if (m.first_context_explanation) {
        detail += `\n   代表性语境：${m.first_context_explanation}`;
      }
      if (m.first_original_sentence) {
        detail += `\n   代表性例句：${m.first_original_sentence}`;
      }
    } else {
      detail += `\n   暂无例句`;
    }
    
    return detail;
  }).join('\n\n');

  // 构建新含义的详细信息
  let newMeaningDetail = `含义：${newMeaning}`;
  if (newContextExplanation) {
    newMeaningDetail += `\n语境解释：${newContextExplanation}`;
  }
  if (newOriginalSentence) {
    newMeaningDetail += `\n例句：${newOriginalSentence}`;
  }

  const prompt = `现有含义：
${existingMeaningsDetails}

新含义：
${newMeaningDetail}

请判断新含义是否与现有含义重复，严格按照JSON格式回复。`;

  const result = await llm.chat([{ role: 'user', content: prompt }]);
  
  // 构建处理日志
  const processingLog = {
    existingMeanings: existingMeanings.map((m: any) => m.chinese_meaning || m.meaning),
    llmPrompt: prompt,
    llmResponse: result.text,
    parsedResult: null as any,
    decision: ''
  };
  
  try {
    // 尝试清理响应文本，提取JSON部分
    let cleanResponse = result.text.trim();
    
    // 如果响应包含JSON代码块，提取其中的JSON
    const jsonMatch = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[1].trim();
    }
    
    // 如果响应包含普通代码块，提取其中的内容
    const codeBlockMatch = cleanResponse.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleanResponse = codeBlockMatch[1].trim();
    }
    
    // 尝试找到JSON对象的开始和结束
    const jsonStart = cleanResponse.indexOf('{');
    const jsonEnd = cleanResponse.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
    }
    
    const analysis = JSON.parse(cleanResponse);
    processingLog.parsedResult = analysis;
    
    // 添加调试日志
    console.log('LLM判断结果解析:', {
      cleanResponse,
      analysis,
      originalResponse: result.text
    });
    
    // 兼容多种字段名格式
    const isRedundant = analysis.isDuplicate === true ||
                       analysis.is_duplicate === true ||
                       analysis.isRedundant === true ||
                       analysis.result === 'duplicate';
    
    const reason = analysis.reason || analysis.explanation || '未提供原因';
    
    console.log('判断逻辑调试:', {
      isRedundant,
      isDuplicate: analysis.isDuplicate,
      is_duplicate: analysis.is_duplicate,
      isRedundant_field: analysis.isRedundant,
      result_field: analysis.result,
      reason
    });
    
    if (isRedundant) {
      processingLog.decision = `LLM判断为重复含义，原因：${reason}`;
      // 找到最相似的含义块（这里简化为第一个，实际可以用更复杂的相似度算法）
      return {
        isDuplicate: true,
        existingMeaningBlock: existingMeanings[0],
        mergedMeaning: analysis.mergedMeaning || newMeaning,
        processingLog
      };
    }
    
    processingLog.decision = `LLM判断为不同含义，原因：${reason}`;
    return { 
      isDuplicate: false,
      processingLog
    };
  } catch (parseError) {
    console.error('解析LLM响应失败:', parseError);
    console.error('原始响应:', result.text);
    
    processingLog.decision = `JSON解析失败，使用关键词判断。错误：${parseError}`;
    
    // 如果JSON解析失败，尝试基于关键词进行简单判断
    const responseText = result.text.toLowerCase();
    if (responseText.includes('重复') || responseText.includes('duplicate') || responseText.includes('相同')) {
      processingLog.decision += ' -> 检测到重复关键词，判断为重复';
      return {
        isDuplicate: true,
        existingMeaningBlock: existingMeanings[0],
        mergedMeaning: newMeaning,
        processingLog
      };
    }
    
    processingLog.decision += ' -> 未检测到重复关键词，判断为不重复';
    // 默认认为不重复
    return { 
      isDuplicate: false,
      processingLog
    };
  }
}

// 创建或更新含义块（简化版本，不再处理example_sentence）
async function createOrUpdateMeaningBlock(
  supabase: any,
  userId: string,
  anchorId: string,
  meaningText: string, 
  contextExplanation?: string,
  contextBlockId?: string,
  startPosition?: number,
  endPosition?: number,
  tags: string[] = [],
  modelConfig?: { provider: string; modelName: string },
  isNewAnchor?: boolean // 新增参数，表示是否为新创建的锚点
) {
  // 解析含义文本
  const { formattedMeaning } = parseMeaningText(meaningText);
  
  // 获取例句（如果有位置信息）
  let originalSentence: string | undefined;
  if (contextBlockId && startPosition !== undefined && endPosition !== undefined) {
    try {
      const contextContent = await getContextBlockContent(supabase, contextBlockId);
      originalSentence = extractSentenceFromText(contextContent, startPosition, endPosition);
    } catch (error) {
      console.error('获取例句失败:', error);
    }
  }

  // 对于NEW锚点，直接创建含义块，跳过重复检查
  if (isNewAnchor) {
    const newMeaningBlock = {
      anchor_id: anchorId,
      meaning: formattedMeaning,
      tags,
      current_proficiency: 0,
      review_count: 0,
      easiness_factor: 2.5,
      interval_days: 1,
      next_review_date: new Date().toISOString()
      // user_id 由触发器自动设置
    };

    const { data: createdMeaning, error } = await supabase
      .from('meaning_blocks')
      .insert(newMeaningBlock)
      .select()
      .single();

    if (error) {
      throw new Error(`创建含义块失败: ${error.message}`);
    }

    return { 
      meaningBlock: createdMeaning, 
      isNew: true,
      processingLog: {
        existingMeanings: [],
        llmPrompt: '',
        llmResponse: '',
        parsedResult: null,
        decision: '新锚点，直接创建含义块'
      }
    };
  }

  // 对于OLD锚点，才进行重复检查
  const duplicateCheck = await checkMeaningDuplicate(
    supabase,
    anchorId,
    formattedMeaning,
    contextExplanation,
    originalSentence,
    modelConfig
  );
  
  if (duplicateCheck.isDuplicate && duplicateCheck.existingMeaningBlock) {
    // 如果是重复含义，只需要更新含义文本（如果有合并的含义）
    if (duplicateCheck.mergedMeaning && duplicateCheck.mergedMeaning !== duplicateCheck.existingMeaningBlock.meaning) {
    const { data: updatedMeaning, error } = await supabase
      .from('meaning_blocks')
      .update({
          meaning: duplicateCheck.mergedMeaning,
        tags: Array.from(new Set([...duplicateCheck.existingMeaningBlock.tags, ...tags])),
        updated_at: new Date().toISOString()
      })
      .eq('id', duplicateCheck.existingMeaningBlock.id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新含义块失败: ${error.message}`);
    }

    return { 
      meaningBlock: updatedMeaning, 
      isNew: false,
      processingLog: duplicateCheck.processingLog
    };
  } else {
      // 含义不需要更新，直接返回现有含义块
      return { 
        meaningBlock: duplicateCheck.existingMeaningBlock, 
        isNew: false,
        processingLog: duplicateCheck.processingLog
      };
    }
  } else {
    // 创建新含义块（不再包含example_sentence字段）
    const newMeaningBlock = {
      anchor_id: anchorId,
      meaning: formattedMeaning,
      tags,
      current_proficiency: 0,
      review_count: 0,
      easiness_factor: 2.5,
      interval_days: 1,
      next_review_date: new Date().toISOString()
      // user_id 由触发器自动设置
    };

    const { data: createdMeaning, error } = await supabase
      .from('meaning_blocks')
      .insert(newMeaningBlock)
      .select()
      .single();

    if (error) {
      throw new Error(`创建含义块失败: ${error.message}`);
    }

    return { 
      meaningBlock: createdMeaning, 
      isNew: true,
      processingLog: duplicateCheck.processingLog
    };
  }
}

// 创建含义块与语境的关联（包含例句信息）
async function createMeaningBlockContext(
  supabase: any,
  userId: string,
  meaningBlockId: string,
  contextBlockId: string,
  originalWordForm: string,
  startPosition?: number,
  endPosition?: number,
  contextExplanation?: string,
  originalSentence?: string,
  confidenceScore: number = 1.0
) {
  const contextData = {
    meaning_block_id: meaningBlockId,
    context_block_id: contextBlockId,
    original_word_form: originalWordForm,
    start_position: startPosition,
    end_position: endPosition,
    confidence_score: confidenceScore,
    context_explanation: contextExplanation, // 新增字段
    original_sentence: originalSentence, // 新增字段
    // user_id 由触发器自动设置
  };

  const { data, error } = await supabase
    .from('meaning_block_contexts')
    .insert(contextData)
    .select()
    .single();

  if (error) {
    throw new Error(`创建语境关联失败: ${error.message}`);
  }

  return data;
}

// 批量查找或创建锚点
async function batchFindOrCreateAnchors(supabase: any, userId: string, words: string[], language: string = 'en') {
  const startTime = Date.now();
  
  try {
    // 批量查询现有锚点
    const { data: existingAnchors, error: findError } = await supabase
      .from('anchors')
      .select('*')
      .in('text', words)
      .eq('language', language);

    if (findError) {
      throw new Error(`批量查询锚点失败: ${findError.message}`);
    }

    const existingAnchorMap = new Map();
    if (existingAnchors) {
      existingAnchors.forEach((anchor: any) => {
        existingAnchorMap.set(anchor.text, anchor);
      });
    }

    // 找出需要创建的新锚点
    const wordsToCreate = words.filter(word => !existingAnchorMap.has(word));
    const results = new Map();
    const logs = [];

    // 为已存在的锚点生成日志
    existingAnchors?.forEach((anchor: any) => {
      results.set(anchor.text, {
        anchor,
        log: {
          action: 'found_existing',
          word: anchor.text,
          language,
          anchorId: anchor.id,
          processingTime: 0,
          timestamp: new Date().toISOString()
        }
      });
    });

    // 批量创建新锚点
    if (wordsToCreate.length > 0) {
      const newAnchors = wordsToCreate.map(word => ({
        text: word,
        type: word.includes(' ') ? 'phrase' : 'word',
        language,
        // user_id 由触发器自动设置
      }));

      const { data: createdAnchors, error: createError } = await supabase
        .from('anchors')
        .insert(newAnchors)
        .select();

      if (createError) {
        throw new Error(`批量创建锚点失败: ${createError.message}`);
      }

      // 为新创建的锚点生成结果和日志
      createdAnchors?.forEach((anchor: any) => {
        results.set(anchor.text, {
          anchor,
          log: {
            action: 'created_new',
            word: anchor.text,
            language,
            anchorId: anchor.id,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        });
      });
    }

    console.log(`✅ 批量锚点处理完成: 找到 ${existingAnchors?.length || 0} 个现有锚点，创建 ${wordsToCreate.length} 个新锚点`);
    
    return results;
  } catch (error) {
    console.error('批量锚点处理失败:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const { supabase, userId } = await createUserSupabaseClient(req.headers.get('Authorization'));

    // 2. 速率限制检查
    await limiter.check(req, 10, userId);

    // 3. 解析请求数据
    const { explanations, contextBlockId, modelConfig, stream = false } = await req.json();

    if (!explanations || !Array.isArray(explanations)) {
      return NextResponse.json({ error: '缺少解释数据' }, { status: 400 });
    }

    if (!contextBlockId) {
      return NextResponse.json({ error: '缺少语境块ID' }, { status: 400 });
    }

    // 如果请求流式处理
    if (stream) {
      return handleStreamingProcess(supabase, userId, explanations, contextBlockId, modelConfig);
    }

    // 原有的批量处理逻辑
    const results = [];

    // 4. 处理每个词汇解释
    for (const explanation of explanations) {
      const { 
        original, 
        lemma, 
        meaning, 
        example, 
        tags = [], 
        startIndex, 
        endIndex,
        contextExplanation // 新增：上下文解释
      } = explanation;
      
      if (!original || !lemma || !meaning) {
        console.warn('跳过不完整的解释:', explanation);
        continue;
      }

      try {
        // 4.1 查找或创建锚点（使用lemma作为原型）- 添加处理日志
        console.log(`🔍 开始处理词汇: ${original} -> ${lemma}`);
        const anchorResult = await findOrCreateAnchorWithLog(supabase, userId, lemma);
        const anchor = anchorResult.anchor;
        
        // 4.2 创建或更新含义块，并获取处理日志
        const { meaningBlock, isNew, processingLog } = await createOrUpdateMeaningBlock(
          supabase,
          userId,
          anchor.id,
          meaning,
          contextExplanation || example, // 上下文解释
          contextBlockId, // 语境块ID
          startIndex, // 开始位置
          endIndex, // 结束位置
          tags,
          modelConfig, // 传递模型配置
          anchorResult.log.action === 'created_new' // 传递是否为新创建的锚点
        );

        // 4.2.1 获取原句（如果有位置信息）
        let originalSentence: string | undefined;
        if (contextBlockId && startIndex !== undefined && endIndex !== undefined) {
          try {
            const contextContent = await getContextBlockContent(supabase, contextBlockId);
            originalSentence = extractSentenceFromText(contextContent, startIndex, endIndex);
          } catch (error) {
            console.error('获取例句失败:', error);
          }
        }

        // 4.3 创建含义块与语境的关联（包含原始词形）
        const context = await createMeaningBlockContext(
          supabase,
          userId,
          meaningBlock.id,
          contextBlockId,
          original, // 原始词形（语境下的形态）
          startIndex,
          endIndex,
          contextExplanation || example,
          originalSentence,
          1.0 // 默认置信度
        );

        // 合并所有处理日志
        const allProcessingLogs = {
          ...processingLog,
          anchorCreation: anchorResult.log
        };

        results.push({
          original,
          lemma,
          anchor: anchor,
          meaningBlock: meaningBlock,
          context: context,
          isNewMeaning: isNew,
          processingLog: allProcessingLogs
        });

      } catch (error) {
        console.error(`处理词汇 ${original} 失败:`, error);
        results.push({
          original,
          lemma,
          error: (error as Error).message
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('处理锚点请求失败:', error);
    
    if ((error as Error).message.includes('未授权') || (error as Error).message.includes('验证失败')) {
      return NextResponse.json({ error: (error as Error).message }, { status: 401 });
    }
    
    if ((error as Error).message.includes('频繁')) {
      return NextResponse.json({ error: (error as Error).message }, { status: 429 });
    }

    return NextResponse.json({ 
      error: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}

// 优化的流式处理函数
async function handleStreamingProcess(
  supabase: any,
  userId: string,
  explanations: any[],
  contextBlockId: string,
  modelConfig?: { provider: string; modelName: string }
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const results = [];
      
      try {
        // 发送开始处理消息
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          total: explanations.length,
          message: '开始处理词汇锚点...'
        })}\n\n`));

        // 提取所有需要处理的词汇
        const validExplanations = explanations.filter(exp => exp.original && exp.lemma && exp.meaning);
        const wordsToProcess = validExplanations.map(exp => exp.lemma);
        
        console.log(`🚀 开始批量处理 ${validExplanations.length} 个词汇`);

        // 阶段1: 批量查询/创建锚点（一次性完成，不发送逐个开始消息）
        console.log(`🔍 开始批量查询锚点...`);
        const batchAnchorResults = await batchFindOrCreateAnchors(supabase, userId, wordsToProcess);
        console.log(`✅ 批量查询锚点完成，瞬间发送所有结果`);
        
        // 瞬间发送所有锚点查询完成消息（查询应该是瞬间的）
        for (const explanation of validExplanations) {
          const anchorResult = batchAnchorResults.get(explanation.lemma);
          if (anchorResult) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'anchor_check_complete',
              word: explanation.original,
              log: anchorResult.log,
              message: anchorResult.log.action === 'created_new' ? 
                `创建新锚点: ${explanation.original}` : `找到现有锚点: ${explanation.original}`
            })}\n\n`));
          }
        }

        // 阶段2: 逐个进行LLM辨析（这部分保持串行，因为需要LLM判断）
        const meaningBlocksToCreate = [];
        const contextsToCreate = [];
        
        console.log(`🤖 开始LLM辨析阶段，逐个串行处理...`);
        
        for (let i = 0; i < validExplanations.length; i++) {
          const explanation = validExplanations[i];
          const { 
            original, 
            lemma, 
            meaning, 
            example, 
            tags = [], 
            startIndex, 
            endIndex,
            contextExplanation
          } = explanation;

          try {
            const anchorResult = batchAnchorResults.get(lemma);
            if (!anchorResult) {
              throw new Error(`未找到锚点结果: ${lemma}`);
            }

            const anchor = anchorResult.anchor;
            const isOldAnchor = anchorResult.log.action === 'found_existing';
            const isNewAnchor = anchorResult.log.action === 'created_new';

            // 只对OLD锚点（已存在的锚点）发送LLM辨析开始消息
            if (isOldAnchor) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'meaning_analysis_start',
                word: original,
                index: i + 1,
                total: validExplanations.length,
                message: `LLM正在辨析含义: ${original} (${i + 1}/${validExplanations.length})`
              })}\n\n`));
            }

            // 创建或更新含义块
            const { meaningBlock, isNew, processingLog } = await createOrUpdateMeaningBlock(
              supabase,
              userId,
              anchor.id,
              meaning,
              contextExplanation || example,
              contextBlockId,
              startIndex,
              endIndex,
              tags,
              modelConfig,
              isNewAnchor // 传递是否为新创建的锚点
            );

            // 发送LLM辨析完成消息
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'meaning_analysis_complete',
              word: original,
              log: processingLog,
              isNew,
              index: i + 1,
              total: validExplanations.length,
              message: `辨析完成: ${original} (${isNew ? '新建' : '已存在'}) (${i + 1}/${validExplanations.length})`
            })}\n\n`));

            // 准备语境关联数据（延后批量插入）
            let originalSentence: string | undefined;
            if (contextBlockId && startIndex !== undefined && endIndex !== undefined) {
              try {
                const contextContent = await getContextBlockContent(supabase, contextBlockId);
                originalSentence = extractSentenceFromText(contextContent, startIndex, endIndex);
              } catch (error) {
                console.error('获取例句失败:', error);
              }
            }

            const contextData = {
              meaning_block_id: meaningBlock.id,
              context_block_id: contextBlockId,
              original_word_form: original,
              start_position: startIndex,
              end_position: endIndex,
              confidence_score: 1.0,
              context_explanation: contextExplanation || example,
              original_sentence: originalSentence,
            };

            contextsToCreate.push({
              data: contextData,
              explanation: {
                original,
                lemma,
                anchor,
                meaningBlock,
                isNew,
                processingLog: {
                  ...processingLog,
                  anchorCreation: anchorResult.log
                }
              }
            });

          } catch (error) {
            console.error(`处理词汇 ${original} 失败:`, error);
            
            // 发送错误消息
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              word: original,
              error: (error as Error).message,
              message: `处理失败: ${original}`
            })}\n\n`));

            results.push({
              original,
              lemma,
              error: (error as Error).message
            });
          }
        }

        // 阶段3: 批量保存语境关联
        if (contextsToCreate.length > 0) {
          console.log(`💾 开始批量保存 ${contextsToCreate.length} 个语境关联`);
          
          // 发送批量保存开始消息
          for (let i = 0; i < contextsToCreate.length; i++) {
            const item = contextsToCreate[i];
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'save_start',
              word: item.explanation.original,
              index: i + 1,
              total: contextsToCreate.length,
              message: `正在保存: ${item.explanation.original} (${i + 1}/${contextsToCreate.length})`
            })}\n\n`));
          }

          try {
            // 批量插入语境关联
            const { data: createdContexts, error: contextError } = await supabase
              .from('meaning_block_contexts')
              .insert(contextsToCreate.map(item => item.data))
              .select();

            if (contextError) {
              throw new Error(`批量创建语境关联失败: ${contextError.message}`);
            }

            // 生成成功结果并发送完成消息
            for (let i = 0; i < contextsToCreate.length; i++) {
              const item = contextsToCreate[i];
              const context = createdContexts?.[i];

              const wordResult = {
                original: item.explanation.original,
                lemma: item.explanation.lemma,
                anchor: item.explanation.anchor,
                meaningBlock: item.explanation.meaningBlock,
                context: context,
                isNewMeaning: item.explanation.isNew,
                processingLog: item.explanation.processingLog
              };

              results.push(wordResult);

              // 发送保存完成消息
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'save_complete',
                word: item.explanation.original,
                result: wordResult,
                index: i + 1,
                total: contextsToCreate.length,
                message: `保存完成: ${item.explanation.original} (${i + 1}/${contextsToCreate.length})`
              })}\n\n`));
            }

            console.log(`✅ 批量保存完成: ${createdContexts?.length || 0} 个语境关联`);

          } catch (error) {
            console.error('批量保存语境关联失败:', error);
            
            // 为每个失败的项目发送错误消息
            for (const item of contextsToCreate) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                word: item.explanation.original,
                error: (error as Error).message,
                message: `保存失败: ${item.explanation.original}`
              })}\n\n`));

              results.push({
                original: item.explanation.original,
                lemma: item.explanation.lemma,
                error: (error as Error).message
              });
            }
          }
        }

        // 发送完成消息
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          success: true,
          processed: results.length,
          results,
          message: `处理完成，共处理 ${results.length} 个词汇`
        })}\n\n`));

      } catch (error) {
        console.error('流式处理失败:', error);
        
        // 发送错误消息
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: (error as Error).message,
          message: '处理过程中发生错误'
        })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
} 