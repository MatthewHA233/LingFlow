/*
文件说明：创建管理员删除系统通知的函数

主要功能：
1. 函数名称：delete_notification
   - 参数：p_notification_id (uuid类型) - 要删除的通知ID
   - 返回值：void (无返回值)
   - 安全级别：SECURITY DEFINER（使用创建者权限执行）

2. 权限检查
   - 调用is_admin()函数验证当前用户是否为管理员
   - 非管理员调用时抛出权限异常

3. 软删除实现
   - 不直接删除数据库记录
   - 通过更新is_active字段为false来实现软删除
   - 保留历史记录便于审计

使用场景：
- 管理员需要下架过期或不当的系统通知
- 系统维护时批量处理历史通知
- 紧急情况下快速撤回错误发布的通知
*/

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