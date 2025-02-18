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
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { LogOut, Settings, User as LucideUser } from 'lucide-react';

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
        <DropdownMenuLabel>我的账户</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <HoverBorderGradient
            containerClassName="rounded-md w-full"
            className="flex items-center gap-2 text-sm"
          >
            <LucideUser className="w-4 h-4" />
            <span>个人资料</span>
          </HoverBorderGradient>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <HoverBorderGradient
            containerClassName="rounded-md w-full"
            className="flex items-center gap-2 text-sm"
          >
            <Settings className="w-4 h-4" />
            <span>设置</span>
          </HoverBorderGradient>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <HoverBorderGradient
            containerClassName="rounded-md w-full"
            className="flex items-center gap-2 text-sm text-red-500"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </HoverBorderGradient>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 