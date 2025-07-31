-- 06_系统管理模块 - 函数定义

-- 创建通知状态
CREATE OR REPLACE FUNCTION public.create_notification_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 为所有用户创建通知状态记录
  INSERT INTO user_notification_status (user_id, notification_id)
  SELECT id, NEW.id
  FROM auth.users;
  
  RETURN NEW;
END;
$function$

-- 删除通知
CREATE OR REPLACE FUNCTION public.delete_notification(p_notification_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$

-- 获取未读通知数量
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$

-- 标记所有通知为已读
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO user_notification_status (user_id, notification_id, read_at)
  SELECT p_user_id, id, NOW()
  FROM system_notifications
  WHERE is_active = true
  ON CONFLICT (user_id, notification_id)
  DO UPDATE SET read_at = NOW();
END;
$function$

-- 标记通知为已读
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_user_id uuid, p_notification_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO user_notification_status (user_id, notification_id, read_at)
  VALUES (p_user_id, p_notification_id, NOW())
  ON CONFLICT (user_id, notification_id)
  DO UPDATE SET read_at = NOW();
END;
$function$