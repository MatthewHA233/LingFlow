-- 为现有 books 和 chapters 表添加必要字段和触发器
-- 支持笔记本功能，使用现有的语境块架构

-- ========================================
-- 1. 创建书籍类型枚举并添加字段
-- ========================================

-- 创建书籍类型枚举（检查是否已存在）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'book_type') THEN
    CREATE TYPE book_type AS ENUM ('book', 'notebook');
  END IF;
END $$;

-- 为 books 表添加类型字段
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS type book_type NOT NULL DEFAULT 'book';

-- 为 books 表添加章节计数字段
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS note_count INTEGER NOT NULL DEFAULT 0;

-- 为 books 表添加最后访问时间字段
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- ========================================
-- 2. 创建索引
-- ========================================

-- 为类型字段创建索引
CREATE INDEX IF NOT EXISTS idx_books_type 
ON public.books USING btree (type);

-- 为新增字段创建索引
CREATE INDEX IF NOT EXISTS idx_books_last_accessed_at 
ON public.books USING btree (last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_type_status 
ON public.books USING btree (type, status);

CREATE INDEX IF NOT EXISTS idx_books_type_user_id 
ON public.books USING btree (type, user_id);

-- ========================================
-- 3. 创建函数来更新 books 的 note_count（章节计数）
-- ========================================

-- 创建或替换更新章节计数的函数
CREATE OR REPLACE FUNCTION update_book_note_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 当插入、删除或更新章节时更新对应书籍的章节计数
  IF TG_OP = 'INSERT' THEN
    -- 新增章节，对应书籍计数+1
    UPDATE public.books 
    SET note_count = (
      SELECT COUNT(*) 
      FROM public.chapters 
      WHERE book_id = NEW.book_id
    )
    WHERE id = NEW.book_id;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- 删除章节，对应书籍计数-1
    UPDATE public.books 
    SET note_count = (
      SELECT COUNT(*) 
      FROM public.chapters 
      WHERE book_id = OLD.book_id
    )
    WHERE id = OLD.book_id;
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- 如果章节的book_id发生变化（章节移动到不同书籍）
    IF OLD.book_id != NEW.book_id THEN
      -- 更新原书籍的章节计数
      UPDATE public.books 
      SET note_count = (
        SELECT COUNT(*) 
        FROM public.chapters 
        WHERE book_id = OLD.book_id
      )
      WHERE id = OLD.book_id;
      
      -- 更新新书籍的章节计数
      UPDATE public.books 
      SET note_count = (
        SELECT COUNT(*) 
        FROM public.chapters 
        WHERE book_id = NEW.book_id
      )
      WHERE id = NEW.book_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（支持章节在书籍间移动）
DROP TRIGGER IF EXISTS trigger_update_book_note_count ON public.chapters;
CREATE TRIGGER trigger_update_book_note_count
  AFTER INSERT OR DELETE OR UPDATE 
  ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_book_note_count();

-- ========================================
-- 4. 初始化现有数据的章节计数
-- ========================================

-- 更新所有现有书籍的章节计数
UPDATE public.books 
SET note_count = (
  SELECT COUNT(*) 
  FROM public.chapters 
  WHERE chapters.book_id = books.id
);

-- ========================================
-- 完成
-- ========================================

SELECT 'books 表已成功添加笔记本支持字段和触发器，支持章节在书籍间移动' AS result; 