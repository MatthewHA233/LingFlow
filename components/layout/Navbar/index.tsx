'use client';

import { useAuthStore } from '@/stores/auth';
import { UserMenu } from '../UserMenu';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Book, Network, Users, MessageCircle } from 'lucide-react';
import Dock from '../Dock';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function Navbar() {
  const { user, loading } = useAuthStore();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  // 检测设备类型
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px是常用的移动设备断点
    };
    
    // 初始检测
    checkMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const items = [
    { 
      icon: <Book size={24} className="text-foreground sm:w-7 sm:h-7" />, 
      label: '语境库', 
      onClick: () => router.push('/context-library') 
    },
    { 
      icon: <Network size={24} className="text-foreground sm:w-7 sm:h-7" />, 
      label: '锚点域', 
      onClick: () => router.push('/anchor-domain') 
    },
    { 
      icon: <MessageCircle size={24} className="text-foreground sm:w-7 sm:h-7" />, 
      label: 'AI对话', 
      onClick: () => router.push('/llm-chat') 
    },
    { 
      icon: <Users size={24} className="text-foreground sm:w-7 sm:h-7" />, 
      label: '社区', 
      onClick: () => router.push('/community') 
    },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-2 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
        {/* Logo - 可点击并跳转到首页 */}
        <Link href="/" className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8">
            <Image
              src="/icon-192.png"
              alt="洪流二语习得"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          {!isMobile && (
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
              洪流二语习得
            </span>
          )}
        </Link>

        {/* Dock Navigation */}
        <div className="flex-1 flex justify-center">
          <Dock 
            items={items}
            panelHeight={44}
            baseItemSize={42}
            magnification={52}
            distance={100}
            className="sm:panelHeight-[56px] sm:baseItemSize-[56px] sm:magnification-[72px] sm:distance-[150px]"
          />
        </div>

        {/* Auth Section */}
        <div className="flex items-center">
          {loading ? (
            <div className="w-16 sm:w-20 h-8 sm:h-9 bg-muted rounded animate-pulse" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <div className="flex gap-1 sm:gap-2">
              <Button
                onClick={() => {
                  setAuthTab('login');
                  setShowAuthDialog(true);
                }}
                variant="ghost"
                size="sm"
                className="text-foreground/80 hover:text-foreground"
              >
                登录
              </Button>
              <Button
                onClick={() => {
                  setAuthTab('register');
                  setShowAuthDialog(true);
                }}
                variant="ghost"
                size="sm"
                className="text-foreground/80 hover:text-foreground"
              >
                注册
              </Button>
            </div>
          )}
        </div>
      </div>

      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        defaultTab={authTab}
      />
    </nav>
  );
}