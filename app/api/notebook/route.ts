import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// 使用服务角色密钥的Supabase客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(req: NextRequest) {
  try {
    // 获取认证头
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '缺少认证信息' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // 验证用户token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '认证失败' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await req.json();
    const { title, description, cover_url } = body;

    // 验证必填字段
    if (!title || title.trim() === '') {
      return NextResponse.json(
        { error: '笔记本标题不能为空' },
        { status: 400 }
      );
    }

    // 检查标题长度
    if (title.length > 100) {
      return NextResponse.json(
        { error: '笔记本标题不能超过100个字符' },
        { status: 400 }
      );
    }

    // 检查描述长度
    if (description && description.length > 500) {
      return NextResponse.json(
        { error: '笔记本描述不能超过500个字符' },
        { status: 400 }
      );
    }

    // 验证图片URL格式（如果提供）
    if (cover_url && cover_url.trim() !== '') {
      try {
        new URL(cover_url);
      } catch {
        return NextResponse.json(
          { error: '图片URL格式无效' },
          { status: 400 }
        );
      }
    }

    // 检查用户是否已有同名笔记本
    const { data: existingNotebook } = await supabase
      .from('notebooks')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', title.trim())
      .eq('status', 'active')
      .single();

    if (existingNotebook) {
      return NextResponse.json(
        { error: '已存在同名的笔记本' },
        { status: 409 }
      );
    }

    // 创建笔记本数据
    const notebookData = {
      title: title.trim(),
      description: description?.trim() || null,
      cover_url: cover_url?.trim() || null,
      user_id: user.id,
      status: 'active',
      note_count: 0,
      metadata: {},
      last_accessed_at: new Date().toISOString()
    };

    // 插入笔记本到数据库
    const { data: notebook, error: insertError } = await supabase
      .from('notebooks')
      .insert(notebookData)
      .select()
      .single();

    if (insertError) {
      console.error('创建笔记本失败:', insertError);
      return NextResponse.json(
        { error: '创建笔记本失败，请重试' },
        { status: 500 }
      );
    }

    // 返回创建的笔记本信息
    return NextResponse.json({
      success: true,
      notebook: {
        id: notebook.id,
        title: notebook.title,
        description: notebook.description,
        cover_url: notebook.cover_url,
        created_at: notebook.created_at,
        updated_at: notebook.updated_at,
        note_count: notebook.note_count,
        status: notebook.status
      }
    }, { status: 201 });

  } catch (error) {
    console.error('创建笔记本API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 获取用户的笔记本列表
export async function GET(req: NextRequest) {
  try {
    // 获取认证头
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '缺少认证信息' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // 验证用户token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '认证失败' },
        { status: 401 }
      );
    }

    // 获取查询参数
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status') || 'active';

    // 计算分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 获取笔记本列表
    const { data: notebooks, error: fetchError, count } = await supabase
      .from('notebooks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (fetchError) {
      console.error('获取笔记本列表失败:', fetchError);
      return NextResponse.json(
        { error: '获取笔记本列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notebooks: notebooks || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('获取笔记本列表API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
} 