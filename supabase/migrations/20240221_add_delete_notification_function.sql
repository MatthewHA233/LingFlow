-- 创建删除通知的函数
CREATE OR REPLACE FUNCTION delete_notification(p_notification_id uuid)
RETURNS void AS $$
BEGIN
  -- 检查用户是否是管理员
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- 更新消息状态为非活跃
  UPDATE system_notifications
  SET is_active = false
  WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 