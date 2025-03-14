'use client';

import { useState } from 'react';
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
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const { notifications, addNotification, removeNotification, clearAll } = useNotificationStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('提交通知:', { title, message, type });
    
    if (!title.trim() || !message.trim()) {
      console.log('消息内容不完整');
      toast.error('请填写完整的消息内容');
      return;
    }

    try {
      console.log('开始添加通知');
      await addNotification({
        title: title.trim(),
        message: message.trim(),
        type,
      });

      console.log('通知发送成功');
      toast.success('消息发送成功');
      setTitle('');
      setMessage('');
    } catch (error) {
      console.error('发送失败:', error);
      toast.error('发送失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleClearAll = async () => {
    try {
      console.log('开始清空所有消息');
      await clearAll();
      console.log('消息清空成功');
      toast.success('已清空所有消息');
      setShowClearConfirm(false);
    } catch (error) {
      console.error('清空消息失败:', error);
      toast.error('清空消息失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <AdminLayout title="系统通知">
      <div className="space-y-8">
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
                    <div>
                      <h3 className="font-medium">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: zhCN
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeNotification(notification.id)}
                    >
                      删除
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
                此操作将删除所有历史消息，且无法恢复。
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
    </AdminLayout>
  );
} 