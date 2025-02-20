import { create } from 'zustand';
import { supabase } from '@/lib/supabase-client';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  created_at: Date;
  created_by: string;
  is_active: boolean;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'created_by' | 'is_active' | 'read'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('用户未登录');

      const { data: notifications, error } = await supabase
        .from('system_notifications')
        .select(`
          id,
          title,
          message,
          type,
          created_at,
          created_by,
          is_active,
          user_notification_status!left (
            read_at
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedNotifications = notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        created_at: new Date(n.created_at),
        created_by: n.created_by,
        is_active: n.is_active,
        read: !!n.user_notification_status?.[0]?.read_at
      }));

      const unreadCount = formattedNotifications.filter(n => !n.read).length;

      set({
        notifications: formattedNotifications,
        unreadCount,
        loading: false
      });
    } catch (error) {
      console.error('获取通知失败:', error);
      set({ loading: false });
    }
  },

  addNotification: async (notification) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('用户未登录');

      const { error } = await supabase
        .from('system_notifications')
        .insert({
          title: notification.title,
          message: notification.message,
          type: notification.type,
          created_by: user.id,
          is_active: true
        });

      if (error) throw error;

      // 重新获取通知列表以确保数据同步
      await get().fetchNotifications();
    } catch (error) {
      console.error('添加通知失败:', error);
      throw error;
    }
  },

  markAsRead: async (id) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('用户未登录');

      const { error } = await supabase
        .rpc('mark_notification_as_read', {
          p_notification_id: id,
          p_user_id: user.id
        });

      if (error) throw error;

      // 更新本地状态
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: state.unreadCount - 1
      }));
    } catch (error) {
      console.error('标记通知已读失败:', error);
      throw error;
    }
  },

  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('用户未登录');

      const { error } = await supabase
        .rpc('mark_all_notifications_as_read', {
          p_user_id: user.id
        });

      if (error) throw error;

      // 更新本地状态
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('标记所有通知已读失败:', error);
      throw error;
    }
  },

  removeNotification: async (id) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('用户未登录');

      // 使用 RPC 函数删除消息
      const { error } = await supabase
        .rpc('delete_notification', {
          p_notification_id: id
        });

      if (error) {
        if (error.message.includes('permission denied')) {
          throw new Error('只有管理员可以删除消息');
        }
        throw error;
      }

      // 更新本地状态
      set(state => {
        const notifications = state.notifications.filter(n => n.id !== id);
        const unreadCount = notifications.filter(n => !n.read).length;
        return { notifications, unreadCount };
      });

      // 重新获取通知列表以确保同步
      await get().fetchNotifications();
    } catch (error) {
      console.error('删除通知失败:', error);
      throw error;
    }
  },

  clearAll: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('用户未登录');

      const { error } = await supabase
        .from('system_notifications')
        .update({ is_active: false })
        .eq('is_active', true);

      if (error) throw error;

      // 更新本地状态
      set({ notifications: [], unreadCount: 0 });
      
      // 重新获取通知列表以确保同步
      await get().fetchNotifications();
    } catch (error) {
      console.error('清空通知失败:', error);
      throw error;
    }
  }
})); 