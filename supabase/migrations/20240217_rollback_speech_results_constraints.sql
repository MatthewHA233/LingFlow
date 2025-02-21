/*
文件说明：回滚语音识别结果表(speech_results)的相关约束和索引

主要操作：
1. 删除触发器
   - 移除 trigger_check_completed_speech_results 触发器
   - 用途：之前用于检查语音识别结果完整性的触发器

2. 删除触发器函数
   - 移除 check_completed_speech_results() 函数
   - 功能：验证语音识别结果是否完整的检查函数

3. 删除索引
   - 移除 idx_speech_results_book_id 索引
   - 目的：之前用于优化按书籍ID查询的索引

回滚原因：
- 简化数据库结构
- 移除可能影响性能的约束
- 为新的优化方案做准备
*/

-- 删除触发器
DROP TRIGGER IF EXISTS trigger_check_completed_speech_results ON speech_results;

-- 删除触发器函数
DROP FUNCTION IF EXISTS check_completed_speech_results();

-- 删除索引
DROP INDEX IF EXISTS idx_speech_results_book_id; 