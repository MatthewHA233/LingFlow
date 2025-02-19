'use client';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { WechatIcon } from '@/components/icons/wechat';

interface WechatLoginProps {
  onSuccess: () => void;
}

export function WechatLogin({ onSuccess }: WechatLoginProps) {
  const handleWechatLogin = () => {
    toast.info('微信登录功能开发中，敬请期待', {
      description: '目前仅支持邮箱注册登录'
    });
  };

  return (
    <Button 
      variant="outline" 
      className="w-full bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 hover:text-white text-gray-300"
      onClick={handleWechatLogin}
    >
      <WechatIcon className="mr-2 h-5 w-5 text-green-500" />
      <span>微信一键登录</span>
      <span className="ml-2 text-xs text-gray-500">(开发中)</span>
    </Button>
  );
}