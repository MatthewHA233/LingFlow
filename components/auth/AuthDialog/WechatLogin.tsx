'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

declare global {
  interface Window {
    WeixinJSBridge: any;
    wx: any;
  }
}

interface WechatLoginProps {
  onSuccess: () => void;
}

export function WechatLogin({ onSuccess }: WechatLoginProps) {
  const { signInWithWechat } = useAuth();

  useEffect(() => {
    // 加载微信 JS SDK
    const script = document.createElement('script');
    script.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';
    document.body.appendChild(script);

    script.onload = () => {
      // TODO: 实现微信登录逻辑
      // 需要在后端获取微信登录所需的配置信息
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div id="wechat-qr" className="w-64 h-64 bg-gray-100 flex items-center justify-center">
        正在加载微信登录...
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        请使用微信扫描二维码登录
      </p>
    </div>
  );
}