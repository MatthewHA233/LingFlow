'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneLoginForm } from './PhoneLoginForm';
import { WechatLogin } from './WechatLogin';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle className="text-center text-lg font-semibold">
          登录/注册
        </DialogTitle>
        <Tabs defaultValue="phone" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone">手机号登录</TabsTrigger>
            <TabsTrigger value="wechat">微信登录</TabsTrigger>
          </TabsList>
          <TabsContent value="phone">
            <PhoneLoginForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="wechat">
            <WechatLogin onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}