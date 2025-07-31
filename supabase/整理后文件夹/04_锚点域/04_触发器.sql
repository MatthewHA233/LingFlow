-- =============================================
-- 锚点域模块 - 触发器定义
-- =============================================

-- meaning_block_contexts 表触发器
CREATE TRIGGER set_meaning_block_contexts_user_id 
    BEFORE INSERT ON meaning_block_contexts 
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();

CREATE TRIGGER trigger_update_context_stats
    AFTER INSERT OR DELETE ON meaning_block_contexts 
    FOR EACH ROW
    EXECUTE FUNCTION update_context_stats();

-- 注：触发器引用的函数需要在03_函数.sql中定义