'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

export default function ConfirmPage() {
  const [verificationState, setVerificationState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialize = useAuthStore(state => state.initialize);

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // 检查 code 参数
        const code = searchParams.get('code');
        
        if (!code) {
          setErrorMessage('无效的验证链接');
          setVerificationState('error');
          return;
        }

        // 先检查当前登录状态
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // 如果已经登录，先登出
          await supabase.auth.signOut();
        }

        // 使用 code 交换 session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          throw error;
        }

        if (!data.session || !data.user) {
          throw new Error('验证成功但未能获取会话信息');
        }

        // 更新用户的 email_confirmed 状态
        await supabase.auth.updateUser({
          data: { email_confirmed: true }
        });

        // 等待一小段时间确保状态更新
        await new Promise(resolve => setTimeout(resolve, 500));

        // 初始化登录状态
        await initialize();

        setVerificationState('success');
        setTimeout(() => {
          router.push('/');
        }, 3000);

      } catch (error) {
        console.error('验证失败:', error);
        // 确保错误状态下用户已登出
        await supabase.auth.signOut();
        setErrorMessage(error instanceof Error ? error.message : '验证过程发生错误，请重试');
        setVerificationState('error');
      }
    };

    // 使用 setTimeout 避免立即执行导致的闪烁
    const timer = setTimeout(() => {
      confirmEmail();
    }, 100);

    return () => clearTimeout(timer);
  }, [searchParams, router, initialize]);

  const handleResendVerification = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: localStorage.getItem('pendingVerificationEmail') || '',
      });

      if (error) throw error;
      
      setErrorMessage('新的验证邮件已发送，请查收');
    } catch (error) {
      console.error('重发验证邮件失败:', error);
      setErrorMessage('重发验证邮件失败，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-gray-800/50 backdrop-blur p-8 rounded-2xl text-center space-y-6">
          {verificationState === 'verifying' && (
            <>
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">正在验证邮箱</h3>
                <p className="text-gray-400 text-sm">请稍候，我们正在验证您的邮箱...</p>
              </div>
            </>
          )}

          {verificationState === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">邮箱验证成功</h3>
                <p className="text-gray-400 text-sm">
                  您的邮箱已成功验证！
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

          {verificationState === 'error' && (
            <>
              <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">验证失败</h3>
                <p className="text-gray-400 text-sm">
                  {errorMessage}
                </p>
              </div>
              <div className="space-y-4">
                <button
                  onClick={handleResendVerification}
                  className="w-full"
                >
                  <HoverBorderGradient
                    containerClassName="w-full rounded-full"
                    className="w-full py-2"
                  >
                    <span className="text-white">重新发送验证邮件</span>
                  </HoverBorderGradient>
                </button>
                <Link href="/auth/login" className="inline-block w-full">
                  <HoverBorderGradient
                    containerClassName="w-full rounded-full"
                    className="w-full py-2"
                  >
                    <span className="text-white">返回登录</span>
                  </HoverBorderGradient>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 