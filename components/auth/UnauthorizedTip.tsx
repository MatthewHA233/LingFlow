'use client';

import { useState } from 'react';
import { Library, Rocket, Sparkles, Gauge } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { AuthDialog } from './AuthDialog';

export function UnauthorizedTip() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  return (
    <>
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8 px-4">
          <div className="mb-8">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <Library className="w-24 h-24 absolute inset-0 text-primary animate-float opacity-75" />
              <Sparkles className="w-8 h-8 absolute -top-2 -right-2 text-purple-400 animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-500 animate-gradient">
              欢迎来到您的个人书架
            </h1>
          </div>
          
          <p className="text-xl text-gray-300">
            登录后即可访问您的专属书籍收藏
          </p>

          <div className="flex justify-center">
            <HoverBorderGradient
              containerClassName="rounded-full"
              className="px-8 py-3"
              onClick={() => setShowAuthDialog(true)}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span>立即注册/登录</span>
              </span>
            </HoverBorderGradient>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <h2 className="text-xl font-semibold mb-6 text-primary">登录后即可享受以下功能</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="group p-6 rounded-lg bg-gray-800/50 backdrop-blur hover:bg-gray-800/70 transition-all duration-300">
                <Library className="w-6 h-6 mb-3 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="font-medium mb-2">书籍管理</h3>
                <p className="text-sm text-gray-400">轻松导入和管理您的电子书收藏</p>
              </div>
              <div className="group p-6 rounded-lg bg-gray-800/50 backdrop-blur hover:bg-gray-800/70 transition-all duration-300">
                <Gauge className="w-6 h-6 mb-3 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="font-medium mb-2">阅读进度</h3>
                <p className="text-sm text-gray-400">自动保存和同步您的阅读进度</p>
              </div>
              <div className="group p-6 rounded-lg bg-gray-800/50 backdrop-blur hover:bg-gray-800/70 transition-all duration-300">
                <Sparkles className="w-6 h-6 mb-3 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="font-medium mb-2">个性化设置</h3>
                <p className="text-sm text-gray-400">自定义阅读体验和界面设置</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        defaultTab="register"
      />
    </>
  );
}