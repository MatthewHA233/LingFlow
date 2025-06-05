-- =============================================
-- 笔记本功能数据库表结构
-- =============================================

-- 1. 笔记本表 (参考books表结构)
CREATE TABLE public.notebooks (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  title text NOT NULL,
  description text NULL,
  cover_url text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  user_id uuid NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  status text NULL DEFAULT 'active'::text,
  last_accessed_at timestamp with time zone NULL DEFAULT now(),
  note_count integer NOT NULL DEFAULT 0,
  
  CONSTRAINT notebooks_pkey PRIMARY KEY (id),
  CONSTRAINT notebooks_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT notebooks_status_check CHECK (status IN ('active', 'archived', 'deleted'))
) TABLESPACE pg_default;

-- 2. 笔记页面表 (参考chapters表结构，但关联notebooks)
CREATE TABLE public.custom_pages (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  notebook_id uuid NULL,
  title text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  resources jsonb NULL DEFAULT '{}'::jsonb,
  parent_id uuid NULL,
  content text NULL,
  tags text[] NULL DEFAULT '{}',
  
  CONSTRAINT custom_pages_pkey PRIMARY KEY (id),
  CONSTRAINT custom_pages_notebook_id_order_index_key UNIQUE (notebook_id, order_index),
  CONSTRAINT custom_pages_notebook_id_fkey FOREIGN KEY (notebook_id) 
    REFERENCES notebooks (id) ON DELETE CASCADE,
  CONSTRAINT custom_pages_parent_id_fkey FOREIGN KEY (parent_id) 
    REFERENCES content_parents (id)
) TABLESPACE pg_default;

-- =============================================
-- 索引创建
-- =============================================

-- notebooks表索引
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id 
  ON public.notebooks USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_notebooks_status 
  ON public.notebooks USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at 
  ON public.notebooks USING btree (updated_at DESC) TABLESPACE pg_default;

-- custom_pages表索引
CREATE INDEX IF NOT EXISTS idx_custom_pages_notebook_id 
  ON public.custom_pages USING btree (notebook_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_custom_pages_parent_id 
  ON public.custom_pages USING btree (parent_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_custom_pages_order_index 
  ON public.custom_pages USING btree (order_index) TABLESPACE pg_default;

-- =============================================
-- 触发器创建
-- =============================================

-- 更新时间戳触发器
CREATE TRIGGER update_notebooks_updated_at 
  BEFORE UPDATE ON notebooks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_pages_updated_at 
  BEFORE UPDATE ON custom_pages 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 笔记数量统计函数和触发器
-- =============================================

-- 更新笔记本中的页面数量统计函数
CREATE OR REPLACE FUNCTION update_notebook_note_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 处理插入操作
  IF TG_OP = 'INSERT' THEN
    UPDATE notebooks 
    SET note_count = note_count + 1,
        updated_at = now()
    WHERE id = NEW.notebook_id;
    RETURN NEW;
  END IF;
  
  -- 处理删除操作
  IF TG_OP = 'DELETE' THEN
    UPDATE notebooks 
    SET note_count = GREATEST(note_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.notebook_id;
    RETURN OLD;
  END IF;
  
  -- 处理更新操作(笔记本ID变更)
  IF TG_OP = 'UPDATE' THEN
    -- 如果笔记本ID发生变化
    IF OLD.notebook_id != NEW.notebook_id THEN
      -- 从旧笔记本减少计数
      UPDATE notebooks 
      SET note_count = GREATEST(note_count - 1, 0),
          updated_at = now()
      WHERE id = OLD.notebook_id;
      
      -- 向新笔记本增加计数
      UPDATE notebooks 
      SET note_count = note_count + 1,
          updated_at = now()
      WHERE id = NEW.notebook_id;
    ELSE
      -- 只是更新了页面内容，更新笔记本的updated_at
      UPDATE notebooks 
      SET updated_at = now()
      WHERE id = NEW.notebook_id;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到custom_pages表
CREATE TRIGGER trigger_update_notebook_note_count
  AFTER INSERT OR UPDATE OR DELETE ON custom_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_notebook_note_count();

-- =============================================
-- 清理函数 (类似于clean_content_parents_after_chapter_delete)
-- =============================================

-- 删除页面后清理content_parents的函数
CREATE OR REPLACE FUNCTION clean_content_parents_after_page_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 删除关联的content_parents记录
  DELETE FROM content_parents 
  WHERE id = OLD.parent_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 绑定清理触发器
CREATE TRIGGER after_custom_page_delete
  AFTER DELETE ON custom_pages
  FOR EACH ROW
  EXECUTE FUNCTION clean_content_parents_after_page_delete();

-- =============================================
-- 初始化数据统计函数 (可选，用于修复现有数据)
-- =============================================

-- 重新计算所有笔记本的页面数量
CREATE OR REPLACE FUNCTION refresh_notebook_note_counts()
RETURNS void AS $$
BEGIN
  UPDATE notebooks 
  SET note_count = (
    SELECT COUNT(*) 
    FROM custom_pages 
    WHERE custom_pages.notebook_id = notebooks.id
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS (Row Level Security) 政策
-- =============================================

-- 启用RLS
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pages ENABLE ROW LEVEL SECURITY;

-- notebooks表RLS政策
CREATE POLICY "Users can view their own notebooks" ON notebooks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notebooks" ON notebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notebooks" ON notebooks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notebooks" ON notebooks
  FOR DELETE USING (auth.uid() = user_id);

-- custom_pages表RLS政策
CREATE POLICY "Users can view pages of their notebooks" ON custom_pages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notebooks 
      WHERE notebooks.id = custom_pages.notebook_id 
      AND notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pages to their notebooks" ON custom_pages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebooks 
      WHERE notebooks.id = custom_pages.notebook_id 
      AND notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update pages of their notebooks" ON custom_pages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM notebooks 
      WHERE notebooks.id = custom_pages.notebook_id 
      AND notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete pages of their notebooks" ON custom_pages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM notebooks 
      WHERE notebooks.id = custom_pages.notebook_id 
      AND notebooks.user_id = auth.uid()
    )
  );

-- =============================================
-- 注释说明
-- =============================================

COMMENT ON TABLE notebooks IS '笔记本表，存储用户创建的笔记本信息';
COMMENT ON TABLE custom_pages IS '笔记页面表，存储笔记本中的具体页面内容';

COMMENT ON COLUMN notebooks.note_count IS '笔记本中的页面数量，通过触发器自动维护';
COMMENT ON COLUMN notebooks.status IS '笔记本状态：active(活跃), archived(归档), deleted(已删除)';
COMMENT ON COLUMN notebooks.last_accessed_at IS '最后访问时间，用于排序和统计';

COMMENT ON COLUMN custom_pages.order_index IS '页面在笔记本中的排序索引';
COMMENT ON COLUMN custom_pages.content IS '页面的主要内容，支持Markdown格式';
COMMENT ON COLUMN custom_pages.tags IS '页面标签数组，用于分类和搜索';
COMMENT ON COLUMN custom_pages.parent_id IS '关联到content_parents表的ID，用于统一内容管理'; 