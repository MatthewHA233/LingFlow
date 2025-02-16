'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';

const emailRegisterSchema = z.object({
  email: z.string().email('请输入正确的邮箱地址'),
  password: z.string().min(6, '密码至少6位').max(50, '密码过长'),
  confirmPassword: z.string().min(6, '密码至少6位'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

interface EmailRegisterFormProps {
  onSuccess: () => void;
}

export function EmailRegisterForm({ onSuccess }: EmailRegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const signUpWithEmail = useAuthStore(state => state.signUpWithEmail);

  const form = useForm<z.infer<typeof emailRegisterSchema>>({
    resolver: zodResolver(emailRegisterSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof emailRegisterSchema>) => {
    try {
      setIsLoading(true);
      await signUpWithEmail(values.email, values.password);
      toast.success('注册成功！请查收邮件并点击验证链接完成注册');
      onSuccess(); // 关闭对话框
    } catch (error) {
      console.error('注册失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('already registered')) {
        toast.error('该邮箱已注册，请直接登录');
      } else if (errorMessage.includes('请查收邮件')) {
        toast.success('注册成功！请查收邮件并点击验证链接完成注册');
        onSuccess(); // 关闭对话框
      } else {
        toast.error('注册失败: ' + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input placeholder="请输入邮箱" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="请输入密码" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>确认密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="请再次输入密码" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '注册中...' : '注册'}
        </Button>
      </form>
    </Form>
  );
} 