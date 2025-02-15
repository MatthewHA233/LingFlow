'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const code = searchParams.get('code');
      
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          
          // 验证成功，跳转到首页
          router.push('/');
        } catch (error) {
          console.error('验证失败:', error);
          // 验证失败，跳转到登录页
          router.push('/login?error=验证失败');
        }
      }
    };

    handleAuthCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">正在验证邮箱...</p>
    </div>
  );
} 