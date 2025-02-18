-- 检查特定 speech_id 的所有句子
SELECT 
  s.*,
  (SELECT COUNT(*) FROM words w WHERE w.sentence_id = s.id) as word_count
FROM sentences s
WHERE s.speech_id = 'your_speech_id'
ORDER BY s.order ASC;

-- 检查句子的单词
SELECT w.*
FROM words w
JOIN sentences s ON w.sentence_id = s.id
WHERE s.speech_id = 'your_speech_id'
ORDER BY w.begin_time ASC; 