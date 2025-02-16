import { create } from 'zustand';
import { supabase } from '@/lib/supabase-client';
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
  initialize: () => Promise<() => void>;
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

    if (error) throw new Error(error.message);
    if (data.session) set({ user: data.user, session: data.session });
  },

  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    set({ user: data.user, session: data.session });
  },

  signInWithWechat: async () => {
    toast.error('微信登录功能开发中');
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user ?? null, session });
    } finally {
      set({ loading: false });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        set({ user: session?.user ?? null, session });
      }
    );

    return () => subscription.unsubscribe();
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