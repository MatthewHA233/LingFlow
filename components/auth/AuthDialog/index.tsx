'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailLoginForm } from './EmailLoginForm';
import { EmailRegisterForm } from './EmailRegisterForm';
import { WechatLogin } from './WechatLogin';
import { useState, useRef } from 'react';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);
  const [prefillEmail, setPrefillEmail] = useState<string>('');
  const registerFormRef = useRef<any>(null);

  const handleSwitchToRegister = (email: string) => {
    setPrefillEmail(email);
    setActiveTab('register');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[425px]">
        <DialogTitle className="text-center text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-500">
          欢迎使用洪流二语习得
        </DialogTitle>
        <DialogDescription className="text-center text-sm text-gray-400">
          登录后即可访问您的专属语境库和锚点域
        </DialogDescription>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 p-1">
            <TabsTrigger 
              value="register" 
              className="data-[state=active]:bg-gray-700/50 data-[state=active]:text-primary"
            >
              注册账号
            </TabsTrigger>
            <TabsTrigger 
              value="login"
              className="data-[state=active]:bg-gray-700/50 data-[state=active]:text-primary"
            >
              登录账号
            </TabsTrigger>
          </TabsList>
          <div className="mt-6 space-y-4">
            <TabsContent value="login" className="space-y-4 m-0">
              <EmailLoginForm 
                onSuccess={() => onOpenChange(false)} 
                onSwitchToRegister={handleSwitchToRegister}
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-900 px-2 text-gray-400">或</span>
                </div>
              </div>
              <WechatLogin onSuccess={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="register" className="space-y-4 m-0">
              <EmailRegisterForm 
                onSuccess={() => onOpenChange(false)} 
                prefillEmail={prefillEmail}
                ref={registerFormRef}
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-900 px-2 text-gray-400">或</span>
                </div>
              </div>
              <WechatLogin onSuccess={() => onOpenChange(false)} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}