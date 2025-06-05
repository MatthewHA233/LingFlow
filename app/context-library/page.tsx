'use client';

import { useState, useEffect } from 'react';
import { Tabs } from '@/components/ui/3d-tabs';
import BookshelfContent from './bookshelf/BookshelfContent';
import NotebookContent from './notebook/NotebookContent';
import { Button } from '@/components/ui/button';
import { Zap, ZapOff } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { UnauthorizedTip } from '@/components/auth/UnauthorizedTip';

export default function ContextLibrary() {
  const { user, loading } = useAuthStore();
  const [disable3D, setDisable3D] = useState(false);

  // 从localStorage读取设置
  useEffect(() => {
    const saved3DSetting = localStorage.getItem('context-library-disable-3d');
    if (saved3DSetting !== null) {
      setDisable3D(saved3DSetting === 'true');
    }
  }, []);

  // 保存设置到localStorage
  const toggle3D = () => {
    const newSetting = !disable3D;
    setDisable3D(newSetting);
    localStorage.setItem('context-library-disable-3d', newSetting.toString());
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // 如果未登录，显示介绍页面
  if (!user) {
    return <UnauthorizedTip />;
  }

  // 已登录用户显示Tab界面
  const tabs = [
    {
      title: "我的书架",
      value: "bookshelf",
      content: <BookshelfContent />
    },
    {
      title: "我的笔记", 
      value: "notebook",
      content: <NotebookContent />
    }
  ];

  return (
    <div className="h-full relative">
      {/* 3D效果开关按钮 */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={toggle3D}
          className="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-sm border-emerald-500/30 text-white hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-white text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
        >
          {disable3D ? <ZapOff className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" /> : <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />}
          <span className="text-xs text-white hidden sm:inline">3D效果: {disable3D ? '已关闭' : '已开启'}</span>
          <span className="text-xs text-white sm:hidden">{disable3D ? '关' : '开'}</span>
        </Button>
      </div>

      <Tabs 
        tabs={tabs}
        containerClassName="justify-center mb-8"
        contentClassName="!mt-0"
        disable3D={disable3D}
      />
    </div>
  );
} 