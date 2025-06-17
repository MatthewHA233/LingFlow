-- 为所有锚点系统表启用 RLS
ALTER TABLE public.anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meaning_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proficiency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meaning_block_contexts ENABLE ROW LEVEL SECURITY;

-- 锚点表策略：基于创建者和语境块关联
-- 首先添加 user_id 字段（如果还没有的话）
ALTER TABLE public.anchors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anchors_user_id ON anchors (user_id);

-- 查看策略：用户可以查看自己创建的锚点，或者通过语境块间接关联的锚点
DROP POLICY IF EXISTS "Users can view own anchors and shared anchors" ON public.anchors;
CREATE POLICY "Users can view own anchors and related anchors" ON public.anchors
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM meaning_blocks mb
      JOIN meaning_block_contexts mbc ON mb.id = mbc.meaning_block_id
      JOIN context_blocks cb ON mbc.context_block_id = cb.id
      JOIN content_parents cp ON cb.parent_id = cp.id
      JOIN chapters ch ON cp.id = ch.parent_id
      JOIN books b ON ch.book_id = b.id
      WHERE mb.anchor_id = anchors.id
        AND b.user_id = auth.uid()
    )
  );

-- 插入策略：用户只能创建属于自己的锚点
CREATE POLICY "Users can insert own anchors" ON public.anchors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 更新策略：用户只能更新自己的锚点
CREATE POLICY "Users can update own anchors" ON public.anchors
  FOR UPDATE USING (auth.uid() = user_id);

-- 删除策略：用户只能删除自己的锚点
CREATE POLICY "Users can delete own anchors" ON public.anchors
  FOR DELETE USING (auth.uid() = user_id);

  -- 含义块表策略：基于锚点所有权
-- 添加 user_id 字段
ALTER TABLE public.meaning_blocks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_meaning_blocks_user_id ON meaning_blocks (user_id);

-- 查看策略：用户可以查看自己的含义块，或者有权限查看的锚点的含义块
DROP POLICY IF EXISTS "Users can view accessible meaning blocks" ON public.meaning_blocks;
CREATE POLICY "Users can view accessible meaning blocks" ON public.meaning_blocks
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM anchors a
      WHERE a.id = meaning_blocks.anchor_id
        AND (
          a.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM meaning_block_contexts mbc
            JOIN context_blocks cb ON mbc.context_block_id = cb.id
            JOIN content_parents cp ON cb.parent_id = cp.id
            JOIN chapters ch ON cp.id = ch.parent_id
            JOIN books b ON ch.book_id = b.id
            WHERE mbc.meaning_block_id = meaning_blocks.id
              AND b.user_id = auth.uid()
          )
        )
    )
  );

-- 插入策略：用户只能为自己有权限的锚点创建含义块
CREATE POLICY "Users can insert meaning blocks for accessible anchors" ON public.meaning_blocks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM anchors a
      WHERE a.id = meaning_blocks.anchor_id
        AND a.user_id = auth.uid()
    )
  );

-- 更新策略：用户只能更新自己的含义块
CREATE POLICY "Users can update own meaning blocks" ON public.meaning_blocks
  FOR UPDATE USING (auth.uid() = user_id);

-- 删除策略：用户只能删除自己的含义块
CREATE POLICY "Users can delete own meaning blocks" ON public.meaning_blocks
  FOR DELETE USING (auth.uid() = user_id);

  -- 熟练度记录表策略：基于含义块所有权
-- 添加 user_id 字段
ALTER TABLE public.proficiency_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_proficiency_records_user_id ON proficiency_records (user_id);

-- 查看策略：用户只能查看自己的熟练度记录
CREATE POLICY "Users can view own proficiency records" ON public.proficiency_records
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM meaning_blocks mb
      WHERE mb.id = proficiency_records.meaning_block_id
        AND mb.user_id = auth.uid()
    )
  );

-- 插入策略：用户只能为自己的含义块创建熟练度记录
CREATE POLICY "Users can insert proficiency records for own meaning blocks" ON public.proficiency_records
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM meaning_blocks mb
      WHERE mb.id = proficiency_records.meaning_block_id
        AND mb.user_id = auth.uid()
    )
  );

-- 更新策略：用户只能更新自己的熟练度记录
CREATE POLICY "Users can update own proficiency records" ON public.proficiency_records
  FOR UPDATE USING (auth.uid() = user_id);

-- 删除策略：用户只能删除自己的熟练度记录
CREATE POLICY "Users can delete own proficiency records" ON public.proficiency_records
  FOR DELETE USING (auth.uid() = user_id);

  -- 含义块语境关联表策略：基于含义块和语境块的权限
-- 添加 user_id 字段
ALTER TABLE public.meaning_block_contexts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_user_id ON meaning_block_contexts (user_id);

-- 查看策略：用户可以查看有权限的关联
DROP POLICY IF EXISTS "Users can view accessible context associations" ON public.meaning_block_contexts;
DROP POLICY IF EXISTS "Users can insert context associations for accessible content" ON public.meaning_block_contexts;

CREATE POLICY "Users can view accessible context associations" ON public.meaning_block_contexts
  FOR SELECT USING (
    auth.uid() = user_id OR
    (
      -- 检查含义块权限
      EXISTS (
        SELECT 1 FROM meaning_blocks mb
        WHERE mb.id = meaning_block_contexts.meaning_block_id
          AND mb.user_id = auth.uid()
      ) AND
      -- 检查语境块权限
      EXISTS (
        SELECT 1 FROM context_blocks cb
        JOIN content_parents cp ON cb.parent_id = cp.id
        JOIN chapters ch ON cp.id = ch.parent_id
        JOIN books b ON ch.book_id = b.id
        WHERE cb.id = meaning_block_contexts.context_block_id
          AND b.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert context associations for accessible content" ON public.meaning_block_contexts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM meaning_blocks mb
      WHERE mb.id = meaning_block_contexts.meaning_block_id
        AND mb.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM context_blocks cb
      JOIN content_parents cp ON cb.parent_id = cp.id
      JOIN chapters ch ON cp.id = ch.parent_id
      JOIN books b ON ch.book_id = b.id
      WHERE cb.id = meaning_block_contexts.context_block_id
        AND b.user_id = auth.uid()
    )
  );

-- 更新策略：用户只能更新自己的关联
CREATE POLICY "Users can update own context associations" ON public.meaning_block_contexts
  FOR UPDATE USING (auth.uid() = user_id);

-- 删除策略：用户只能删除自己的关联
CREATE POLICY "Users can delete own context associations" ON public.meaning_block_contexts
  FOR DELETE USING (auth.uid() = user_id);