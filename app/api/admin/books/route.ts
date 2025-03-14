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

export async function GET(req: Request) {
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

    // 获取分页参数
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 3. 获取分页的图书数据，只查询必要字段
    const { data: books, error: booksError, count } = await adminClient
      .from('books')
      .select('id, title, author, cover_url, user_id, created_at, updated_at, metadata, status', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (booksError) throw booksError;

    // 4. 获取用户邮箱信息
    const userIds = Array.from(new Set(books.map(book => book.user_id)));
    const { data: users } = await adminClient
      .from('auth_users_view')
      .select('id, email')
      .in('id', userIds);

    const userEmailMap = (users || []).reduce((map, user) => {
      map[user.id] = user.email;
      return map;
    }, {} as Record<string, string>);

    // 5. 获取每本书的统计信息，使用视图
    const { data: bookStats, error: statsError } = await adminClient
      .from('book_statistics')
      .select('*')
      .in('book_id', books.map(b => b.id));

    if (statsError) {
      console.error('获取图书统计信息失败:', statsError);
      // 继续执行，使用空统计信息
    }

    // 创建统计信息映射
    const statsMap: Record<string, any> = {};
    if (bookStats) {
      bookStats.forEach(stat => {
        statsMap[stat.book_id] = stat;
      });
    }

    // 在app/api/admin/books/route.ts中获取资源计数
    const resourceCountPromises = books.map(async (book) => {
      const { count, error } = await adminClient
        .from('book_resources')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', book.id);
        
      return { 
        bookId: book.id, 
        count: count || 0 
      };
    });

    const resourceCounts = await Promise.all(resourceCountPromises);
    const resourceCountMap: Record<string, number> = {};
    resourceCounts.forEach(item => {
      resourceCountMap[item.bookId] = item.count;
    });

    // 6. 合并数据
    const formattedBooks = books.map(book => ({
      ...book,
      profiles: {
        email: userEmailMap[book.user_id] || '未知用户'
      },
      stats: statsMap[book.id] || {
        chapter_count: 0,
        text_block_count: 0,
        heading_block_count: 0,
        image_block_count: 0,
        audio_block_count: 0,
        total_block_count: 0
      },
      resource_count: resourceCountMap[book.id] || 0
    }));

    return NextResponse.json({
      books: formattedBooks,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取图书列表失败:', error);
    return NextResponse.json(
      { error: '获取图书列表失败' },
      { status: 500 }
    );
  }
} 