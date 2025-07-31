-- 06_系统管理模块 - RLS策略定义

-- 启用 system_notifications 表的 RLS
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- 启用 user_notification_status 表的 RLS
ALTER TABLE user_notification_status ENABLE ROW LEVEL SECURITY;

-- system_notifications 表的 RLS 策略

-- 所有用户都可以查看活跃的系统消息
CREATE POLICY "所有用户都可以查看活跃的系统消息" 
ON system_notifications FOR SELECT 
TO public 
USING (is_active = true);

-- 只有管理员可以创建系统消息
CREATE POLICY "只有管理员可以创建系统消息" 
ON system_notifications FOR INSERT 
TO public 
WITH CHECK (is_admin(auth.uid()));

-- 只有管理员可以更新系统消息
CREATE POLICY "只有管理员可以更新系统消息" 
ON system_notifications FOR UPDATE 
TO public 
USING (is_admin(auth.uid()));

-- 只有管理员可以删除系统消息
CREATE POLICY "只有管理员可以删除系统消息" 
ON system_notifications FOR DELETE 
TO public 
USING (is_admin(auth.uid()));

-- user_notification_status 表的 RLS 策略

-- 用户可以查看自己的通知状态
CREATE POLICY "notification_status_select" 
ON user_notification_status FOR SELECT 
TO public 
USING (auth.uid() = user_id);

-- 用户可以插入自己的通知状态
CREATE POLICY "notification_status_insert" 
ON user_notification_status FOR INSERT 
TO public 
WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的通知状态
CREATE POLICY "notification_status_update" 
ON user_notification_status FOR UPDATE 
TO public 
USING (auth.uid() = user_id);