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

-- 修改删除用户的函数
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

  -- 按照依赖关系顺序删除数据
  
  -- 1. 删除block_sentences表中的记录
  delete from block_sentences
  where block_id in (
    select cb.id
    from context_blocks cb
    join content_parents cp on cb.parent_id = cp.id
    where cp.user_id = _user_id
  );
  
  -- 2. 删除含义块与语境块关联表中的记录（两种方式：通过语境块和通过用户ID）
  delete from meaning_block_contexts
  where context_block_id in (
    select cb.id
    from context_blocks cb
    join content_parents cp on cb.parent_id = cp.id
    where cp.user_id = _user_id
  ) OR user_id = _user_id;
  
  -- 3. 删除熟练度记录表中的记录
  delete from proficiency_records
  where user_id = _user_id;
  
  -- 4. 删除含义块表中的记录（两种方式：通过关联的语境块和通过用户ID）
  delete from meaning_blocks
  where user_id = _user_id OR id in (
    select mb.id
    from meaning_blocks mb
    join meaning_block_contexts mbc on mb.id = mbc.meaning_block_id
    join context_blocks cb on mbc.context_block_id = cb.id
    join content_parents cp on cb.parent_id = cp.id
    where cp.user_id = _user_id
  );
  
  -- 5. 删除锚点表中用户创建的记录
  delete from anchors
  where user_id = _user_id;
  
  -- 6. 删除context_blocks表中的记录
  delete from context_blocks
  where parent_id in (
    select id from content_parents
    where user_id = _user_id
  );
  
  -- 7. 删除chapters表中的记录
  delete from chapters
  where parent_id in (
    select id from content_parents
    where user_id = _user_id
  );
  
  -- 8. 删除content_parents表中的记录
  delete from content_parents
  where user_id = _user_id;

  -- 9. 删除语音识别相关数据
  delete from words 
  where sentence_id in (
    select s.id from sentences s
    join speech_results sr on sr.id = s.speech_id
    where sr.user_id = _user_id
  );
  
  delete from sentences 
  where speech_id in (
    select id from speech_results 
    where user_id = _user_id
  );
  
  delete from speech_results 
  where user_id = _user_id;

  -- 10. 删除其他相关数据
  delete from books where user_id = _user_id;
  delete from profiles where id = _user_id;
  
  -- 11. 最后删除用户认证数据
  delete from auth.users where id = _user_id;
end;
$$;