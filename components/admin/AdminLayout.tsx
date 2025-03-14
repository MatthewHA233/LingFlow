'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  showBackButton?: boolean;
}

export function AdminLayout({ children, title, showBackButton = true }: AdminLayoutProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { user, checkRole } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      if (!user) {
        setLoading(false);
        setIsAuthorized(false);
        return;
      }

      try {
        const role = await checkRole();
        console.log('当前用户角色:', role);
        
        if (!mounted) return;

        if (role !== 'admin') {
          setIsAuthorized(false);
          toast.error('您没有管理员权限');
          router.push('/');
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('检查权限失败:', error);
        if (!mounted) return;
        setIsAuthorized(false);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [user, checkRole, router]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">
          <p>您没有权限访问此页面</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {user ? '请联系管理员获取权限' : '请先登录'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        {showBackButton && (
          <Link href="/admin" className="p-2 hover:bg-accent rounded-md">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
} 