import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithWechat: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  sendPhoneVerification: (phone: string) => Promise<boolean>;
  signInWithPhoneCode: (phone: string, code: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signUpWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('该邮箱已注册');
      }
      throw error;
    }

    if (data.user && !data.user.email_verified) {
      throw new Error('请查收邮件完成验证后登录');
    }

    if (data.session) {
      set({ user: data.user, session: data.session });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('邮箱或密码错误');
      }
      throw error;
    }

    set({ user: data.user, session: data.session });
  },

  signInWithWechat: async () => {
    // TODO: 实现微信登录
    toast.error('微信登录功能开发中');
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } catch (error) {
      console.error('登出失败:', error);
      throw error;
    }
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        set({ user: session.user, session });
      } else {
        await supabase.auth.signOut();
        set({ user: null, session: null });
      }
    } catch (error) {
      console.error('认证初始化错误:', error);
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } finally {
      set({ loading: false });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        set({ user: session?.user ?? null, session });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  },

  sendPhoneVerification: async (phone: string) => {
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '发送验证码失败');
      }

      return true;
    } catch (error) {
      console.error('发送验证码失败:', error);
      throw error;
    }
  },

  signInWithPhoneCode: async (phone: string, code: string) => {
    const { data, error } = await supabase
      .rpc('verify_phone_code', { 
        p_phone: phone,
        p_code: code 
      });

    if (error) throw error;
    if (!data) throw new Error('验证码无效');

    // 验证成功后，创建或更新用户
    const { error: authError } = await supabase.auth.signUp({
      phone,
      password: code, // 使用验证码作为临时密码
    });

    if (authError) throw authError;
  },
})); 