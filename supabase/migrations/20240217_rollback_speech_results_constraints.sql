-- 删除触发器
DROP TRIGGER IF EXISTS trigger_check_completed_speech_results ON speech_results;

-- 删除触发器函数
DROP FUNCTION IF EXISTS check_completed_speech_results();

-- 删除索引
DROP INDEX IF EXISTS idx_speech_results_book_id; 