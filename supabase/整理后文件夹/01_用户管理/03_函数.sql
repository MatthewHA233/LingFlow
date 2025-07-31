-- 01_用户管理模块 - 函数定义

-- 更新 old_auth_users 表的 updated_at 时间戳
CREATE OR REPLACE FUNCTION public.update_old_auth_users_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 删除用户（用户自助删除账号）
CREATE OR REPLACE FUNCTION public.delete_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$

-- 检查是否为管理员
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$function$