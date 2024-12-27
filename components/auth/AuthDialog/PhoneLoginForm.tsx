'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

const phoneLoginSchema = z.object({
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号'),
  code: z.string()
    .length(6, '验证码必须是6位数字')
    .regex(/^\d+$/, '验证码只能包含数字'),
});

interface PhoneLoginFormProps {
  onSuccess: () => void;
}

export function PhoneLoginForm({ onSuccess }: PhoneLoginFormProps) {
  const { signInWithPhone } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const form = useForm<z.infer<typeof phoneLoginSchema>>({
    resolver: zodResolver(phoneLoginSchema),
    defaultValues: {
      phone: '',
      code: '',
    },
  });

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onSendCode = async () => {
    const phone = form.getValues('phone');
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      form.setError('phone', { message: '请输入正确的手机号' });
      return;
    }
    
    try {
      // TODO: 实现发送验证码的API调用
      startCountdown();
    } catch (error) {
      console.error('发送验证码失败:', error);
    }
  };

  const onSubmit = async (values: z.infer<typeof phoneLoginSchema>) => {
    try {
      setIsLoading(true);
      await signInWithPhone(values.phone, values.code);
      onSuccess();
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>手机号</FormLabel>
              <FormControl>
                <Input placeholder="请输入手机号" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>验证码</FormLabel>
              <div className="flex space-x-2">
                <FormControl>
                  <Input placeholder="请输入验证码" {...field} />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSendCode}
                  disabled={countdown > 0}
                >
                  {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '登录中...' : '登录'}
        </Button>
      </form>
    </Form>
  );
}