-- 05_音频处理模块 - RLS策略定义

-- 启用 sentences 表的 RLS
ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;

-- 启用 speech_results 表的 RLS
ALTER TABLE speech_results ENABLE ROW LEVEL SECURITY;

-- 启用 block_sentences 表的 RLS
ALTER TABLE block_sentences ENABLE ROW LEVEL SECURITY;

-- sentences 表的 RLS 策略

-- 用户访问自己的语音识别句子
CREATE POLICY "用户访问自己的语音识别句子" 
ON sentences FOR ALL 
TO public 
USING (EXISTS (
  SELECT 1
  FROM speech_results
  WHERE speech_results.id = sentences.speech_id 
    AND speech_results.user_id = auth.uid()
));

-- speech_results 表的 RLS 策略

-- 用户访问自己的语音识别结果
CREATE POLICY "用户访问自己的语音识别结果" 
ON speech_results FOR ALL 
TO public 
USING (auth.uid() = user_id);

-- 用户访问自己的语音结果（通过书籍关联验证）
CREATE POLICY "用户访问自己的语音结果" 
ON speech_results FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = speech_results.book_id 
    AND books.user_id = auth.uid()
));

-- 管理员访问所有语音结果
CREATE POLICY "管理员访问所有语音结果" 
ON speech_results FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM profiles
  WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'::user_role
));

-- block_sentences 表的 RLS 策略

-- 用户访问自己的块句子关联（包括查看、插入、更新、删除）
CREATE POLICY "用户访问自己的块句子关联" 
ON block_sentences FOR ALL 
TO public 
USING (EXISTS (
  SELECT 1
  FROM context_blocks
  JOIN content_parents ON content_parents.id = context_blocks.parent_id
  WHERE context_blocks.id = block_sentences.block_id 
    AND content_parents.user_id = auth.uid()
));