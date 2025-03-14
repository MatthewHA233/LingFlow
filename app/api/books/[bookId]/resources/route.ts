import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export async function GET(
  req: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    // 验证认证
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    // 获取图书资源
    const { data: resources, error } = await supabase
      .from('book_resources')
      .select('*')
      .eq('book_id', params.bookId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return NextResponse.json({
      resources: resources || []
    });
  } catch (error) {
    console.error('获取资源失败:', error);
    return NextResponse.json(
      { error: '获取资源失败' },
      { status: 500 }
    );
  }
} 