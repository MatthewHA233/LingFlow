'use client';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { useState } from 'react';

interface WechatLoginProps {
  onSuccess: () => void;
}

export function WechatLogin({ onSuccess }: WechatLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const signInWithWechat = useAuthStore(state => state.signInWithWechat);

  const handleWechatLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithWechat();
      onSuccess();
    } catch (error) {
      console.error('微信登录失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="w-full" 
      onClick={handleWechatLogin}
      disabled={isLoading}
    >
      {isLoading ? '登录中...' : '微信一键登录'}
    </Button>
  );
}