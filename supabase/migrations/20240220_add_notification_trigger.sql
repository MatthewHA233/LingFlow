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