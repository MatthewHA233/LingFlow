-- 修复锚点系统RLS策略的循环引用问题
-- 问题：anchors表策略引用meaning_blocks，meaning_blocks表策略又引用anchors，造成无限递归

-- 1. 删除所有现有策略
DROP POLICY IF EXISTS "Users can view own anchors and related anchors" ON public.anchors;
DROP POLICY IF EXISTS "Users can view accessible meaning blocks" ON public.meaning_blocks;
DROP POLICY IF EXISTS "Users can view accessible context associations" ON public.meaning_block_contexts;

-- 2. 创建简化的锚点表策略（只基于user_id，避免循环引用）
CREATE POLICY "Users can view own anchors" ON public.anchors
  FOR SELECT USING (auth.uid() = user_id);

-- 3. 创建简化的含义块表策略（只基于user_id，避免循环引用）
CREATE POLICY "Users can view own meaning blocks" ON public.meaning_blocks
  FOR SELECT USING (auth.uid() = user_id);

-- 4. 创建简化的含义块语境关联表策略（只基于user_id，避免循环引用）
CREATE POLICY "Users can view own context associations" ON public.meaning_block_contexts
  FOR SELECT USING (auth.uid() = user_id);

-- 5. 确保所有表都有user_id字段的默认值设置为当前用户
-- 更新现有数据的user_id（如果为空的话）
UPDATE public.anchors 
SET user_id = auth.uid() 
WHERE user_id IS NULL AND auth.uid() IS NOT NULL;

UPDATE public.meaning_blocks 
SET user_id = auth.uid() 
WHERE user_id IS NULL AND auth.uid() IS NOT NULL;

UPDATE public.meaning_block_contexts 
SET user_id = auth.uid() 
WHERE user_id IS NULL AND auth.uid() IS NOT NULL;

-- 6. 添加触发器自动设置user_id
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为锚点表添加触发器
DROP TRIGGER IF EXISTS set_anchors_user_id ON public.anchors;
CREATE TRIGGER set_anchors_user_id
  BEFORE INSERT ON public.anchors
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- 为含义块表添加触发器
DROP TRIGGER IF EXISTS set_meaning_blocks_user_id ON public.meaning_blocks;
CREATE TRIGGER set_meaning_blocks_user_id
  BEFORE INSERT ON public.meaning_blocks
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- 为含义块语境关联表添加触发器
DROP TRIGGER IF EXISTS set_meaning_block_contexts_user_id ON public.meaning_block_contexts;
CREATE TRIGGER set_meaning_block_contexts_user_id
  BEFORE INSERT ON public.meaning_block_contexts
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id(); 