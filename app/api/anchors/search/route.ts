import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

// 强制动态渲染
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// 设置速率限制器
const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500
});

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

export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const userId = await authenticateUser(req.headers.get('Authorization'));

    // 2. 速率限制检查
    await limiter.check(req, 20, userId);

    // 3. 解析查询参数
    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word');
    const anchorId = searchParams.get('anchorId');
    const language = searchParams.get('language') || 'en';
    const includeContexts = searchParams.get('includeContexts') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!word && !anchorId) {
      return NextResponse.json({ error: '需要提供word或anchorId参数' }, { status: 400 });
    }

    let query = supabase
      .from('anchors')
      .select(`
        *,
        meaning_blocks (
          *,
          ${includeContexts ? `
          contexts:meaning_block_contexts (
            *,
            context_block:context_blocks (
              id,
              content,
              block_type,
              created_at
            )
          )
          ` : ''}
        )
      `)
      .eq('language', language)
      .eq('user_id', userId) // 关键：显式添加用户过滤
      .range(offset, offset + limit - 1);

    if (anchorId) {
      // 按锚点ID精确查询
      query = query.eq('id', anchorId);
    } else if (word) {
      // 按词汇模糊搜索
      query = query.ilike('text', `%${word}%`);
    }

    const { data: anchors, error } = await query;

    if (error) {
      throw new Error(`查询锚点失败: ${error.message}`);
    }

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      anchors: anchors || [],
      total: anchors?.length || 0,
      query: {
        word,
        anchorId,
        language,
        includeContexts,
        limit,
        offset
      },
      userId // 添加用户ID到响应中以便调试
    });

  } catch (error) {
    console.error('查询锚点请求失败:', error);
    
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