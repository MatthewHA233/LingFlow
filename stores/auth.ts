import { create } from 'zustand';
import { supabase } from '@/lib/supabase-client';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<{
    data?: { user: User | null; session: Session | null };
    error?: Error;
  }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithWechat: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<() => void>;
  sendPhoneVerification: (phone: string) => Promise<boolean>;
  signInWithPhoneCode: (phone: string, code: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signUpWithEmail: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            email_confirmed: false,
          }
        }
      });

      if (error) {
        console.error('注册错误:', error);
        return { error: new Error(error.message) };
      }

      // 检查注册是否成功
      if (data?.user) {
        // 创建用户 profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            role: 'user'
          });

        if (profileError) {
          console.error('创建用户 profile 失败:', profileError);
          return { error: new Error('创建用户 profile 失败') };
        }

        console.log('用户创建成功:', data.user);
        return { data };
      } else {
        return { 
          error: new Error('注册失败：未能创建用户') 
        };
      }
    } catch (error) {
      console.error('注册过程出错:', error);
      return { 
        error: error instanceof Error ? error : new Error('未知错误') 
      };
    }
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
      // 获取初始会话
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('初始化会话失败:', error);
        set({ user: null, session: null, loading: false });
        return () => {}; // 返回空的清理函数
      }

      // 设置初始状态
      set({ user: session?.user ?? null, session, loading: false });

      // 监听认证状态变化
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('认证状态变化:', event, session?.user?.id);
          
          if (event === 'SIGNED_IN') {
            // 确保 profile 记录存在
            if (session?.user) {
              const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                  id: session.user.id,
                  email: session.user.email,
                  role: 'user'
                }, {
                  onConflict: 'id'
                });

              if (profileError) {
                console.error('更新用户 profile 失败:', profileError);
              }
            }
          }

          set({ user: session?.user ?? null, session });
        }
      );

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('认证状态初始化失败:', error);
      set({ user: null, session: null, loading: false });
      return () => {}; // 返回空的清理函数
    }
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

  updatePassword: async (currentPassword: string, newPassword: string) => {
    try {
      // 先验证当前密码
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email: useAuthStore.getState().user?.email!,
        password: currentPassword,
      });

      if (signInError) throw new Error('当前密码错误');

      // 更新密码
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
    } catch (error) {
      console.error('密码更新失败:', error);
      throw error;
    }
  },

  deleteAccount: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('用户未登录');

      // 删除用户相关的所有数据
      const { error: deleteDataError } = await supabase
        .from('books')
        .delete()
        .eq('user_id', user.id);

      if (deleteDataError) throw deleteDataError;

      // 删除用户账号
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
        user.id
      );

      if (deleteUserError) throw deleteUserError;

      // 登出
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } catch (error) {
      console.error('账号注销失败:', error);
      throw error;
    }
  },
})); 