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
import { useAuthStore } from '@/stores/auth';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const signOut = useAuthStore(state => state.signOut);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      toast.success('已退出登录');
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          {user.email || '用户'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>我的账号</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => toast.error('个人设置功能开发中')}
        >
          个人设置
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoading}
          onClick={handleSignOut}
          className="text-red-600 focus:text-red-600"
        >
          {isLoading ? '退出中...' : '退出登录'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 