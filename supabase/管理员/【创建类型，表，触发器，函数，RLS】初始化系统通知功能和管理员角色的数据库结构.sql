/*
文件说明：初始化系统通知功能和管理员角色的数据库结构

主要功能：
1. 创建必要的枚举类型：
   - message_type: 消息类型（info/success/warning/error）
   - user_role: 用户角色（user/admin）

2. 创建核心数据表：
   - profiles: 用户档案表，包含用户角色信息
   - system_notifications: 系统通知表
   - user_notification_status: 用户通知状态表

3. 设置数据库触发器：
   - 自动更新记录的 updated_at 时间戳

4. 创建辅助函数：
   - is_admin: 检查用户是否为管理员
   - get_unread_notifications_count: 获取未读消息数
   - mark_notification_as_read: 标记单条消息为已读
   - mark_all_notifications_as_read: 标记所有消息为已读

5. 配置行级安全策略(RLS)：
   - 用户只能访问自己的档案
   - 普通用户只能查看系统消息
   - 管理员可以管理系统消息
   - 用户只能管理自己的消息状态
*/

-- 检查并创建消息类型枚举
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE message_type AS ENUM ('info', 'success', 'warning', 'error');
  END IF;
END $$;

-- 检查并创建用户角色枚举
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
  END IF;
END $$;

-- 在 profiles 表中添加 role 字段（如果表不存在则创建）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建系统消息表（如果不存在）
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type message_type NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- 创建用户消息状态表（如果不存在）
CREATE TABLE IF NOT EXISTS user_notification_status (
  user_id UUID REFERENCES auth.users(id),
  notification_id UUID REFERENCES system_notifications(id),
  read_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, notification_id)
);

-- 创建触发器以自动更新 updated_at（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
  -- 创建触发器（如果不存在）
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 创建函数来检查用户是否是管理员
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数来获取用户未读消息数
CREATE OR REPLACE FUNCTION get_unread_notifications_count(user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM system_notifications n
    LEFT JOIN user_notification_status s
      ON s.notification_id = n.id
      AND s.user_id = $1
    WHERE n.is_active = true
      AND s.read_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除现有的策略（如果存在）
DROP POLICY IF EXISTS "用户可以读取自己的 profile" ON profiles;
DROP POLICY IF EXISTS "用户可以更新自己的 profile" ON profiles;
DROP POLICY IF EXISTS "所有用户都可以查看活跃的系统消息" ON system_notifications;
DROP POLICY IF EXISTS "只有管理员可以创建系统消息" ON system_notifications;
DROP POLICY IF EXISTS "只有管理员可以更新系统消息" ON system_notifications;
DROP POLICY IF EXISTS "只有管理员可以删除系统消息" ON system_notifications;
DROP POLICY IF EXISTS "notification_status_select" ON user_notification_status;
DROP POLICY IF EXISTS "notification_status_insert" ON user_notification_status;
DROP POLICY IF EXISTS "notification_status_update" ON user_notification_status;

-- 创建 RLS 策略
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_status ENABLE ROW LEVEL SECURITY;

-- Profiles 的访问策略
CREATE POLICY "用户可以读取自己的 profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "用户可以更新自己的 profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- System Notifications 的访问策略
CREATE POLICY "所有用户都可以查看活跃的系统消息"
  ON system_notifications FOR SELECT
  USING (is_active = true);

CREATE POLICY "只有管理员可以创建系统消息"
  ON system_notifications FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "只有管理员可以更新系统消息"
  ON system_notifications FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "只有管理员可以删除系统消息"
  ON system_notifications FOR DELETE
  USING (is_admin(auth.uid()));

-- User Notification Status 的访问策略
CREATE POLICY "notification_status_select"
  ON user_notification_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notification_status_insert"
  ON user_notification_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_status_update"
  ON user_notification_status FOR UPDATE
  USING (auth.uid() = user_id);

-- 添加一些辅助函数
CREATE OR REPLACE FUNCTION mark_notification_as_read(
  p_user_id uuid,
  p_notification_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_notification_status (user_id, notification_id, read_at)
  VALUES (p_user_id, p_notification_id, NOW())
  ON CONFLICT (user_id, notification_id)
  DO UPDATE SET read_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_as_read(
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_notification_status (user_id, notification_id, read_at)
  SELECT p_user_id, id, NOW()
  FROM system_notifications
  WHERE is_active = true
  ON CONFLICT (user_id, notification_id)
  DO UPDATE SET read_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 