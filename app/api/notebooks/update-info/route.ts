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
    const { notebookId, title, description, cover_url } = await req.json();
    
    if (!notebookId) {
      return NextResponse.json({ error: '缺少笔记本ID' }, { status: 400 });
    }

    // 3. 验证笔记本是否存在且属于当前用户
    const { data: existingNotebook, error: checkError } = await supabase
      .from('books')
      .select('id, user_id, type')
      .eq('id', notebookId)
      .eq('user_id', user.id)
      .eq('type', 'notebook')
      .single();

    if (checkError || !existingNotebook) {
      return NextResponse.json({ error: '笔记本不存在或无权限访问' }, { status: 403 });
    }

    // 4. 构建更新数据对象
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // 添加可选字段
    if (title !== undefined) {
      // 验证标题
      if (!title.trim()) {
        return NextResponse.json({ error: '笔记本标题不能为空' }, { status: 400 });
      }
      if (title.length > 100) {
        return NextResponse.json({ error: '标题不能超过100个字符' }, { status: 400 });
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      // 验证描述
      if (description.length > 500) {
        return NextResponse.json({ error: '描述不能超过500个字符' }, { status: 400 });
      }
      updateData.description = description.trim() || null;
    }

    if (cover_url !== undefined) {
      // 验证图片URL格式（如果提供）
      if (cover_url && cover_url.trim() !== '') {
        try {
          new URL(cover_url);
          updateData.cover_url = cover_url.trim();
        } catch {
          return NextResponse.json({ error: '图片URL格式无效' }, { status: 400 });
        }
      } else {
        updateData.cover_url = null;
      }
    }

    // 5. 更新笔记本信息
    const { data, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', notebookId)
      .eq('user_id', user.id)
      .eq('type', 'notebook')
      .select()
      .single();

    if (error) {
      console.error('更新笔记本信息失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, notebook: data });
  } catch (error: any) {
    console.error('处理请求失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
} 