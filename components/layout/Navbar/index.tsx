'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { UserMenu } from './UserMenu';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            洪流二语习得
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-6">
          <Link href="/reader" className="text-foreground/80 hover:text-foreground">
            阅读器
          </Link>
          <Link href="/courses" className="text-foreground/80 hover:text-foreground">
            课程
          </Link>
          <Link href="/community" className="text-foreground/80 hover:text-foreground">
            社区
          </Link>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center space-x-4">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setShowAuthDialog(true)}
              >
                登录
              </Button>
              <Button
                onClick={() => setShowAuthDialog(true)}
              >
                注册
              </Button>
            </>
          )}
        </div>
      </div>

      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
      />
    </nav>
  );
}