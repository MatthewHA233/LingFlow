'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { Mail, Lock, KeyRound, Eye, EyeOff } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import Link from 'next/link';

const emailRegisterSchema = z.object({
  email: z.string().email('请输入正确的邮箱地址'),
  password: z.string()
    .min(6, '密码至少6位')
    .max(50, '密码过长')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/, '密码必须包含字母和数字的组合'),
  confirmPassword: z.string().min(6, '密码至少6位'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

interface EmailRegisterFormProps {
  onSuccess: () => void;
  prefillEmail?: string;
}

export const EmailRegisterForm = forwardRef(({ onSuccess, prefillEmail = '' }: EmailRegisterFormProps, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationTip, setShowVerificationTip] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const signUpWithEmail = useAuthStore(state => state.signUpWithEmail);

  const form = useForm<z.infer<typeof emailRegisterSchema>>({
    resolver: zodResolver(emailRegisterSchema),
    defaultValues: {
      email: prefillEmail || '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (prefillEmail) {
      form.setValue('email', prefillEmail);
    }
  }, [prefillEmail, form]);

  useImperativeHandle(ref, () => ({
    setEmail: (email: string) => {
      form.setValue('email', email);
    }
  }));

  useEffect(() => {
    const handleMouseUp = () => {
      setShowPassword(false);
      setShowConfirmPassword(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  const onSubmit = async (values: z.infer<typeof emailRegisterSchema>) => {
    try {
      setIsLoading(true);
      const { data, error } = await signUpWithEmail(values.email, values.password);
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('该邮箱已注册，请直接登录');
        } else {
          toast.error('注册失败: ' + error.message);
        }
        return;
      }

      if (data) {
        console.log('注册成功:', data);
        setRegisteredEmail(values.email);
        setShowVerificationTip(true);
        toast.success('注册成功！请查收邮件完成验证');
      }
    } catch (error) {
      console.error('注册失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('注册失败: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerificationTip) {
    return (
      <div className="bg-gray-800/50 backdrop-blur p-6 rounded-2xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">验证邮件已发送</h3>
          <p className="text-gray-400 text-sm">
            我们已向 {registeredEmail} 发送了一封验证邮件。
            <br />请查收邮件并点击验证链接完成注册。
          </p>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-gray-700/30 rounded-lg">
            <h4 className="font-medium text-white mb-2">没有收到验证邮件？</h4>
            <ul className="text-sm text-gray-400 space-y-2 text-left">
              <li>• 请检查垃圾邮件文件夹</li>
              <li>• 确保邮箱地址输入正确</li>
              <li>• 邮件可能有几分钟延迟</li>
            </ul>
          </div>
          <Button 
            variant="outline"
            className="w-full bg-gray-700/30 border-gray-600 hover:bg-gray-600/50"
            onClick={() => setShowVerificationTip(false)}
          >
            返回修改邮箱
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur p-6 rounded-2xl">
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
                      placeholder="请输入密码（至少6位，包含字母和数字）" 
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
                <p className="text-xs text-gray-400 mt-1">密码必须至少包含一个字母和一个数字</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-200">确认密码</FormLabel>
                <FormControl>
                  <div className="relative">
                    <KeyRound className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="请再次输入密码" 
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

          <HoverBorderGradient
            containerClassName="w-full rounded-full"
            className="w-full py-2"
          >
            <button type="submit" className="w-full text-white" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </button>
          </HoverBorderGradient>
        </form>
      </Form>
    </div>
  );
});

EmailRegisterForm.displayName = 'EmailRegisterForm'; 