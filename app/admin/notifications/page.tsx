'use client';

import { useState, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notifications';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useLoginDialog } from '@/hooks/use-login-dialog';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const { notifications, addNotification, removeNotification, clearAll } = useNotificationStore();
  const router = useRouter();
  const { openLoginDialog } = useLoginDialog();
  const { user } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('开始检查权限，当前用户:', user?.id);
      
      if (!user) {
        console.log('用户未登录');
        setIsLoading(false);
        setIsAuthorized(false);
        openLoginDialog();
        return;
      }

      try {
        console.log('发送权限检查请求');
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;

        if (!accessToken) {
          console.log('未找到访问令牌');
          setIsAuthorized(false);
          openLoginDialog();
          return;
        }

        const response = await fetch('/admin/notifications/auth-check', {
          method: 'HEAD',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        const authStatus = response.headers.get('x-auth-status');
        console.log('收到权限状态:', authStatus);
        
        switch (authStatus) {
          case 'unauthorized':
            console.log('用户未登录');
            openLoginDialog();
            setIsAuthorized(false);
            break;
          case 'forbidden':
            console.log('用户无权限');
            toast.error('您没有管理员权限');
            router.push('/');
            setIsAuthorized(false);
            break;
          case 'authorized':
            console.log('用户已授权');
            setIsAuthorized(true);
            break;
          default:
            console.log('权限状态异常:', authStatus);
            toast.error('验证权限时出错');
            setIsAuthorized(false);
        }
      } catch (error) {
        console.error('检查权限失败:', error);
        toast.error('检查权限失败');
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [user, openLoginDialog, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('请填写完整的消息内容');
      return;
    }

    try {
      await addNotification({
        title: title.trim(),
        message: message.trim(),
        type,
      });

      toast.success('消息发送成功');
      setTitle('');
      setMessage('');
    } catch (error) {
      toast.error('发送失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll();
      toast.success('已清空所有消息');
      setShowClearConfirm(false);
    } catch (error) {
      toast.error('清空消息失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="text-lg">正在检查权限...</div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="text-lg text-red-500">您没有权限访问此页面</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>发送系统通知</CardTitle>
          <CardDescription>
            在这里发送的消息将推送给所有用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">消息标题</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入消息标题"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">消息类型</label>
                <Select value={type} onValueChange={(value: any) => setType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">普通消息</SelectItem>
                    <SelectItem value="success">成功消息</SelectItem>
                    <SelectItem value="warning">警告消息</SelectItem>
                    <SelectItem value="error">错误消息</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">消息内容</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="输入消息内容"
                rows={4}
                maxLength={500}
              />
            </div>
            <Button type="submit">发送消息</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>历史消息</CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>已发送的所有系统消息</span>
            {notifications.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowClearConfirm(true)}
              >
                清空所有消息
              </Button>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              暂无历史消息
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between border-b pb-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{notification.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        notification.type === 'error' ? 'bg-red-100 text-red-700' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        notification.type === 'success' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {
                          notification.type === 'error' ? '错误' :
                          notification.type === 'warning' ? '警告' :
                          notification.type === 'success' ? '成功' : '消息'
                        }
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(notification.created_at, {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeNotification(notification.id)}
                  >
                    <span className="sr-only">删除消息</span>
                    <span className="text-lg leading-none">&times;</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空所有消息？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将清空所有系统通知，所有用户都将无法看到这些消息。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 