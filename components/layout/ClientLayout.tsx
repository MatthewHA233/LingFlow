'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLoginDialog } from '@/hooks/use-login-dialog';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { Toaster } from '@/components/ui/sonner';

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

  return (
    <>
      {children}
      <AuthDialog open={isOpen} onOpenChange={closeLoginDialog} />
      <Toaster />
    </>
  );
} 