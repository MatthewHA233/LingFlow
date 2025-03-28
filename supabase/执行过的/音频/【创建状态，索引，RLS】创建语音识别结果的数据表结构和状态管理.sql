/*
文件说明：创建语音识别结果的数据表结构和状态管理

主要功能：
1. 语音识别状态管理
   - 状态枚举：idle（空闲）、uploading（上传中）、processing（处理中）、
              completed（完成）、error（错误）、uploaded（已上传）
   - 错误信息：记录处理过程中的错误信息
   - 状态追踪：自动更新时间戳

2. 性能优化
   - 创建状态索引：优化按状态查询
   - 创建任务ID索引：优化任务关联查询
   - 自动更新时间戳触发器

3. 行级安全策略(RLS)
   - speech_results表：用户只能访问自己的语音识别结果
   - sentences表：用户只能访问自己的语音识别句子
   - words表：用户只能访问自己的语音识别词

特点：
- 完整的状态流转管理
- 错误处理机制
- 性能优化设计
- 严格的访问控制

使用场景：
- 语音转写系统
- 音频处理追踪
- 语音识别结果管理
*/

-- 1. 首先在 speech_results 表中添加状态和错误信息字段：
ALTER TABLE speech_results 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle' 
CHECK (status IN ('idle', 'uploading', 'processing', 'completed', 'error', 'uploaded'));

ALTER TABLE speech_results 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. 确保 speech_results 表中的 updated_at 字段会自动更新：
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_speech_results_updated_at ON speech_results;

CREATE TRIGGER update_speech_results_updated_at
    BEFORE UPDATE ON speech_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3.添加索引以优化查询性能：
CREATE INDEX IF NOT EXISTS idx_speech_results_status ON speech_results(status);
CREATE INDEX IF NOT EXISTS idx_speech_results_task_id ON speech_results(task_id);

-- 4.更新 RLS 策略以确保用户只能访问自己的数据：
DROP POLICY IF EXISTS "用户访问自己的语音识别结果" ON speech_results;
CREATE POLICY "用户访问自己的语音识别结果"
ON speech_results FOR ALL
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户访问自己的语音识别句子" ON sentences;
CREATE POLICY "用户访问自己的语音识别句子"
ON sentences FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM speech_results
    WHERE speech_results.id = sentences.speech_id
    AND speech_results.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "用户访问自己的语音识别词" ON words;
CREATE POLICY "用户访问自己的语音识别词"
ON words FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sentences
    JOIN speech_results ON speech_results.id = sentences.speech_id
    WHERE sentences.id = words.sentence_id
    AND speech_results.user_id = auth.uid()
  )
);