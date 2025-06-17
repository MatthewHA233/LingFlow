
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
```

## 锚点管理

### 1. 创建锚点

```typescript
// services/anchor.service.ts

/**
 * 创建新锚点
 */
export async function createAnchor(anchorData: {
  text: string;
  type: 'word' | 'phrase' | 'compound';
  language?: string;
}) {
  const { data, error } = await supabase
    .from('anchors')
    .insert({
      text: anchorData.text,
      type: anchorData.type,
      normalized_text: anchorData.text.toLowerCase().trim(),
      language: anchorData.language || 'zh'
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
  const normalizedText = text.toLowerCase().trim();
  
  // 首先尝试查找
  const { data: existing, error: findError } = await supabase
    .from('anchors')
    .select('*')
    .eq('normalized_text', normalizedText)
    .eq('language', 'zh')
    .single();

  if (existing) return existing as Anchor;
  
  // 如果不存在则创建
  if (findError?.code === 'PGRST116') { // 未找到记录
    return await createAnchor({ text, type });
  }
  
  throw findError;
}
```

### 3. 获取锚点详情

```typescript
/**
 * 获取锚点完整信息，包括含义块
 */
export async function getAnchorWithDetails(anchorId: string) {
  const { data, error } = await supabase
    .from('anchors')
    .select(`
      *,
      meaning_blocks (
        *,
        proficiency_records (
          *
        ),
        meaning_block_contexts (
          *,
          context_block:context_blocks (
            id,
            content,
            block_type,
            created_at
          )
        )
      )
    `)
    .eq('id', anchorId)
    .single();

  if (error) throw error;
  return data as Anchor;
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

### 1. 创建含义块

```typescript
/**
 * 为锚点创建含义块
 */
export async function createMeaningBlock(meaningData: {
  anchor_id: string;
  meaning: string;
  example_sentence?: string;
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

### 2. 更新含义块

```typescript
/**
 * 更新含义块信息
 */
export async function updateMeaningBlock(
  meaningBlockId: string, 
  updates: Partial<Pick<MeaningBlock, 'meaning' | 'example_sentence' | 'tags'>>
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

### 3. 删除含义块

```typescript
/**
 * 删除含义块（会级联删除相关记录）
 */
export async function deleteMeaningBlock(meaningBlockId: string) {
  const { error } = await supabase
    .from('meaning_blocks')
    .delete()
    .eq('id', meaningBlockId);

  if (error) throw error;
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

### 2. 获取复习队列

```typescript
/**
 * 获取今日复习队列
 */
export async function getReviewQueue(): Promise<ReviewQueue> {
  const today = new Date().toISOString().split('T')[0];
  
  // 今日到期
  const { data: dueToday, error: dueTodayError } = await supabase
    .from('meaning_blocks')
    .select(`
      *,
      anchors (text, type),
      meaning_block_contexts (
        context_block:context_blocks (
          id, content, block_type
        )
      )
    `)
    .lte('next_review_date', `${today}T23:59:59`)
    .gte('next_review_date', `${today}T00:00:00`);

  // 过期
  const { data: overdue, error: overdueError } = await supabase
    .from('meaning_blocks')
    .select(`
      *,
      anchors (text, type),
      meaning_block_contexts (
        context_block:context_blocks (
          id, content, block_type
        )
      )
    `)
    .lt('next_review_date', `${today}T00:00:00`);

  // 即将到期（未来7天）
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const { data: upcoming, error: upcomingError } = await supabase
    .from('meaning_blocks')
    .select(`
      *,
      anchors (text, type)
    `)
    .gt('next_review_date', `${today}T23:59:59`)
    .lte('next_review_date', nextWeek.toISOString())
    .order('next_review_date', { ascending: true });

  if (dueTodayError || overdueError || upcomingError) {
    throw dueTodayError || overdueError || upcomingError;
  }

  return {
    due_today: dueToday as MeaningBlock[],
    overdue: overdue as MeaningBlock[],
    upcoming: upcoming as MeaningBlock[]
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

### 2. 批量创建语境关联

```typescript
/**
 * 批量创建语境关联
 */
export async function batchCreateContexts(
  meaningBlockId: string,
  contextBlocks: Array<{
    context_block_id: string;
    start_position?: number;
    end_position?: number;
  }>
) {
  const insertData = contextBlocks.map(block => ({
    meaning_block_id: meaningBlockId,
    context_block_id: block.context_block_id,
    start_position: block.start_position,
    end_position: block.end_position,
    confidence_score: 1.0
  }));

  const { data, error } = await supabase
    .from('meaning_block_contexts')
    .insert(insertData)
    .select();

  if (error) throw error;
  return data as MeaningBlockContext[];
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

### 1. 智能推荐复习

```typescript
/**
 * 智能推荐需要复习的含义块
 */
export async function getIntelligentReviewRecommendations(limit: number = 10) {
  const { data, error } = await supabase
    .from('meaning_blocks')
    .select(`
      *,
      anchors (text, type),
      proficiency_records (
        reviewed_at,
        quality_score
      )
    `)
    .order('current_proficiency', { ascending: true })
    .order('next_review_date', { ascending: true })
    .limit(limit);

  if (error) throw error;

  // 可以添加更复杂的推荐算法
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

### 2. 相关锚点推荐

```typescript
/**
 * 基于上下文推荐相关锚点
 */
export async function getRelatedAnchors(anchorId: string, limit: number = 5) {
  // 查找在相同语境块中出现的其他锚点
  const { data, error } = await supabase
    .from('meaning_block_contexts')
    .select(`
      context_block_id,
      meaning_block:meaning_blocks (
        anchor:anchors (*)
      )
    `)
    .in('context_block_id', 
      // 子查询：获取当前锚点出现的所有语境块
      supabase
        .from('meaning_block_contexts')
        .select('context_block_id')
        .in('meaning_block_id',
          supabase
            .from('meaning_blocks')
            .select('id')
            .eq('anchor_id', anchorId)
        )
    )
    .limit(limit);

  if (error) throw error;
  return data;
}
```

## 最佳实践

### 1. 错误处理

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
  throw new AnchorSystemError(error.message || '数据库操作失败');
}
```

### 2. 缓存策略

```typescript
// utils/cache.ts
import { createClient } from '@supabase/supabase-js';

class AnchorCache {
  private cache = new Map();
  private ttl = 5 * 60 * 1000; // 5分钟

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  invalidate(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

export const anchorCache = new AnchorCache();
```

### 3. 批量操作

```typescript
/**
 * 批量处理锚点创建，避免重复查询
 */
export async function batchProcessAnchors(
  anchors: Array<{text: string, type: 'word' | 'phrase' | 'compound'}>
) {
  // 先批量查询已存在的锚点
  const texts = anchors.map(a => a.text.toLowerCase().trim());
  const { data: existing } = await supabase
    .from('anchors')
    .select('normalized_text, id')
    .in('normalized_text', texts);

  const existingTexts = new Set(existing?.map(a => a.normalized_text) || []);
  
  // 筛选出需要创建的锚点
  const toCreate = anchors.filter(
    anchor => !existingTexts.has(anchor.text.toLowerCase().trim())
  );

  // 批量创建
  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from('anchors')
      .insert(toCreate.map(anchor => ({
        text: anchor.text,
        type: anchor.type,
        normalized_text: anchor.text.toLowerCase().trim(),
        language: 'zh'
      })))
      .select();

    if (error) throw error;
    return [...(existing || []), ...(created || [])];
  }

  return existing || [];
}
```

### 4. 性能监控

```typescript
// utils/performance.ts
export function withPerformanceMonitoring<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      if (duration > 1000) { // 超过1秒的操作记录警告
        console.warn(`Slow operation: ${operation} took ${duration}ms`);
      }
      
      resolve(result);
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`Operation failed: ${operation} after ${duration}ms`, error);
      reject(error);
    }
  });
}

// 使用示例
export const getAnchorWithDetailsMonitored = (anchorId: string) =>
  withPerformanceMonitoring(
    `getAnchorWithDetails(${anchorId})`,
    () => getAnchorWithDetails(anchorId)
  );
```

### 5. 使用示例

```typescript
// 完整的使用示例
async function exampleUsage() {
  try {
    // 1. 创建锚点和含义块
    const anchor = await findOrCreateAnchor('机器学习', 'phrase');
    const meaningBlock = await createMeaningBlock({
      anchor_id: anchor.id,
      meaning: '一种人工智能技术，通过算法从数据中学习模式',
      example_sentence: '机器学习在图像识别中有广泛应用',
      tags: ['AI', '技术', '算法']
    });

    // 2. 关联到语境块
    await createMeaningBlockContext({
      meaning_block_id: meaningBlock.id,
      context_block_id: 'some-context-block-id',
      start_position: 10,
      end_position: 14
    });

    // 3. 进行复习
    await recordReview({
      meaning_block_id: meaningBlock.id,
      quality_score: 4,
      review_duration_seconds: 30
    });

    // 4. 获取复习队列
    const reviewQueue = await getReviewQueue();
    console.log('今日需要复习的项目:', reviewQueue.due_today.length);

    // 5. 获取统计信息
    const stats = await getAnchorSystemStats();
    console.log('系统统计:', stats);

  } catch (error) {
    handleSupabaseError(error);
  }
}
```

这个接口指南提供了完整的锚点系统操作方法，包括CRUD操作、复习算法、统计分析等功能。建议在实际使用时根据具体需求进行调整和优化。
