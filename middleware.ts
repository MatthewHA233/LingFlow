import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    // 如果是 auth-check 路由，跳过中间件处理
    if (request.nextUrl.pathname.endsWith('/auth-check')) {
      return NextResponse.next();
    }

    // 创建初始响应
    const res = NextResponse.next();

    // 创建 supabase 客户端
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            res.cookies.set({
              name,
              value,
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
          },
          remove(name: string, options: any) {
            res.cookies.set({
              name,
              value: '',
              ...options,
              path: '/',
              maxAge: -1,
            });
          },
        },
      }
    );

    // 获取会话
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      // 设置认证状态头
      res.headers.set('x-auth-status', 'unauthorized');
      return res;
    }

    // 检查用户是否是管理员
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      // 设置认证状态头
      res.headers.set('x-auth-status', 'forbidden');
      return res;
    }

    // 如果是管理员，设置认证状态头
    res.headers.set('x-auth-status', 'authorized');
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    const res = NextResponse.next();
    res.headers.set('x-auth-status', 'error');
    return res;
  }
}

// 配置中间件只在管理员页面运行
export const config = {
  matcher: '/admin/:path*'
}; 