'use client';

import { create } from 'zustand';
import { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  signInWithPhone: (phone: string, code: string) => Promise<void>;
  signInWithWechat: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,

  signInWithPhone: async (phone: string, code: string) => {
    try {
      // TODO: 实现手机号登录API调用
      const user = { id: '1', phone, name: '用户' };
      set({ user });
    } catch (error) {
      console.error('Phone login failed:', error);
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
      // TODO: 实现登出API调用
      set({ user: null });
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  },
}));