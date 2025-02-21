import { create } from 'zustand';
import { supabase } from '@/lib/supabase-client';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
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
  checkRole: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  role: null,

  signUpWithEmail: async (email: string, password: string) => {
    try {
      console.log('开始邮箱注册流程:', email);
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
        console.log('用户创建成功，开始创建 profile:', data.user.id);
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

        console.log('用户 profile 创建成功');
        set({ role: 'user' });
        return { data };
      } else {
        console.error('注册失败：未能创建用户');
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
    console.log('开始邮箱登录:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('登录失败:', error);
      throw new Error(error.message);
    }
    
    console.log('登录成功，获取用户角色');
    // 获取用户角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    console.log('用户角色:', profile?.role);
    set({ 
      user: data.user, 
      session: data.session,
      role: profile?.role || 'user'
    });
  },

  signInWithWechat: async () => {
    toast.error('微信登录功能开发中');
  },

  signOut: async () => {
    console.log('开始登出');
    await supabase.auth.signOut();
    console.log('登出成功');
    set({ user: null, session: null, role: null });
  },

  initialize: async () => {
    try {
      console.log('开始初始化认证状态');
      // 获取初始会话
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('初始化会话失败:', error);
        set({ user: null, session: null, role: null, loading: false });
        return () => {};
      }

      let role = null;
      if (session?.user) {
        console.log('找到会话，获取用户角色:', session.user.id);
        // 获取用户角色
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        role = profile?.role || 'user';
        console.log('用户角色:', role);
      }

      // 设置初始状态
      console.log('设置初始状态:', {
        userId: session?.user?.id,
        role,
      });
      set({ 
        user: session?.user ?? null, 
        session, 
        role,
        loading: false 
      });

      // 监听认证状态变化
      console.log('开始监听认证状态变化');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('认证状态变化:', event, session?.user?.id);
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('用户登录，获取角色');
            // 获取用户角色
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();

            console.log('设置新状态:', {
              userId: session.user.id,
              role: profile?.role,
            });
            set({ 
              user: session.user, 
              session,
              role: profile?.role || 'user'
            });
          } else if (event === 'SIGNED_OUT') {
            console.log('用户登出，清除状态');
            set({ user: null, session: null, role: null });
          }
        }
      );

      return () => {
        console.log('清理认证状态监听器');
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('认证状态初始化失败:', error);
      set({ user: null, session: null, role: null, loading: false });
      return () => {};
    }
  },

  checkRole: async () => {
    const state = get();
    console.log('检查用户角色:', {
      userId: state.user?.id,
      currentRole: state.role,
    });
    
    if (!state.user) {
      console.log('未找到用户，返回 null');
      return null;
    }
    if (state.role) {
      console.log('使用缓存的角色:', state.role);
      return state.role;
    }

    console.log('从数据库获取角色');
    // 如果没有角色信息，从数据库获取
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', state.user.id)
      .single();

    const role = profile?.role || 'user';
    console.log('获取到的角色:', role);
    set({ role });
    return role;
  },

  sendPhoneVerification: async (phone: string) => {
    try {
      console.log('发送手机验证码:', phone);
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('发送验证码失败:', error);
        throw new Error(error.message || '发送验证码失败');
      }

      console.log('验证码发送成功');
      return true;
    } catch (error) {
      console.error('发送验证码失败:', error);
      throw error;
    }
  },

  signInWithPhoneCode: async (phone: string, code: string) => {
    console.log('开始手机验证码登录:', phone);
    const { data, error } = await supabase
      .rpc('verify_phone_code', { 
        p_phone: phone,
        p_code: code 
      });

    if (error) throw error;
    if (!data) throw new Error('验证码无效');

    console.log('验证码验证成功，创建用户');
    // 验证成功后，创建或更新用户
    const { error: authError } = await supabase.auth.signUp({
      phone,
      password: code, // 使用验证码作为临时密码
    });

    if (authError) throw authError;
    console.log('手机登录成功');
  },

  updatePassword: async (currentPassword: string, newPassword: string) => {
    try {
      console.log('开始更新密码');
      // 先验证当前密码
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email: get().user?.email!,
        password: currentPassword,
      });

      if (signInError) {
        console.error('当前密码验证失败:', signInError);
        throw new Error('当前密码错误');
      }

      console.log('当前密码验证成功，更新新密码');
      // 更新密码
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('密码更新失败:', error);
        throw error;
      }
      console.log('密码更新成功');
    } catch (error) {
      console.error('密码更新失败:', error);
      throw error;
    }
  },

  deleteAccount: async () => {
    try {
      console.log('开始注销账号');
      const user = get().user;
      if (!user) {
        console.error('用户未登录');
        throw new Error('用户未登录');
      }

      console.log('删除用户数据');
      // 删除用户相关的所有数据
      const { error: deleteDataError } = await supabase
        .from('books')
        .delete()
        .eq('user_id', user.id);

      if (deleteDataError) {
        console.error('删除用户数据失败:', deleteDataError);
        throw deleteDataError;
      }

      console.log('删除用户账号');
      // 删除用户账号
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
        user.id
      );

      if (deleteUserError) {
        console.error('删除用户账号失败:', deleteUserError);
        throw deleteUserError;
      }

      console.log('注销成功，执行登出');
      // 登出
      await supabase.auth.signOut();
      set({ user: null, session: null, role: null });
    } catch (error) {
      console.error('账号注销失败:', error);
      throw error;
    }
  },
})); 