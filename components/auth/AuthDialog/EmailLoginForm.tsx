'use client';

import { useState, useEffect } from 'react';
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
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import Link from 'next/link';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

const emailLoginSchema = z.object({
  email: z.string().email('请输入正确的邮箱地址'),
  password: z.string().min(6, '密码至少6位').max(50, '密码过长'),
});

interface EmailLoginFormProps {
  onSuccess: () => void;
  onSwitchToRegister?: (email: string) => void;
}

export function EmailLoginForm({ onSuccess, onSwitchToRegister }: EmailLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signInWithEmail = useAuthStore(state => state.signInWithEmail);
  const checkEmailInOldAuth = useAuthStore(state => state.checkEmailInOldAuth);
  const [showMigrationAlert, setShowMigrationAlert] = useState(false);
  const [migrationEmail, setMigrationEmail] = useState('');

  const form = useForm<z.infer<typeof emailLoginSchema>>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const handleMouseUp = () => {
      setShowPassword(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  const showOldUserAlert = (email: string) => {
    setMigrationEmail(email);
    setShowMigrationAlert(true);
  };

  const onSubmit = async (values: z.infer<typeof emailLoginSchema>) => {
    try {
      setIsLoading(true);
      await signInWithEmail(values.email, values.password);
      onSuccess();
      toast.success('登录成功');
    } catch (error: any) {
      console.error('登录失败:', error);
      const errorMessage = error?.message || '未知错误';
      
      if (errorMessage.includes('Invalid login credentials')) {
        toast.error('邮箱或密码错误');
        const isOld = await checkEmailInOldAuth(values.email);
        if (isOld) {
          showOldUserAlert(values.email);
        }
      } else {
        toast.error('登录失败: ' + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur p-6 rounded-2xl">
      {showMigrationAlert && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/60 backdrop-blur-md">
          <div className="relative p-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl w-full max-w-lg mx-4">
            <div className="p-8 bg-gray-900/90 backdrop-filter backdrop-blur-sm rounded-[10px] relative">
              <h1 className="text-2xl font-bold text-white mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                用户数据迁移通知
              </h1>
              
              <p className="text-gray-200 mb-8 text-center leading-relaxed">
                <span className="font-semibold">{migrationEmail}</span>你好，由于
                <span className="text-red-400 font-bold text-lg mx-1">数据库迁移</span>，
                请您<span className="text-red-400 font-bold text-lg mx-1">重新注册</span>，谢谢！
              </p>
              
              <div className="mt-8">
                <button 
                  className="p-[2px] relative w-full rounded-lg overflow-hidden group"
                  onClick={() => {
                    setShowMigrationAlert(false);
                    if (onSwitchToRegister) {
                      onSwitchToRegister(migrationEmail);
                    }
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-lg" />
                  <div className="px-6 py-3 bg-gray-900 rounded-[6px] relative group transition duration-200 text-white font-medium hover:bg-transparent">
                    我已了解详情，点击开始重新注册
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-200">邮箱</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input 
                      placeholder="请输入邮箱" 
                      type="email" 
                      className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                      {...field} 
                    />
                  </div>
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
                <FormLabel className="text-gray-200">密码</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input 
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码" 
                      className="pl-10 pr-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                      {...field} 
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      onMouseDown={() => setShowPassword(true)}
                      onTouchStart={() => setShowPassword(true)}
                    >
                      {showPassword ? (
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

          <HoverBorderGradient
            containerClassName="w-full rounded-full"
            className="w-full py-2"
          >
            <button type="submit" className="w-full text-white" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </button>
          </HoverBorderGradient>
        </form>
      </Form>
    </div>
  );
} 