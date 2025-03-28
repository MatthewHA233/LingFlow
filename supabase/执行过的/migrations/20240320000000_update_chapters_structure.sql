-- 为context_blocks添加RLS策略
ALTER TABLE context_blocks ENABLE ROW LEVEL SECURITY;

-- 删除所有已存在的策略
DROP POLICY IF EXISTS "用户可以访问自己的内容块" ON context_blocks;
DROP POLICY IF EXISTS "用户可以更新自己的内容块" ON context_blocks;
DROP POLICY IF EXISTS "用户可以插入内容块" ON context_blocks;
DROP POLICY IF EXISTS "用户可以删除自己的内容块" ON context_blocks;

-- 创建单一的ALL权限策略
CREATE POLICY "用户可以完全控制自己的内容块"
  ON context_blocks FOR ALL
  USING (
    parent_id IN (
      SELECT id FROM content_parents
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    parent_id IN (
      SELECT id FROM content_parents
      WHERE user_id = auth.uid()
    )
  ); 