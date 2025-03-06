'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { LogOut, Settings, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationsMenu } from './NotificationsMenu';

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const signOut = useAuthStore(state => state.signOut);
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      toast.success('已退出登录');
      router.push('/');
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const userInitial = user.email?.[0].toUpperCase() || 'U';

  return (
    <div className="flex items-center gap-2">
      <NotificationsMenu />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
            <Avatar className="avatar">
              <AvatarFallback className="avatar-fallback">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dropdown-menu-content w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">我的账号</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link 
              href="/context-library/bookshelf"
              className="w-full flex items-center cursor-pointer dropdown-menu-item"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              <span>我的书架</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link 
              href="/settings"
              className="w-full flex items-center cursor-pointer dropdown-menu-item"
            >
              <Settings className="w-4 h-4 mr-2" />
              <span>账号设置</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isLoading}
            className="text-red-500 focus:text-red-500 cursor-pointer dropdown-menu-item"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>{isLoading ? '退出中...' : '退出登录'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 