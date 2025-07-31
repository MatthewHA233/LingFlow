-- =============================================
-- 音频处理模块 - 触发器定义
-- =============================================

-- speech_results 表触发器
CREATE TRIGGER update_speech_results_updated_at 
    BEFORE UPDATE ON speech_results 
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER delete_speech_results_cascade 
    BEFORE DELETE ON speech_results 
    FOR EACH ROW
    EXECUTE FUNCTION delete_speech_related_data();

-- 注：触发器引用的函数需要在03_函数.sql中定义