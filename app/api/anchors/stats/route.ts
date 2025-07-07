import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

// 强制动态渲染
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 指定运行时，避免静态生成错误
export const runtime = 'nodejs';

// 设置速率限制器
const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500
});

// 创建服务客户端（用于绕过RLS策略，但仍需手动过滤用户数据）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 验证用户身份的辅助函数
async function authenticateUser(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('未授权访问');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('用户验证失败');
  }
  
  return user.id;
}

// 获取时间域统计 - 使用服务密钥但显式过滤用户数据
async function getTimeDomainStats(userId: string, startDate?: string, endDate?: string, groupBy: 'day' | 'week' | 'month' = 'day') {
  console.log('开始获取时间域数据，参数:', { userId, startDate, endDate, groupBy });

  // 使用服务密钥查询，但显式添加用户过滤
  let query = supabase
    .from('meaning_blocks_formatted')
    .select(`
      id,
      anchor_id,
      meaning,
      tags,
      created_at,
      current_proficiency,
      review_count,
      next_review_date,
      easiness_factor,
      interval_days,
      anchor_text,
      anchor_type,
      context_explanation,
      original_sentence,
      original_word_form,
      source_context_id,
      example_created_at,
      start_position,
      end_position,
      confidence_score,
      example_index,
      user_id
    `)
    .eq('user_id', userId) // 关键：显式添加用户过滤
    .order('created_at', { ascending: false });

  // 添加日期过滤
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data: formattedData, error } = await query;

  console.log('视图查询结果:', { 
    count: formattedData?.length, 
    error,
    sample: formattedData?.slice(0, 2),
    userId // 添加用户ID到日志
  });

  if (error) {
    throw new Error(`获取格式化数据失败: ${error.message}`);
  }

  if (!formattedData || formattedData.length === 0) {
    return { timeDomains: [] };
  }

  // 按时间分组含义块
  const timeGroups = new Map<string, any[]>();
  
  formattedData.forEach((item: any) => {
    const date = new Date(item.created_at);
    let groupKey: string;
    
    switch (groupBy) {
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        groupKey = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'day':
      default:
        groupKey = date.toISOString().split('T')[0];
        break;
    }
    
    if (!timeGroups.has(groupKey)) {
      timeGroups.set(groupKey, []);
    }
    timeGroups.get(groupKey)!.push(item);
  });

  // 构建时间域数据结构
  const timeDomains = [];
  
  for (const [timeKey, itemsInGroup] of Array.from(timeGroups.entries())) {
    // 按锚点分组
    const anchorGroups = new Map<string, any>();
    
    itemsInGroup.forEach((item: any) => {
      const anchorId = item.anchor_id;
      
      if (!anchorGroups.has(anchorId)) {
        anchorGroups.set(anchorId, {
          id: anchorId,
          text: item.anchor_text,
          type: item.anchor_type || 'word',
          language: 'en', // 默认英语
          total_contexts: 0,
          total_meaning_blocks: 0,
          created_at: item.created_at,
          updated_at: item.created_at,
          meaning_blocks: new Map() // 使用Map避免重复
        });
      }
      
      const anchor = anchorGroups.get(anchorId)!;
      const meaningBlockId = item.id;
      
      // 如果含义块不存在，创建它
      if (!anchor.meaning_blocks.has(meaningBlockId)) {
        anchor.meaning_blocks.set(meaningBlockId, {
          id: meaningBlockId,
          anchor_id: anchorId,
          meaning: item.meaning,
          tags: item.tags || [],
          current_proficiency: item.current_proficiency || 0,
          review_count: item.review_count || 0,
          next_review_date: item.next_review_date,
          easiness_factor: item.easiness_factor || 2.5,
          interval_days: item.interval_days || 1,
          contexts: [],
          proficiency_records: [],
          created_at: item.created_at
        });
      }
      
      // 添加语境信息（如果存在）
      if (item.original_sentence || item.context_explanation) {
        const meaningBlock = anchor.meaning_blocks.get(meaningBlockId)!;
        meaningBlock.contexts.push({
          id: `${meaningBlockId}_${item.example_index || 0}`,
          context_block_id: item.source_context_id,
          start_position: item.start_position,
          end_position: item.end_position,
          confidence_score: item.confidence_score || 1.0,
          original_sentence: item.original_sentence,
          context_explanation: item.context_explanation,
          original_word_form: item.original_word_form, // 重要：原始词形
          context_block: {
            id: item.source_context_id,
            content: item.original_sentence || item.context_explanation,
            block_type: 'text',
            created_at: item.example_created_at || item.created_at
          }
        });
      }
    });

    // 转换Map为数组
    const anchorsArray = Array.from(anchorGroups.values()).map(anchor => ({
      ...anchor,
      meaning_blocks: Array.from(anchor.meaning_blocks.values()),
      total_meaning_blocks: anchor.meaning_blocks.size
    }));

    if (groupBy === 'month') {
      // 月份分组：需要进一步按天分组
      const monthData = new Map<string, any[]>();
      
      itemsInGroup.forEach((item: any) => {
        const dayKey = new Date(item.created_at).toISOString().split('T')[0];
        if (!monthData.has(dayKey)) {
          monthData.set(dayKey, []);
        }
        monthData.get(dayKey)!.push(item);
      });
      
      const days = Array.from(monthData.entries()).map(([date, dayItems]) => {
        const dayAnchorGroups = new Map<string, any>();
        
        dayItems.forEach((item: any) => {
          const anchorId = item.anchor_id;
          
          if (!dayAnchorGroups.has(anchorId)) {
            dayAnchorGroups.set(anchorId, {
              id: anchorId,
              text: item.anchor_text,
              type: item.anchor_type || 'word',
              language: 'en',
              total_contexts: 0,
              total_meaning_blocks: 0,
              created_at: item.created_at,
              updated_at: item.created_at,
              meaning_blocks: new Map()
            });
          }
          
          const anchor = dayAnchorGroups.get(anchorId)!;
          const meaningBlockId = item.id;
          
          if (!anchor.meaning_blocks.has(meaningBlockId)) {
            anchor.meaning_blocks.set(meaningBlockId, {
              id: meaningBlockId,
              anchor_id: anchorId,
              meaning: item.meaning,
              tags: item.tags || [],
              current_proficiency: item.current_proficiency || 0,
              review_count: item.review_count || 0,
              next_review_date: item.next_review_date,
              easiness_factor: item.easiness_factor || 2.5,
              interval_days: item.interval_days || 1,
              contexts: [],
              proficiency_records: [],
              created_at: item.created_at
            });
          }
          
          if (item.original_sentence || item.context_explanation) {
            const meaningBlock = anchor.meaning_blocks.get(meaningBlockId)!;
            meaningBlock.contexts.push({
              id: `${meaningBlockId}_${item.example_index || 0}`,
              context_block_id: item.source_context_id,
              start_position: item.start_position,
              end_position: item.end_position,
              confidence_score: item.confidence_score || 1.0,
              original_sentence: item.original_sentence,
              context_explanation: item.context_explanation,
              original_word_form: item.original_word_form,
              context_block: {
                id: item.source_context_id,
                content: item.original_sentence || item.context_explanation,
                block_type: 'text',
                created_at: item.example_created_at || item.created_at
              }
            });
          }
        });
        
        const dayAnchorsArray = Array.from(dayAnchorGroups.values()).map(anchor => ({
          ...anchor,
          meaning_blocks: Array.from(anchor.meaning_blocks.values()),
          total_meaning_blocks: anchor.meaning_blocks.size
        }));
        
        return {
          date,
          anchors: dayAnchorsArray
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      timeDomains.push({
        id: timeKey,
        month: timeKey,
        days,
        totalAnchors: anchorsArray.length,
        meaningBlocks: itemsInGroup.length
      });
    } else {
      // 日或周分组：直接作为一天处理
      timeDomains.push({
        id: timeKey,
        month: timeKey.substring(0, 7), // YYYY-MM 格式
        days: [{
          date: timeKey,
          anchors: anchorsArray
        }],
        totalAnchors: anchorsArray.length,
        meaningBlocks: itemsInGroup.length
      });
    }
  }

  // 按时间倒序排列
  timeDomains.sort((a, b) => b.id.localeCompare(a.id));

  console.log('最终时间域数据:', timeDomains); // 调试日志

  return { timeDomains };
}

// 获取空间域统计 - 使用服务密钥但显式过滤用户数据
async function getSpaceDomainStats(userId: string, bookId?: string, chapterId?: string) {
  // 空间域功能暂时返回空数组，但保留用户参数
  console.log('获取空间域数据，用户ID:', userId);
  return { spaceDomains: [] };
}

export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const userId = await authenticateUser(req.headers.get('Authorization'));

    console.log('用户ID:', userId); // 调试日志

    // 简单测试：直接查询用户的锚点数量
    const { data: testAnchors, error: testError } = await supabase
      .from('anchors')
      .select('id, text, created_at, user_id')
      .eq('user_id', userId) // 显式添加用户过滤
      .limit(5);

    console.log('测试查询结果:', { testAnchors, testError, userId }); // 调试日志

    // 2. 速率限制检查
    await limiter.check(req, 20, userId);

    // 3. 解析查询参数
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'overview'; // overview, time, space
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupByParam = searchParams.get('groupBy') || 'day';
    const bookId = searchParams.get('bookId');
    const chapterId = searchParams.get('chapterId');

    // 验证groupBy参数
    const validGroupBy = ['day', 'week', 'month'];
    const groupBy = validGroupBy.includes(groupByParam) ? groupByParam as 'day' | 'week' | 'month' : 'day';

    let result: any = {};

    switch (type) {
      case 'time':
        result = await getTimeDomainStats(userId, startDate || undefined, endDate || undefined, groupBy);
        break;
        
      case 'space':
        result = await getSpaceDomainStats(userId, bookId || undefined, chapterId || undefined);
        break;
        
      case 'overview':
      default:
        // 获取综合统计
        const [timeStats, spaceStats] = await Promise.all([
          getTimeDomainStats(userId, startDate || undefined, endDate || undefined, 'day').catch(() => ({ timeDomains: [] })),
          getSpaceDomainStats(userId).catch(() => ({ spaceDomains: [] }))
        ]);

        // 基础统计（使用服务密钥但显式添加用户过滤）
        const { data: anchors } = await supabase
          .from('anchors')
          .select('id, total_meaning_blocks, user_id')
          .eq('user_id', userId);
        
        const { data: meaningBlocks } = await supabase
          .from('meaning_blocks')
          .select('current_proficiency, user_id')
          .eq('user_id', userId);
        
        const totalAnchors = anchors?.length || 0;
        const totalMeaningBlocks = anchors?.reduce((sum, a) => sum + (a.total_meaning_blocks || 0), 0) || 0;
        const avgProficiency = (meaningBlocks && meaningBlocks.length > 0) 
          ? meaningBlocks.reduce((sum, mb) => sum + (mb.current_proficiency || 0), 0) / meaningBlocks.length 
          : 0;

        result.overview = {
          totalAnchors,
          totalMeaningBlocks,
          avgProficiency: Math.round(avgProficiency * 1000) / 1000
        };

        result.recentTimeStats = timeStats?.timeDomains?.slice(0, 7) || [];
        result.topSpaces = spaceStats?.spaceDomains?.slice(0, 5) || [];
        break;
    }

    return NextResponse.json({
      success: true,
      type,
      data: result,
      userId // 添加用户ID到响应中以便调试
    });

  } catch (error) {
    console.error('获取锚点统计失败:', error);
    
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