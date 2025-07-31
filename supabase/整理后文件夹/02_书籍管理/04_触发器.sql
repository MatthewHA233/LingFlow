-- =============================================
-- 书籍管理模块 - 触发器定义
-- =============================================

-- chapters 表触发器
CREATE TRIGGER after_chapter_delete
    AFTER DELETE ON chapters 
    FOR EACH ROW
    EXECUTE FUNCTION clean_content_parents_after_chapter_delete();

CREATE TRIGGER trigger_update_book_note_count
    AFTER INSERT OR UPDATE OR DELETE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_book_note_count();

-- reading_progress 表触发器
CREATE TRIGGER update_reading_progress_updated_at 
    BEFORE UPDATE ON reading_progress 
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 注：这些触发器函数需要在03_函数.sql中定义