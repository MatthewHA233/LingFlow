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
        <DropdownMenuItem asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-foreground/80 hover:text-foreground"
          >
            <LucideUser className="w-4 h-4" />
            <span>个人资料</span>
          </Button>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-foreground/80 hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
            <span>设置</span>
          </Button>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 