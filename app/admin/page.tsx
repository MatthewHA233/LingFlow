'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { Bell, BookOpen, ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';

const adminMenuItems = [
  {
    title: '图书管理',
    description: '管理用户上传的图书',
    icon: BookOpen,
    href: '/admin/library',
  },
  {
    title: '系统通知',
    description: '向所有用户发送系统消息',
    icon: Bell,
    href: '/admin/notifications',
  },
  {
    title: '用户管理',
    description: '管理用户账号和权限',
    icon: Users,
    href: '/admin/users',
    disabled: true,
  },
];

export default function AdminPage() {
  return (
    <AdminLayout title="管理后台" showBackButton={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminMenuItems.map((item) => (
          <Link
            key={item.title}
            href={item.disabled ? '#' : item.href}
            className={`${
              item.disabled ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <Card className="p-6 h-full hover:bg-accent/5 transition-colors">
              <div className="flex flex-col h-full">
                <div className="mb-4">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-medium mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
                
                {!item.disabled && (
                  <div className="mt-4 flex justify-end">
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
} 