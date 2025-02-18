'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { UserMenu } from './UserMenu';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const { user, loading } = useAuthStore();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="relative w-8 h-8">
            <Image
              src="/icon-192.png"
              alt="洪流二语习得"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            洪流二语习得
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center space-x-6">
          <Link href="/bookshelf" className="text-foreground/80 hover:text-foreground">
            我的书架
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
          {loading ? (
            <div className="w-20 h-9 bg-muted rounded animate-pulse" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setShowAuthDialog(true)}
                className="hidden md:inline-flex"
              >
                登录
              </Button>
              <Button
                onClick={() => {
                  setShowAuthDialog(true);
                  setTimeout(() => {
                    const registerTab = document.querySelector('[value="register"]') as HTMLElement;
                    if (registerTab) registerTab.click();
                  }, 100);
                }}
                className="hidden md:inline-flex"
              >
                注册
              </Button>
            </>
          )}
          
          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 hover:bg-accent rounded-lg"
            onClick={toggleMenu}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} border-t bg-background/95 backdrop-blur-sm`}>
        <div className="container mx-auto px-4 py-4 space-y-4">
          <Link 
            href="/bookshelf" 
            className="block py-2 text-foreground/80 hover:text-foreground"
            onClick={() => setIsMenuOpen(false)}
          >
            我的书架
          </Link>
          <Link 
            href="/courses" 
            className="block py-2 text-foreground/80 hover:text-foreground"
            onClick={() => setIsMenuOpen(false)}
          >
            课程
          </Link>
          <Link 
            href="/community" 
            className="block py-2 text-foreground/80 hover:text-foreground"
            onClick={() => setIsMenuOpen(false)}
          >
            社区
          </Link>
          
          {/* Mobile Auth Buttons */}
          {!user && !loading && (
            <div className="pt-4 border-t space-y-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowAuthDialog(true);
                }}
                className="w-full justify-center"
              >
                登录
              </Button>
              <Button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowAuthDialog(true);
                  setTimeout(() => {
                    const registerTab = document.querySelector('[value="register"]') as HTMLElement;
                    if (registerTab) registerTab.click();
                  }, 100);
                }}
                className="w-full justify-center"
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
      />
    </nav>
  );
}