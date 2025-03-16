import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: Request) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    // 2. 获取请求数据
    const { bookId, coverUrl, title, author, metadata } = await req.json();
    
    if (!bookId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 构建更新数据对象
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // 添加可选字段
    if (coverUrl !== undefined) updateData.cover_url = coverUrl;
    if (title !== undefined) updateData.title = title;
    if (author !== undefined) updateData.author = author;
    if (metadata !== undefined) updateData.metadata = metadata;

    // 4. 更新书籍信息
    const { data, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('更新书籍信息失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, book: data });
  } catch (error) {
    console.error('处理请求失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
} 