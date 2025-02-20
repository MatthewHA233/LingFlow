import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('缺少环境变量: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('缺少环境变量: SUPABASE_SERVICE_ROLE_KEY');
}

// 使用 service_role key 创建 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

export async function HEAD(request: Request) {
  try {
    console.log('开始权限检查');
    
    // 从 Authorization header 获取 token
    const authHeader = request.headers.get('Authorization');
    console.log('Authorization header:', authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('未找到有效的认证令牌');
      return createResponse('unauthorized');
    }

    const token = authHeader.split(' ')[1];

    // 使用令牌获取用户信息
    const { data: { user }, error: sessionError } = await supabase.auth.getUser(token);
    console.log('用户状态:', user?.id, sessionError);

    if (sessionError || !user) {
      console.log('未找到用户或会话错误:', sessionError);
      return createResponse('unauthorized');
    }

    // 使用 service_role 权限直接查询用户角色
    console.log('开始检查用户角色, 用户ID:', user.id);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('查询结果:', profile, profileError);

    if (profileError) {
      console.log('查询角色失败:', profileError);
      return createResponse('error');
    }

    if (!profile) {
      console.log('未找到用户角色记录');
      return createResponse('forbidden');
    }

    console.log('用户角色:', profile.role);

    if (profile.role !== 'admin') {
      console.log('用户不是管理员');
      return createResponse('forbidden');
    }

    console.log('验证通过，用户是管理员');
    return createResponse('authorized');
  } catch (error) {
    console.error('权限检查失败:', error);
    return createResponse('error');
  }
}

function createResponse(status: 'unauthorized' | 'forbidden' | 'authorized' | 'error') {
  const headersList = headers();
  const origin = headersList.get('origin') || '';

  const responseHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, x-auth-status',
    'Access-Control-Expose-Headers': 'x-auth-status',
    'Access-Control-Allow-Credentials': 'true',
    'x-auth-status': status
  };

  return new NextResponse(null, {
    status: 200,
    headers: responseHeaders
  });
}

export async function OPTIONS(request: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || '';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, x-auth-status',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
} 