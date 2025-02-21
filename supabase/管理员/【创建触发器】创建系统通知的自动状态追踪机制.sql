/*
文件说明：创建系统通知的自动状态追踪机制

主要功能：
1. 创建触发器函数 create_notification_status()
   - 功能：当新的系统通知创建时，自动为所有用户创建对应的通知状态记录
   - 安全级别：SECURITY DEFINER（使用创建者权限执行）
   - 触发时机：新通知插入后（AFTER INSERT）

2. 创建触发器 trigger_create_notification_status
   - 绑定表：system_notifications
   - 触发条件：每行插入后触发（FOR EACH ROW）
   - 执行函数：create_notification_status()

3. 数据补充
   - 为现有的系统通知创建用户状态记录
   - 使用CROSS JOIN确保为每个用户-通知组合创建状态
   - 包含重复检查逻辑，避免重复插入

使用场景：
- 确保每个系统通知都能被所有用户看到
- 自动化通知状态管理
- 支持通知的已读/未读追踪
*/

-- 创建触发器函数
CREATE OR REPLACE FUNCTION create_notification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 为所有用户创建通知状态记录
  INSERT INTO user_notification_status (user_id, notification_id)
  SELECT id, NEW.id
  FROM auth.users;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_create_notification_status ON system_notifications;
CREATE TRIGGER trigger_create_notification_status
  AFTER INSERT ON system_notifications
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_status();

-- 为现有的通知创建状态记录
INSERT INTO user_notification_status (user_id, notification_id)
SELECT u.id, n.id
FROM auth.users u
CROSS JOIN system_notifications n
WHERE NOT EXISTS (
  SELECT 1 
  FROM user_notification_status s 
  WHERE s.user_id = u.id 
  AND s.notification_id = n.id
); 