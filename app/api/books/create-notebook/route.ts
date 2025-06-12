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
      console.error('认证失败:', authError);
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
    const { data: existingNotebook, error: checkError } = await supabase
      .from('books')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'notebook')
      .eq('title', title.trim())
      .eq('status', 'ready')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('检查重复笔记本失败:', checkError);
      return NextResponse.json(
        { error: '检查笔记本失败，请重试' },
        { status: 500 }
      );
    }

    if (existingNotebook) {
      return NextResponse.json(
        { error: '已存在同名的笔记本' },
        { status: 409 }
      );
    }

    // 创建笔记本数据 - 只包含必需的字段
    const notebookData = {
      title: title.trim(),
      author: 'System', // 笔记本默认作者
      user_id: user.id,
      type: 'notebook',
      status: 'ready',
      note_count: 0,
      metadata: {},
      last_accessed_at: new Date().toISOString(),
      // 只在有值时才包含可选字段
      ...(description?.trim() && { description: description.trim() }),
      ...(cover_url?.trim() && { cover_url: cover_url.trim() }),
    };

    console.log('准备插入的笔记本数据:', notebookData);

    // 插入笔记本到数据库
    const { data: notebook, error: insertError } = await supabase
      .from('books')
      .insert(notebookData)
      .select()
      .single();

    if (insertError) {
      console.error('创建笔记本失败 - 详细错误:', {
        error: insertError,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        message: insertError.message
      });
      
      // 根据错误类型返回更具体的错误信息
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '笔记本标题已存在' },
          { status: 409 }
        );
      } else if (insertError.code === '23514') {
        return NextResponse.json(
          { error: '数据格式错误' },
          { status: 400 }
        );
      } else if (insertError.code === '42703') {
        return NextResponse.json(
          { error: '数据库字段不存在，请检查迁移是否正确执行' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: '创建笔记本失败，请重试' },
        { status: 500 }
      );
    }

    console.log('笔记本创建成功:', notebook);

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
        status: notebook.status,
        type: notebook.type
      }
    }, { status: 201 });

  } catch (error: any) {
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
    const status = url.searchParams.get('status') || 'ready';

    // 计算分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 获取笔记本列表（只查询notebook类型）
    const { data: notebooks, error: fetchError, count } = await supabase
      .from('books')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('type', 'notebook')
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