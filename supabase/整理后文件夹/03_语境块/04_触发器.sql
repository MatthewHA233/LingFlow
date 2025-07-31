-- =============================================
-- 语境块模块 - 触发器定义
-- =============================================

-- content_parents 表触发器
CREATE TRIGGER update_content_parents_updated_at 
    BEFORE UPDATE ON content_parents 
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- context_blocks 表触发器
CREATE TRIGGER update_context_blocks_updated_at 
    BEFORE UPDATE ON context_blocks 
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_blocks_translation_updated_at 
    BEFORE UPDATE ON context_blocks 
    FOR EACH ROW
    EXECUTE FUNCTION update_translation_updated_at();