'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailLoginForm } from './EmailLoginForm';
import { EmailRegisterForm } from './EmailRegisterForm';
import { WechatLogin } from './WechatLogin';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle className="text-center text-lg font-semibold">
          登录/注册
        </DialogTitle>
        <DialogDescription className="text-center text-sm text-muted-foreground">
          请选择登录方式
        </DialogDescription>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">邮箱登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <EmailLoginForm onSuccess={() => onOpenChange(false)} />
            <div className="mt-4">
              <WechatLogin onSuccess={() => onOpenChange(false)} />
            </div>
          </TabsContent>
          <TabsContent value="register">
            <EmailRegisterForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}