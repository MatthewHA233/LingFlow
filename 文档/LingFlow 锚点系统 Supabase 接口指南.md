# LingFlow 锚点系统 Supabase 接口指南

## 目录
1. [基础配置](#基础配置)
2. [锚点管理](#锚点管理)
3. [含义块管理](#含义块管理)
4. [复习系统](#复习系统)
5. [语境关联](#语境关联)
6. [统计分析](#统计分析)
7. [高级查询](#高级查询)
8. [最佳实践](#最佳实践)
9. [大语言模型生成格式](#大语言模型生成格式)

## 基础配置

### Supabase 客户端设置

```typescript
// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 类型定义导入

```typescript
import { 
  Anchor, 
  MeaningBlock, 
  MeaningBlockContext, 
  ProficiencyRecord,
  ReviewSession,
  ReviewQueue 
} from '@/types/anchor'

// 新增类型定义
interface ExampleSentenceData {
  context_explanation: string;  // 上下文解释
  original_sentence: string;    // 原始完整句子
  source_context_id?: string;   // 来源语境块ID
}

interface LLMGeneratedMeaning {
  phonetic: string;        // 音标，如 /məˈʃiːn/
  chinese_meaning: string; // 中文含义，如 机器，设备
  part_of_speech: string[]; // 词性，如 ['noun', 'countable']
  context_explanation: string; // 上下文解释
  original_sentence: string;   // 原始句子
}
```

## 大语言模型生成格式

### 生成内容结构
大语言模型为词汇生成的解释包含以下部分：
1. **单词原型** - 存储在 `anchors.text` 字段
2. **音标** - 存储在 `meaning_blocks.meaning` 字段前部分
3. **词性** - 存储在 `meaning_blocks.tags` 数组中
4. **中文解释** - 存储在 `meaning_blocks.meaning` 字段后部分
5. **上下文解释** - 存储在 `meaning_blocks.example_sentence` JSON 的 `context_explanation`
6. **原始句子** - 存储在 `meaning_blocks.example_sentence` JSON 的 `original_sentence`

### 数据格式规范

```typescript
// meaning 字段格式：音标 + 中文含义
const meaningFormat = "/məˈʃiːn/ 机器，设备";

// example_sentence 字段格式：JSON
const exampleSentenceFormat = {
  context_explanation: "在工业生产中使用的自动化设备",
  original_sentence: "这台机器运行得很好。",
  source_context_id: "context-block-uuid"
};

// tags 字段格式：词性数组
const tagsFormat = ["noun", "countable"];
```

## 锚点管理

### 1. 创建锚点

```typescript
// services/anchor.service.ts

/**
 * 创建新锚点 - 使用词汇原型形式
 */
export async function createAnchor(anchorData: {
  text: string;  // 存储词汇原型，无需标准化
  type: 'word' | 'phrase' | 'compound';
  language?: string;
}) {
  const { data, error } = await supabase
    .from('anchors')
    .insert({
      text: anchorData.text.trim(), // 只进行简单的去空格处理
      type: anchorData.type,
      language: anchorData.language || 'en'
    })
    .select()
    .single();

  if (error) throw error;
  return data as Anchor;
}
```

### 2. 查找或创建锚点

```typescript
/**
 * 查找锚点，如果不存在则创建
 */
export async function findOrCreateAnchor(
  text: string, 
  type: 'word' | 'phrase' | 'compound' = 'word'
) {
  const trimmedText = text.trim();
  
  // 首先尝试查找（基于 text 字段精确匹配）
  const { data: existing, error: findError } = await supabase
    .from('anchors')
    .select('*')
    .eq('text', trimmedText)
    .eq('language', 'en')
    .single();

  if (existing) return existing as Anchor;
  
  // 如果不存在则创建
  if (findError?.code === 'PGRST116') { // 未找到记录
    return await createAnchor({ text: trimmedText, type });
  }
  
  throw findError;
}
```

### 3. 获取锚点详情

```typescript
/**
 * 获取锚点完整信息，包括格式化的含义块
 */
export async function getAnchorWithDetails(anchorId: string) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')  // 使用格式化视图
    .select('*')
    .eq('anchor_id', anchorId);

  if (error) throw error;
  return data;
}
```

### 4. 搜索锚点

```typescript
/**
 * 模糊搜索锚点
 */
export async function searchAnchors(query: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('anchors')
    .select(`
      *,
      meaning_blocks!inner (count)
    `)
    .ilike('text', `%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data as Anchor[];
}
```

## 含义块管理

### 1. 创建含义块（基于LLM生成格式）

```typescript
/**
 * 为锚点创建含义块 - 使用LLM生成的格式
 */
export async function createMeaningBlockFromLLM(meaningData: {
  anchor_id: string;
  phonetic: string;           // 音标
  chinese_meaning: string;    // 中文含义
  part_of_speech: string[];   // 词性数组
  context_explanation: string; // 上下文解释
  original_sentence: string;   // 原始句子
  source_context_id?: string;  // 来源语境块ID
}) {
  // 组合 meaning 字段：音标 + 中文含义
  const meaning = `/${meaningData.phonetic}/ ${meaningData.chinese_meaning}`;
  
  // 构建 example_sentence JSON
  const example_sentence = {
    context_explanation: meaningData.context_explanation,
    original_sentence: meaningData.original_sentence,
    source_context_id: meaningData.source_context_id || null
  };

  const { data, error } = await supabase
    .from('meaning_blocks')
    .insert({
      anchor_id: meaningData.anchor_id,
      meaning: meaning,
      example_sentence: example_sentence,
      tags: meaningData.part_of_speech,
      current_proficiency: 0.0,
      easiness_factor: 2.5,
      interval_days: 1,
      next_review_date: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data as MeaningBlock;
}
```

### 2. 传统方式创建含义块

```typescript
/**
 * 传统方式创建含义块
 */
export async function createMeaningBlock(meaningData: {
  anchor_id: string;
  meaning: string;  // 格式：/音标/ 中文含义
  example_sentence: ExampleSentenceData;
  tags?: string[];
}) {
  const { data, error } = await supabase
    .from('meaning_blocks')
    .insert({
      anchor_id: meaningData.anchor_id,
      meaning: meaningData.meaning,
      example_sentence: meaningData.example_sentence,
      tags: meaningData.tags || [],
      current_proficiency: 0.0,
      easiness_factor: 2.5,
      interval_days: 1,
      next_review_date: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data as MeaningBlock;
}
```

### 3. 更新含义块

```typescript
/**
 * 更新含义块信息
 */
export async function updateMeaningBlock(
  meaningBlockId: string, 
  updates: Partial<{
    meaning: string;
    example_sentence: ExampleSentenceData;
    tags: string[];
  }>
) {
  const { data, error } = await supabase
    .from('meaning_blocks')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', meaningBlockId)
    .select()
    .single();

  if (error) throw error;
  return data as MeaningBlock;
}
```

### 4. 获取格式化的含义块

```typescript
/**
 * 获取格式化的含义块（分离音标和中文含义）
 */
export async function getFormattedMeaningBlock(meaningBlockId: string) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .eq('id', meaningBlockId)
    .single();

  if (error) throw error;
  return data;
}
```

## 复习系统

### 1. 记录复习结果

```typescript
/**
 * 记录复习结果并更新熟练度
 */
export async function recordReview(session: ReviewSession) {
  const { data, error } = await supabase
    .rpc('update_proficiency_with_review', {
      p_meaning_block_id: session.meaning_block_id,
      p_quality_score: session.quality_score,
      p_review_duration_seconds: session.review_duration_seconds
    });

  if (error) throw error;
  return data;
}
```

### 2. 获取复习队列（使用格式化视图）

```typescript
/**
 * 获取今日复习队列 - 使用格式化视图
 */
export async function getReviewQueue(): Promise<ReviewQueue> {
  const today = new Date().toISOString().split('T')[0];
  
  // 今日到期
  const { data: dueToday, error: dueTodayError } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .lte('next_review_date', `${today}T23:59:59`)
    .gte('next_review_date', `${today}T00:00:00`);

  // 过期
  const { data: overdue, error: overdueError } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .lt('next_review_date', `${today}T00:00:00`);

  // 即将到期（未来7天）
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const { data: upcoming, error: upcomingError } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .gt('next_review_date', `${today}T23:59:59`)
    .lte('next_review_date', nextWeek.toISOString())
    .order('next_review_date', { ascending: true });

  if (dueTodayError || overdueError || upcomingError) {
    throw dueTodayError || overdueError || upcomingError;
  }

  return {
    due_today: dueToday as any[],
    overdue: overdue as any[],
    upcoming: upcoming as any[]
  };
}
```

### 3. 计算自然衰减

```typescript
/**
 * 计算含义块的自然衰减熟练度
 */
export async function calculateNaturalDecay(meaningBlockId: string) {
  const { data, error } = await supabase
    .rpc('calculate_natural_decay', {
      p_meaning_block_id: meaningBlockId
    });

  if (error) throw error;
  return data as number;
}
```

### 4. 获取复习统计

```typescript
/**
 * 获取复习统计信息
 */
export async function getReviewStats(userId?: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('proficiency_records')
    .select(`
      *,
      meaning_block:meaning_blocks (
        anchor:anchors (text, type)
      )
    `)
    .gte('reviewed_at', startDate.toISOString())
    .order('reviewed_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

## 语境关联

### 1. 创建语境关联

```typescript
/**
 * 将含义块与语境块关联
 */
export async function createMeaningBlockContext(contextData: {
  meaning_block_id: string;
  context_block_id: string;
  start_position?: number;
  end_position?: number;
  confidence_score?: number;
}) {
  const { data, error } = await supabase
    .from('meaning_block_contexts')
    .insert({
      meaning_block_id: contextData.meaning_block_id,
      context_block_id: contextData.context_block_id,
      start_position: contextData.start_position,
      end_position: contextData.end_position,
      confidence_score: contextData.confidence_score || 1.0
    })
    .select()
    .single();

  if (error) throw error;
  return data as MeaningBlockContext;
}
```

### 2. 批量创建语境关联（从LLM解释结果）

```typescript
/**
 * 从LLM解释结果批量创建语境关联
 */
export async function createContextsFromLLMResult(
  llmResult: LLMGeneratedMeaning,
  contextBlockId: string
) {
  // 1. 创建或查找锚点
  const anchor = await findOrCreateAnchor(llmResult.phonetic.replace(/[\/]/g, ''), 'word');
  
  // 2. 创建含义块
  const meaningBlock = await createMeaningBlockFromLLM({
    anchor_id: anchor.id,
    phonetic: llmResult.phonetic,
    chinese_meaning: llmResult.chinese_meaning,
    part_of_speech: llmResult.part_of_speech,
    context_explanation: llmResult.context_explanation,
    original_sentence: llmResult.original_sentence,
    source_context_id: contextBlockId
  });

  // 3. 创建语境关联
  const context = await createMeaningBlockContext({
    meaning_block_id: meaningBlock.id,
    context_block_id: contextBlockId
  });

  return { anchor, meaningBlock, context };
}
```

### 3. 获取语境块的锚点

```typescript
/**
 * 获取特定语境块中的所有锚点
 */
export async function getAnchorsInContextBlock(contextBlockId: string) {
  const { data, error } = await supabase
    .from('meaning_block_contexts')
    .select(`
      *,
      meaning_block:meaning_blocks (
        *,
        anchor:anchors (*)
      )
    `)
    .eq('context_block_id', contextBlockId);

  if (error) throw error;
  return data;
}
```

## 统计分析

### 1. 获取锚点统计

```typescript
/**
 * 获取锚点系统总体统计
 */
export async function getAnchorSystemStats() {
  // 总锚点数
  const { count: totalAnchors, error: anchorsError } = await supabase
    .from('anchors')
    .select('*', { count: 'exact', head: true });

  // 总含义块数
  const { count: totalMeaningBlocks, error: meaningBlocksError } = await supabase
    .from('meaning_blocks')
    .select('*', { count: 'exact', head: true });

  // 今日复习数
  const today = new Date().toISOString().split('T')[0];
  const { count: todayReviews, error: reviewsError } = await supabase
    .from('proficiency_records')
    .select('*', { count: 'exact', head: true })
    .gte('reviewed_at', `${today}T00:00:00`)
    .lt('reviewed_at', `${today}T23:59:59`);

  // 平均熟练度
  const { data: avgProficiency, error: proficiencyError } = await supabase
    .from('meaning_blocks')
    .select('current_proficiency');

  if (anchorsError || meaningBlocksError || reviewsError || proficiencyError) {
    throw anchorsError || meaningBlocksError || reviewsError || proficiencyError;
  }

  const averageProficiency = avgProficiency?.length 
    ? avgProficiency.reduce((sum, block) => sum + block.current_proficiency, 0) / avgProficiency.length
    : 0;

  return {
    totalAnchors: totalAnchors || 0,
    totalMeaningBlocks: totalMeaningBlocks || 0,
    todayReviews: todayReviews || 0,
    averageProficiency: Math.round(averageProficiency * 100) / 100
  };
}
```

### 2. 获取熟练度分布

```typescript
/**
 * 获取熟练度分布统计
 */
export async function getProficiencyDistribution() {
  const { data, error } = await supabase
    .from('meaning_blocks')
    .select('current_proficiency');

  if (error) throw error;

  const distribution = {
    beginner: 0,    // 0-0.3
    intermediate: 0, // 0.3-0.7
    advanced: 0,    // 0.7-1.0
    mastered: 0     // 1.0
  };

  data?.forEach(block => {
    const proficiency = block.current_proficiency;
    if (proficiency >= 1.0) distribution.mastered++;
    else if (proficiency >= 0.7) distribution.advanced++;
    else if (proficiency >= 0.3) distribution.intermediate++;
    else distribution.beginner++;
  });

  return distribution;
}
```

### 3. 获取复习趋势

```typescript
/**
 * 获取最近30天的复习趋势
 */
export async function getReviewTrend(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('proficiency_records')
    .select('reviewed_at, quality_score, proficiency_after')
    .gte('reviewed_at', startDate.toISOString())
    .order('reviewed_at', { ascending: true });

  if (error) throw error;

  // 按日期分组统计
  const dailyStats = new Map();
  
  data?.forEach(record => {
    const date = record.reviewed_at.split('T')[0];
    if (!dailyStats.has(date)) {
      dailyStats.set(date, {
        date,
        reviewCount: 0,
        averageQuality: 0,
        averageProficiency: 0,
        totalQuality: 0,
        totalProficiency: 0
      });
    }
    
    const stats = dailyStats.get(date);
    stats.reviewCount++;
    stats.totalQuality += record.quality_score;
    stats.totalProficiency += record.proficiency_after;
    stats.averageQuality = stats.totalQuality / stats.reviewCount;
    stats.averageProficiency = stats.totalProficiency / stats.reviewCount;
  });

  return Array.from(dailyStats.values());
}
```

## 高级查询

### 1. 智能推荐复习（使用格式化视图）

```typescript
/**
 * 智能推荐需要复习的含义块
 */
export async function getIntelligentReviewRecommendations(limit: number = 10) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .order('current_proficiency', { ascending: true })
    .order('next_review_date', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return data?.map(block => ({
    ...block,
    recommendation_score: calculateRecommendationScore(block)
  }));
}

function calculateRecommendationScore(block: any): number {
  const proficiencyWeight = (1 - block.current_proficiency) * 0.4;
  const timeWeight = block.next_review_date < new Date().toISOString() ? 0.3 : 0;
  const reviewCountWeight = Math.min(block.review_count / 10, 1) * 0.3;
  
  return proficiencyWeight + timeWeight + reviewCountWeight;
}
```

### 2. 按词性分组查询

```typescript
/**
 * 按词性分组查询含义块
 */
export async function getMeaningBlocksByPartOfSpeech(partOfSpeech: string) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .contains('tags', [partOfSpeech]);

  if (error) throw error;
  return data;
}
```

### 3. 音标搜索

```typescript
/**
 * 基于音标搜索
 */
export async function searchByPhonetic(phoneticPattern: string) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .ilike('phonetic', `%${phoneticPattern}%`);

  if (error) throw error;
  return data;
}
```

## 最佳实践

### 1. LLM结果处理

```typescript
/**
 * 处理LLM生成的词汇解释结果
 */
export async function processLLMVocabularyExplanation(
  llmResponse: string,
  contextBlockId: string
): Promise<any[]> {
  // 解析LLM响应为结构化数据
  const parsedResults = parseLLMResponse(llmResponse);
  
  const results = [];
  
  for (const result of parsedResults) {
    try {
      const processed = await createContextsFromLLMResult(result, contextBlockId);
      results.push(processed);
    } catch (error) {
      console.error('处理词汇失败:', result, error);
      // 继续处理其他词汇
    }
  }
  
  return results;
}

function parseLLMResponse(response: string): LLMGeneratedMeaning[] {
  // 这里需要根据实际的LLM响应格式来实现解析逻辑
  // 示例格式可能是：
  // 单词: machine
  // 音标: /məˈʃiːn/
  // 词性: noun, countable
  // 中文释义: 机器，设备
  // 上下文解释: 在工业生产中使用的自动化设备
  
  // 实现具体的解析逻辑...
  return [];
}
```

### 2. 错误处理

```typescript
// utils/error-handler.ts
export class AnchorSystemError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AnchorSystemError';
  }
}

export function handleSupabaseError(error: any): never {
  if (error.code === 'PGRST116') {
    throw new AnchorSystemError('记录未找到', 'NOT_FOUND');
  }
  if (error.code === '23505') {
    throw new AnchorSystemError('记录已存在', 'DUPLICATE');
  }
  if (error.code === '23503') {
    throw new AnchorSystemError('违反外键约束', 'FOREIGN_KEY_VIOLATION');
  }
  throw new AnchorSystemError(error.message || '数据库操作失败');
}
```

### 3. 数据验证

```typescript
/**
 * 验证含义块数据格式
 */
export function validateMeaningBlockData(data: any): boolean {
  // 验证 meaning 字段格式
  const meaningPattern = /^\/[^\/]+\/\s+.+/;
  if (!meaningPattern.test(data.meaning)) {
    throw new AnchorSystemError('meaning 字段格式不正确，应为 /音标/ 中文含义');
  }

  // 验证 example_sentence JSON 格式
  if (data.example_sentence) {
    const required = ['context_explanation', 'original_sentence'];
    for (const field of required) {
      if (!data.example_sentence[field]) {
        throw new AnchorSystemError(`example_sentence 缺少必需字段: ${field}`);
      }
    }
  }

  // 验证 tags 是否为数组
  if (data.tags && !Array.isArray(data.tags)) {
    throw new AnchorSystemError('tags 字段必须是数组');
  }

  return true;
}
```

### 4. 使用示例

```typescript
// 完整的使用示例
async function exampleUsageWithNewFormat() {
  try {
    // 1. 使用LLM格式创建锚点和含义块
    const llmData: LLMGeneratedMeaning = {
      phonetic: 'məˈʃiːn',
      chinese_meaning: '机器，设备',
      part_of_speech: ['noun', 'countable'],
      context_explanation: '在工业生产中使用的自动化设备',
      original_sentence: '这台机器运行得很好。'
    };

    const anchor = await findOrCreateAnchor('machine', 'word');
    const meaningBlock = await createMeaningBlockFromLLM({
      anchor_id: anchor.id,
      ...llmData,
      source_context_id: 'context-block-id'
    });

    // 2. 获取格式化的数据
    const formatted = await getFormattedMeaningBlock(meaningBlock.id);
    console.log('音标:', formatted.phonetic);
    console.log('中文含义:', formatted.chinese_meaning);
    console.log('上下文解释:', formatted.context_explanation);

    // 3. 进行复习
    await recordReview({
      meaning_block_id: meaningBlock.id,
      quality_score: 4,
      review_duration_seconds: 30
    });

    // 4. 获取复习队列
    const reviewQueue = await getReviewQueue();
    console.log('今日需要复习的项目:', reviewQueue.due_today.length);

  } catch (error) {
    handleSupabaseError(error);
  }
}
```

### 5. 性能优化查询

```typescript
/**
 * 批量获取格式化的含义块
 */
export async function getBatchFormattedMeaningBlocks(ids: string[]) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .in('id', ids);

  if (error) throw error;
  return data;
}

/**
 * 获取包含特定词性的所有含义块
 */
export async function getMeaningBlocksWithPartOfSpeech(pos: string[]) {
  const { data, error } = await supabase
    .from('meaning_blocks_formatted')
    .select('*')
    .overlaps('tags', pos);

  if (error) throw error;
  return data;
}
```

这个更新后的接口指南反映了表结构的变化，支持大语言模型生成的词汇解释格式，包括音标、词性、中文释义和上下文信息的结构化存储。主要改进包括：

1. **删除了 `normalized_text` 相关的所有引用**
2. **更新了 `meaning` 字段的使用方式**（存储音标+中文含义）
3. **将 `example_sentence` 改为 JSON 格式**（存储上下文解释和原句）
4. **增加了 LLM 生成格式的专门处理方法**
5. **提供了格式化视图的使用示例**
6. **增加了数据验证和错误处理**
