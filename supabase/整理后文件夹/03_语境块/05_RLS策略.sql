-- 03_语境块模块 - RLS策略定义

-- 启用 content_parents 表的 RLS
ALTER TABLE content_parents ENABLE ROW LEVEL SECURITY;

-- 启用 context_blocks 表的 RLS
ALTER TABLE context_blocks ENABLE ROW LEVEL SECURITY;

-- content_parents 表的 RLS 策略

-- 用户访问自己的内容
CREATE POLICY "用户访问自己的内容" 
ON content_parents FOR ALL 
TO public 
USING (user_id = auth.uid());

-- 用户访问自己的内容父级
CREATE POLICY "用户访问自己的内容父级" 
ON content_parents FOR ALL 
TO public 
USING (user_id = auth.uid());

-- context_blocks 表的 RLS 策略

-- 用户访问自己的语境块
CREATE POLICY "用户访问自己的语境块" 
ON context_blocks FOR ALL 
TO public 
USING (EXISTS (
  SELECT 1
  FROM content_parents
  WHERE content_parents.id = context_blocks.parent_id 
    AND content_parents.user_id = auth.uid()
));

-- 用户可以完全控制自己的内容块
CREATE POLICY "用户可以完全控制自己的内容块" 
ON context_blocks FOR ALL 
TO public 
USING (parent_id IN (
  SELECT content_parents.id
  FROM content_parents
  WHERE content_parents.user_id = auth.uid()
))
WITH CHECK (parent_id IN (
  SELECT content_parents.id
  FROM content_parents
  WHERE content_parents.user_id = auth.uid()
));

-- 用户访问自己的内容块（认证用户）
CREATE POLICY "用户访问自己的内容块" 
ON context_blocks FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM content_parents
  WHERE content_parents.id = context_blocks.parent_id 
    AND content_parents.user_id = auth.uid()
));

-- 管理员访问所有内容块
CREATE POLICY "管理员访问所有内容块" 
ON context_blocks FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM profiles
  WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'::user_role
));