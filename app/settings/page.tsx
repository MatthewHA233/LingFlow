'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';

const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string()
    .min(6, '密码至少6位')
    .max(50, '密码过长')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/, '密码必须包含字母和数字的组合'),
  confirmNewPassword: z.string().min(6, '密码至少6位'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "两次输入的新密码不一致",
  path: ["confirmNewPassword"],
});

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, updatePassword, deleteAccount } = useAuthStore();
  const router = useRouter();

  const form = useForm<z.infer<typeof passwordUpdateSchema>>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    const handleMouseUp = () => {
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  const onSubmit = async (values: z.infer<typeof passwordUpdateSchema>) => {
    try {
      setIsLoading(true);
      await updatePassword(values.currentPassword, values.newPassword);
      toast.success('密码修改成功');
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Invalid login credentials')) {
        toast.error('当前密码错误');
      } else {
        toast.error('密码修改失败: ' + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsLoading(true);
      await deleteAccount();
      toast.success('账号已注销');
      router.push('/');
    } catch (error) {
      toast.error('账号注销失败: ' + String(error));
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-400">请先登录</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">账号设置</h1>
          <p className="text-gray-400">管理您的账号安全设置</p>
        </div>

        {/* 密码修改表单 */}
        <div className="bg-gray-800/50 backdrop-blur p-6 rounded-2xl">
          <h2 className="text-xl font-semibold mb-4">修改密码</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-200">当前密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="请输入当前密码" 
                          className="pl-10 pr-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                          {...field} 
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          onMouseDown={() => setShowCurrentPassword(true)}
                          onTouchStart={() => setShowCurrentPassword(true)}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-200">新密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type={showNewPassword ? "text" : "password"}
                          placeholder="请输入新密码（至少6位，包含字母和数字）" 
                          className="pl-10 pr-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                          {...field} 
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          onMouseDown={() => setShowNewPassword(true)}
                          onTouchStart={() => setShowNewPassword(true)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-400 mt-1">密码必须至少包含一个字母和一个数字</p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-200">确认新密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="请再次输入新密码" 
                          className="pl-10 pr-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                          {...field} 
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          onMouseDown={() => setShowConfirmPassword(true)}
                          onTouchStart={() => setShowConfirmPassword(true)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '修改中...' : '修改密码'}
              </Button>
            </form>
          </Form>
        </div>

        {/* 账号注销 */}
        <div className="bg-gray-800/50 backdrop-blur p-6 rounded-2xl">
          <h2 className="text-xl font-semibold mb-4 text-red-500">危险区域</h2>
          <p className="text-gray-400 mb-4">注销账号后，所有数据将被永久删除且无法恢复</p>
          
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                注销账号
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  确认注销账号？
                </DialogTitle>
                <DialogDescription>
                  此操作将永久删除您的账号和所有相关数据，且无法恢复。
                  <br />
                  如果您确定要这样做，请点击下方的确认按钮。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isLoading}
                >
                  {isLoading ? '注销中...' : '确认注销'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
} 