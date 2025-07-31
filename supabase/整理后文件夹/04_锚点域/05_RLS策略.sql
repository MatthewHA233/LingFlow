-- 04_锚点域模块 - RLS策略定义

-- 启用 anchors 表的 RLS
ALTER TABLE anchors ENABLE ROW LEVEL SECURITY;

-- 启用 meaning_blocks 表的 RLS
ALTER TABLE meaning_blocks ENABLE ROW LEVEL SECURITY;

-- 启用 meaning_block_contexts 表的 RLS
ALTER TABLE meaning_block_contexts ENABLE ROW LEVEL SECURITY;

-- 启用 proficiency_records 表的 RLS
ALTER TABLE proficiency_records ENABLE ROW LEVEL SECURITY;

-- anchors 表的 RLS 策略

-- 用户可以查看自己的锚点
CREATE POLICY "Users can view own anchors" 
ON anchors FOR SELECT 
TO public 
USING (auth.uid() = user_id);

-- 用户可以插入自己的锚点
CREATE POLICY "Users can insert own anchors" 
ON anchors FOR INSERT 
TO public 
WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的锚点
CREATE POLICY "Users can update own anchors" 
ON anchors FOR UPDATE 
TO public 
USING (auth.uid() = user_id);

-- 用户可以删除自己的锚点
CREATE POLICY "Users can delete own anchors" 
ON anchors FOR DELETE 
TO public 
USING (auth.uid() = user_id);

-- meaning_blocks 表的 RLS 策略

-- 用户可以查看自己的含义块
CREATE POLICY "Users can view own meaning blocks" 
ON meaning_blocks FOR SELECT 
TO public 
USING (auth.uid() = user_id);

-- 用户可以为可访问的锚点插入含义块
CREATE POLICY "Users can insert meaning blocks for accessible anchors" 
ON meaning_blocks FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1
    FROM anchors a
    WHERE a.id = meaning_blocks.anchor_id 
      AND a.user_id = auth.uid()
  )
);

-- 用户可以更新自己的含义块
CREATE POLICY "Users can update own meaning blocks" 
ON meaning_blocks FOR UPDATE 
TO public 
USING (auth.uid() = user_id);

-- 用户可以删除自己的含义块
CREATE POLICY "Users can delete own meaning blocks" 
ON meaning_blocks FOR DELETE 
TO public 
USING (auth.uid() = user_id);

-- meaning_block_contexts 表的 RLS 策略

-- 用户可以查看自己的上下文关联
CREATE POLICY "Users can view own context associations" 
ON meaning_block_contexts FOR SELECT 
TO public 
USING (auth.uid() = user_id);

-- 用户可以为可访问的内容插入上下文关联
CREATE POLICY "Users can insert context associations for accessible content" 
ON meaning_block_contexts FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1
    FROM meaning_blocks mb
    WHERE mb.id = meaning_block_contexts.meaning_block_id 
      AND mb.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM context_blocks cb
    JOIN content_parents cp ON cb.parent_id = cp.id
    JOIN chapters ch ON cp.id = ch.parent_id
    JOIN books b ON ch.book_id = b.id
    WHERE cb.id = meaning_block_contexts.context_block_id 
      AND b.user_id = auth.uid()
  )
);

-- 用户可以更新自己的上下文关联
CREATE POLICY "Users can update own context associations" 
ON meaning_block_contexts FOR UPDATE 
TO public 
USING (auth.uid() = user_id);

-- 用户可以删除自己的上下文关联
CREATE POLICY "Users can delete own context associations" 
ON meaning_block_contexts FOR DELETE 
TO public 
USING (auth.uid() = user_id);

-- proficiency_records 表的 RLS 策略

-- 用户可以查看自己的熟练度记录
CREATE POLICY "Users can view own proficiency records" 
ON proficiency_records FOR SELECT 
TO public 
USING (auth.uid() = user_id);

-- 用户可以为自己的含义块插入熟练度记录
CREATE POLICY "Users can insert proficiency records for own meaning blocks" 
ON proficiency_records FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1
    FROM meaning_blocks mb
    WHERE mb.id = proficiency_records.meaning_block_id 
      AND mb.user_id = auth.uid()
  )
);

-- 用户可以更新自己的熟练度记录
CREATE POLICY "Users can update own proficiency records" 
ON proficiency_records FOR UPDATE 
TO public 
USING (auth.uid() = user_id);

-- 用户可以删除自己的熟练度记录
CREATE POLICY "Users can delete own proficiency records" 
ON proficiency_records FOR DELETE 
TO public 
USING (auth.uid() = user_id);