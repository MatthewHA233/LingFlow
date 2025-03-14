import { create } from 'zustand';
import { supabase } from '@/lib/supabase-client';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

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

// 缓存用户角色
const roleCache = new Map<string, string>();

const serviceRoleClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

      // 存储待验证的邮箱，用于重发验证邮件
      if (data?.user) {
        localStorage.setItem('pendingVerificationEmail', email);
      }

      if (error) {
        console.error('注册错误:', error);
        return { error: new Error(error.message) };
      }

      // 检查注册是否成功
      if (data?.user) {
        console.log('用户创建成功，开始创建 profile:', data.user.id);
        
        // 使用 service role client 创建 profile
        const { error: profileError } = await serviceRoleClient
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error('创建用户 profile 失败:', profileError);
          console.error('Profile Error Details:', {
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
            message: profileError.message
          });
          return { error: new Error(`创建用户 profile 失败: ${profileError.message}`) };
        }

        console.log('用户 profile 创建成功');
        set({ role: 'user' });
        return { data };
      } else {
        console.error('注册失败：未能创建用户');
        return { error: new Error('注册失败：未能创建用户') };
      }
    } catch (error) {
      console.error('注册过程出错:', error);
      return { error: error instanceof Error ? error : new Error('未知错误') };
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    
    // 检查角色缓存
    const cachedRole = roleCache.get(data.user.id);
    if (cachedRole) {
      set({ user: data.user, session: data.session, role: cachedRole });
      return;
    }

    // 获取并缓存角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role || 'user';
    roleCache.set(data.user.id, role);
    set({ user: data.user, session: data.session, role });
  },

  signInWithWechat: async () => {
    toast.error('微信登录功能开发中');
  },

  signOut: async () => {
    const userId = get().user?.id;
    if (userId) roleCache.delete(userId);
    await supabase.auth.signOut();
    set({ user: null, session: null, role: null });
  },

  initialize: async () => {
    try {
      // 1. 获取初始会话，不立即查询角色
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        set({ user: null, session: null, role: null, loading: false });
        return () => {};
      }

      // 2. 如果角色已缓存，直接使用缓存
      const cachedRole = roleCache.get(session.user.id);
      if (cachedRole) {
        set({ 
          user: session.user, 
          session, 
          role: cachedRole,
          loading: false 
        });
      } else {
        // 3. 否则设置基本状态，异步加载角色
        set({ 
          user: session.user, 
          session,
          loading: true 
        });

        // 异步获取角色
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const role = profile?.role || 'user';
        roleCache.set(session.user.id, role);
        set({ role, loading: false });
      }

      // 4. 监听认证状态变化
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const cachedRole = roleCache.get(session.user.id);
            if (cachedRole) {
              // 使用缓存的角色
              set({ user: session.user, session, role: cachedRole });
            } else {
              // 先设置基本状态
              set({ user: session.user, session, loading: true });
              
              // 异步获取角色
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

              const role = profile?.role || 'user';
              roleCache.set(session.user.id, role);
              set({ role, loading: false });
            }
          } else if (event === 'SIGNED_OUT') {
            set({ user: null, session: null, role: null, loading: false });
          }
        }
      );

      return () => {
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
    
    if (!state.user) {
      return null;
    }

    // 优先使用缓存的角色
    if (state.role) {
      return state.role;
    }

    try {
      // 从数据库获取角色
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', state.user.id)
        .single();

      const role = profile?.role || 'user';
      set({ role });  // 更新状态
      return role;
    } catch (error) {
      console.error('获取角色失败:', error);
      return null;
    }
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

      // 调用数据库函数删除用户
      const { error } = await supabase
        .rpc('delete_user');  // 不需要传递user_id参数，函数会自动获取当前用户ID

      if (error) {
        console.error('删除用户失败:', error);
        throw error;
      }

      console.log('注销成功，执行登出');
      await supabase.auth.signOut();
      set({ user: null, session: null, role: null });
    } catch (error) {
      console.error('账号注销失败:', error);
      throw error;
    }
  },
})); 