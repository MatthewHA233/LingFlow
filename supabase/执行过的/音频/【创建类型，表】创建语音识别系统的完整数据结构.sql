/*
文件说明：创建语音识别系统的完整数据结构

主要表结构：
1. speech_results（语音识别结果主表）
   - 基本信息：任务ID、音频URL
   - 用户关联：与auth.users表关联
   - 时间追踪：创建和更新时间

2. sentences（句子表）
   - 时间标记：开始时间、结束时间
   - 内容分析：文本内容、语速、情绪值
   - 关联语音：与speech_results表关联

3. words（词表）
   - 时间标记：词级别的开始和结束时间
   - 内容存储：单词文本
   - 关联句子：与sentences表关联

核心功能：
- 完整的语音识别结果存储
- 多层级数据结构（语音-句子-词）
- 丰富的分析指标（语速、情绪等）
- 精确的时间对齐信息

索引优化：
- 用户ID索引：优化用户查询
- 时间索引：优化时间范围查询
- 文本索引：支持词级别搜索

安全策略：
- 用户数据隔离
- 层级访问控制
- 级联删除保护

使用场景：
- 语音转写应用
- 语音分析系统
- 字幕生成工具
*/

-- 1. 创建基础表
CREATE TABLE speech_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sentences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  speech_id UUID REFERENCES speech_results(id),
  begin_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  speech_rate INTEGER,
  emotion_value FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sentence_id UUID REFERENCES sentences(id),
  word TEXT NOT NULL,
  begin_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX idx_speech_results_user_id ON speech_results(user_id);
CREATE INDEX idx_speech_results_task_id ON speech_results(task_id);
CREATE INDEX idx_speech_results_created_at ON speech_results(created_at);

CREATE INDEX idx_sentences_speech_id ON sentences(speech_id);
CREATE INDEX idx_sentences_begin_time ON sentences(begin_time);
CREATE INDEX idx_sentences_end_time ON sentences(end_time);

CREATE INDEX idx_words_sentence_id ON words(sentence_id);
CREATE INDEX idx_words_begin_time ON words(begin_time);
CREATE INDEX idx_words_end_time ON words(end_time);
CREATE INDEX idx_words_word ON words(word);

-- 3. 设置行级安全策略
ALTER TABLE speech_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的语音识别结果
CREATE POLICY "用户访问自己的语音识别结果"
ON speech_results FOR ALL
USING (auth.uid() = user_id);

-- 用户可以访问与自己的语音识别相关的句子
CREATE POLICY "用户访问自己的语音识别句子"
ON sentences FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM speech_results
    WHERE speech_results.id = sentences.speech_id
    AND speech_results.user_id = auth.uid()
  )
);

-- 用户可以访问与自己的语音识别相关的词
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

-- 4. 创建实用视图
-- 语音文本对齐视图（用于文本替换）
CREATE VIEW text_alignment AS
SELECT 
    sr.id as speech_id,
    sr.audio_url,
    sr.user_id,
    s.id as sentence_id,
    s.text_content as speech_text,
    s.begin_time as sentence_begin,
    s.end_time as sentence_end,
    s.speech_rate,
    s.emotion_value,
    json_agg(
        json_build_object(
            'word', w.word,
            'begin_time', w.begin_time,
            'end_time', w.end_time
        ) ORDER BY w.begin_time
    ) as words
FROM speech_results sr
LEFT JOIN sentences s ON s.speech_id = sr.id
LEFT JOIN words w ON w.sentence_id = s.id
GROUP BY 
    sr.id, sr.audio_url, sr.user_id,
    s.id, s.text_content, s.begin_time, s.end_time,
    s.speech_rate, s.emotion_value;

-- 5. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_speech_results_updated_at
    BEFORE UPDATE ON speech_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 创建级联删除触发器
CREATE OR REPLACE FUNCTION delete_speech_related_data()
RETURNS TRIGGER AS $$
BEGIN
    -- 删除相关的词
    DELETE FROM words
    WHERE sentence_id IN (
        SELECT id FROM sentences WHERE speech_id = OLD.id
    );
    
    -- 删除相关的句子
    DELETE FROM sentences WHERE speech_id = OLD.id;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

CREATE TRIGGER delete_speech_results_cascade
    BEFORE DELETE ON speech_results
    FOR EACH ROW
    EXECUTE FUNCTION delete_speech_related_data();