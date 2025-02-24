DO $$
DECLARE
  _user_id uuid := '5f837d80-0dc7-4360-95d1-cbc1c9523703';
BEGIN
  -- 1. 删除语音识别相关数据
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

  -- 2. 删除其他相关数据
  delete from books where user_id = _user_id;
  delete from profiles where id = _user_id;
  
  -- 3. 最后删除用户认证数据
  delete from auth.users where id = _user_id;
END $$;