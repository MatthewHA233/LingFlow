/*
函数名称：获取时间范围内的语音识别分析结果
功能描述：根据用户ID和时间范围，查询并统计语音识别的详细分析数据
参数说明：
- p_user_id: 用户ID
- p_start_time: 开始时间
- p_end_time: 结束时间
返回数据：
- speech_id: 语音记录ID
- task_id: 任务ID
- audio_url: 音频文件URL
- sentence_count: 句子数量
- word_count: 单词数量
- avg_speech_rate: 平均语速
- avg_emotion_value: 平均情绪值
*/

-- 获取指定时间范围内的语音识别结果
CREATE OR REPLACE FUNCTION get_speech_results_in_timerange(
    p_user_id UUID,
    p_start_time TIMESTAMP,
    p_end_time TIMESTAMP
)
RETURNS TABLE (
    speech_id UUID,
    task_id TEXT,
    audio_url TEXT,
    sentence_count BIGINT,
    word_count BIGINT,
    avg_speech_rate NUMERIC,
    avg_emotion_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.task_id,
        sr.audio_url,
        COUNT(DISTINCT s.id) as sentence_count,
        COUNT(DISTINCT w.id) as word_count,
        AVG(s.speech_rate)::NUMERIC as avg_speech_rate,
        AVG(s.emotion_value)::NUMERIC as avg_emotion_value
    FROM speech_results sr
    LEFT JOIN sentences s ON s.speech_id = sr.id
    LEFT JOIN words w ON w.sentence_id = s.id
    WHERE sr.user_id = p_user_id
    AND sr.created_at BETWEEN p_start_time AND p_end_time
    GROUP BY sr.id, sr.task_id, sr.audio_url;
END;
$$ LANGUAGE plpgsql;