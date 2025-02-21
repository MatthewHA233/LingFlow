/*
文件说明：创建用户自助删除账号的函数

主要功能：
1. 函数名称：delete_user
   - 参数：无
   - 返回值：void (无返回值)
   - 安全级别：SECURITY DEFINER（使用创建者权限执行）
   - 搜索路径：设置为public以确保安全性

2. 身份验证
   - 获取当前用户ID (auth.uid())
   - 验证用户是否已登录
   - 未登录时抛出认证异常

3. 数据删除
   - 直接从auth.users表中删除用户记录
   - 触发器会自动处理关联数据的删除
   - 确保数据完整性

使用场景：
- 用户希望注销自己的账号
- 符合数据保护法规要求（如GDPR）
- 提供用户数据自主权

注意事项：
- 此操作不可逆
- 建议在调用前确认用户意图
- 可能需要配合前端添加二次确认机制
*/

-- 创建删除用户的函数
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
begin
  -- 获取当前用户ID
  _user_id := auth.uid();
  
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 删除用户相关数据
  delete from auth.users where id = _user_id;
end;
$$;