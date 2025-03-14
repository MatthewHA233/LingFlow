import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export async function DELETE(req: Request) {
  try {
    // 1. 验证管理员权限
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    // 检查是否是管理员
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 2. 获取请求体中的bookId
    const { bookId } = await req.json();
    
    if (!bookId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 删除图书（其他相关数据会通过级联删除自动处理）
    const { error: bookError } = await adminClient
      .from('books')
      .delete()
      .eq('id', bookId);

    if (bookError) {
      return NextResponse.json({ error: `删除图书失败: ${bookError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除图书失败:', error);
    return NextResponse.json(
      { error: '删除图书失败' },
      { status: 500 }
    );
  }
} 