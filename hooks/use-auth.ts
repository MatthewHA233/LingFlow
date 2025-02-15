'use client';

import { create } from 'zustand';
import { User } from '@/types/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

interface AuthState {
  user: User | null;
  signInWithPhone: (phone: string, credential: string, mode: 'password' | 'code') => Promise<void>;
  signInWithWechat: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,

  signInWithPhone: async (phone: string, credential: string, mode: 'password' | 'code') => {
    try {
      let result;
      
      if (mode === 'password') {
        result = await supabase.auth.signInWithPassword({
          phone,
          password: credential,
        });
      } else {
        // 保持现有的验证码登录逻辑（目前是模拟的）
        result = { data: { user: { id: '1', phone, name: '用户' } } };
      }

      if (result.error) {
        throw result.error;
      }

      set({ user: result.data.user });
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  },

  signInWithWechat: async () => {
    try {
      // TODO: 实现微信登录API调用
      const user = { id: '1', name: '用户' };
      set({ user });
    } catch (error) {
      console.error('WeChat login failed:', error);
      throw error;
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null });
    } catch (error) {
      console.error('登出失败:', error);
      throw error;
    }
  },
}));