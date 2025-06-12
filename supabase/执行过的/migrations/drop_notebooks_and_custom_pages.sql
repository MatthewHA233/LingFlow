-- 删除 notebooks 和 custom_pages 表及其相关组件
-- 此脚本将彻底移除这两个表，请在执行前确保已备份重要数据

-- ========================================
-- 1. 删除 custom_pages 表相关组件
-- ========================================

-- 删除 custom_pages 的触发器
DROP TRIGGER IF EXISTS after_custom_page_delete ON public.custom_pages;
DROP TRIGGER IF EXISTS trigger_update_notebook_note_count ON public.custom_pages;
DROP TRIGGER IF EXISTS update_custom_pages_updated_at ON public.custom_pages;

-- 删除 custom_pages 的索引
DROP INDEX IF EXISTS public.idx_custom_pages_notebook_id;
DROP INDEX IF EXISTS public.idx_custom_pages_parent_id;
DROP INDEX IF EXISTS public.idx_custom_pages_order_index;

-- 删除 custom_pages 表
DROP TABLE IF EXISTS public.custom_pages CASCADE;

-- ========================================
-- 2. 删除 notebooks 表相关组件
-- ========================================

-- 删除 notebooks 的触发器
DROP TRIGGER IF EXISTS update_notebooks_updated_at ON public.notebooks;

-- 删除 notebooks 的索引
DROP INDEX IF EXISTS public.idx_notebooks_user_id;
DROP INDEX IF EXISTS public.idx_notebooks_status;
DROP INDEX IF EXISTS public.idx_notebooks_updated_at;

-- 删除 notebooks 表
DROP TABLE IF EXISTS public.notebooks CASCADE;

-- ========================================
-- 3. 清理相关函数（如果只被这些表使用）
-- ========================================

-- 注意：以下函数可能被其他表使用，请谨慎删除
-- 如果确认这些函数只被删除的表使用，可以取消注释下面的语句

-- DROP FUNCTION IF EXISTS clean_content_parents_after_page_delete() CASCADE;
-- DROP FUNCTION IF EXISTS update_notebook_note_count() CASCADE;

-- ========================================
-- 完成
-- ========================================

-- 提交事务并显示完成信息
SELECT 'notebooks 和 custom_pages 表及其相关组件已成功删除' AS result; 