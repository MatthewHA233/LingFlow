-- 创建content_type枚举（如果不存在）
DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('chapter', 'video', 'custom_page', 'collection');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 创建content_parents表（如果不存在）
CREATE TABLE IF NOT EXISTS content_parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type content_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 更新chapters表结构
ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES content_parents(id) ON DELETE CASCADE;

-- 更新context_blocks表中的外键关联
ALTER TABLE context_blocks
  DROP CONSTRAINT IF EXISTS context_blocks_parent_id_fkey,
  ADD CONSTRAINT context_blocks_parent_id_fkey 
    FOREIGN KEY (parent_id) 
    REFERENCES content_parents(id) 
    ON DELETE CASCADE;

-- 更新或创建索引
CREATE INDEX IF NOT EXISTS idx_content_parents_type 
  ON content_parents(content_type);
CREATE INDEX IF NOT EXISTS idx_content_parents_user_id 
  ON content_parents(user_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id 
  ON chapters(parent_id);

-- 更新RLS策略
ALTER TABLE content_parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户访问自己的内容"
  ON content_parents FOR ALL
  USING (user_id = auth.uid());

-- 更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_parents_updated_at
    BEFORE UPDATE ON content_parents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 