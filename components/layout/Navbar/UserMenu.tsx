'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from '@/types/auth';
import { useAuth } from '@/hooks/use-auth';

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const { signOut } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar>
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name?.[0] ?? '用户'}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>我的账户</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/profile">个人资料</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/settings">设置</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-red-500">
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}