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
    const { bookId, coverUrl } = await req.json();
    
    if (!bookId || !coverUrl) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 更新封面 URL
    const { data, error } = await supabase
      .from('books')
      .update({ 
        cover_url: coverUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('更新封面失败:', error);
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