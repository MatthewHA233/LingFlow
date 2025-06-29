/*
修复触发器删除错误的SQL脚本

操作说明：
1. 恢复误删的 after_chapter_delete 触发器
2. 删除正确的 after_block_delete 触发器和相关函数
3. 确保章节删除功能正常工作
*/

-- 1. 恢复 after_chapter_delete 触发器
-- 首先确保 clean_content_parents_after_chapter_delete 函数存在
CREATE OR REPLACE FUNCTION clean_content_parents_after_chapter_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- 删除章节后清理关联的content_parents记录
    DELETE FROM content_parents 
    WHERE id = OLD.parent_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 重新创建 after_chapter_delete 触发器
CREATE TRIGGER after_chapter_delete
    AFTER DELETE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION clean_content_parents_after_chapter_delete();

-- 2. 删除有问题的 after_block_delete 触发器
DROP TRIGGER IF EXISTS after_block_delete ON context_blocks;

-- 3. 删除有问题的函数
DROP FUNCTION IF EXISTS clean_content_parents_after_block_delete();

-- 添加注释说明
COMMENT ON TRIGGER after_chapter_delete ON chapters IS '删除章节后自动清理关联的content_parents记录';
COMMENT ON FUNCTION clean_content_parents_after_chapter_delete() IS '清理删除章节后孤立的content_parents记录';

-- 验证操作完成
SELECT 'after_chapter_delete 触发器已恢复' as status
UNION ALL
SELECT 'after_block_delete 触发器已删除' as status
UNION ALL
SELECT 'clean_content_parents_after_block_delete 函数已删除' as status; 