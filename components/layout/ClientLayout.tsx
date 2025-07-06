'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLoginDialog } from '@/hooks/use-login-dialog';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { Toaster } from '@/components/ui/sonner';
import '@/lib/keyboard-controller';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const searchParams = useSearchParams();
  const { isOpen, openLoginDialog, closeLoginDialog } = useLoginDialog();

  useEffect(() => {
    if (searchParams.get('requireAuth') === 'true') {
      openLoginDialog();
    }
  }, [searchParams, openLoginDialog]);

  // 初始化全局状态
  useEffect(() => {
    // 初始化全局翻译状态
    if (typeof window !== 'undefined') {
      (window as any).globalTranslationState = false;
    }
  }, []);

  return (
    <>
      {children}
      <AuthDialog open={isOpen} onOpenChange={closeLoginDialog} />
      <Toaster />
    </>
  );
} 