'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import Link from 'next/link';

export default function ConfirmPage() {
  const [verificationState, setVerificationState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const next = searchParams.get('next') || '/';

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          });

          if (error) {
            setErrorMessage(error.message);
            setVerificationState('error');
          } else {
            setVerificationState('success');
            // 3秒后自动跳转
            setTimeout(() => {
              router.push(next);
            }, 3000);
          }
        } else {
          setErrorMessage('无效的验证链接');
          setVerificationState('error');
        }
      } catch (error) {
        console.error('验证失败:', error);
        setErrorMessage('验证过程发生错误');
        setVerificationState('error');
      }
    };

    confirmEmail();
  }, [searchParams, router]);

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
                  {errorMessage || '验证链接可能已过期或无效'}
                  <br />请重新注册或联系客服获取帮助
                </p>
              </div>
              <Link href="/auth/register" className="inline-block w-full">
                <HoverBorderGradient
                  containerClassName="w-full rounded-full"
                  className="w-full py-2"
                >
                  <span className="text-white">重新注册</span>
                </HoverBorderGradient>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 