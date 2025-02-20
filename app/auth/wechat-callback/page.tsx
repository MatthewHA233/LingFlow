'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import Link from 'next/link';

export default function WeChatCallbackPage() {
  const [authState, setAuthState] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleWeChatCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const next = searchParams.get('next') || '/';

        if (!code || !state) {
          setErrorMessage('无效的微信授权参数');
          setAuthState('error');
          return;
        }

        // 这里需要调用您的后端API来处理微信登录
        const response = await fetch('/api/auth/wechat-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || '微信登录失败');
        }

        // 假设后端返回了supabase的session数据
        const { session } = data;
        
        // 设置supabase session
        await supabase.auth.setSession(session);

        setAuthState('success');
        // 3秒后自动跳转
        setTimeout(() => {
          router.push(next);
        }, 3000);

      } catch (error) {
        console.error('微信登录失败:', error);
        setErrorMessage(error instanceof Error ? error.message : '微信登录过程发生错误');
        setAuthState('error');
      }
    };

    handleWeChatCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-gray-800/50 backdrop-blur p-8 rounded-2xl text-center space-y-6">
          {authState === 'processing' && (
            <>
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">正在处理微信登录</h3>
                <p className="text-gray-400 text-sm">请稍候，我们正在验证您的微信授权...</p>
              </div>
            </>
          )}

          {authState === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">微信登录成功</h3>
                <p className="text-gray-400 text-sm">
                  您已成功使用微信账号登录！
                  <br />3秒后将自动跳转...
                </p>
              </div>
              <Link href="/" className="inline-block w-full">
                <HoverBorderGradient
                  containerClassName="w-full rounded-full"
                  className="w-full py-2"
                >
                  <span className="text-white">立即前往首页</span>
                </HoverBorderGradient>
              </Link>
            </>
          )}

          {authState === 'error' && (
            <>
              <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">登录失败</h3>
                <p className="text-gray-400 text-sm">
                  {errorMessage || '微信授权失败'}
                  <br />请重新尝试或联系客服获取帮助
                </p>
              </div>
              <Link href="/auth/login" className="inline-block w-full">
                <HoverBorderGradient
                  containerClassName="w-full rounded-full"
                  className="w-full py-2"
                >
                  <span className="text-white">返回登录</span>
                </HoverBorderGradient>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 