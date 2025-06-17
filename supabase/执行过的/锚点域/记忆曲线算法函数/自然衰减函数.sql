-- 基于时间的自然衰减函数
CREATE OR REPLACE FUNCTION calculate_natural_decay(
  p_meaning_block_id UUID
) RETURNS FLOAT AS $$
DECLARE
  v_last_reviewed TIMESTAMP WITH TIME ZONE;
  v_current_proficiency FLOAT;
  v_easiness_factor FLOAT;
  v_days_since_review INTEGER;
  v_decay_rate FLOAT;
  v_decayed_proficiency FLOAT;
BEGIN
  -- 获取最后复习时间和当前熟练度
  SELECT 
    COALESCE(last_reviewed_at, created_at),
    current_proficiency,
    easiness_factor
  INTO v_last_reviewed, v_current_proficiency, v_easiness_factor
  FROM meaning_blocks
  WHERE id = p_meaning_block_id;
  
  -- 计算天数差
  v_days_since_review := EXTRACT(EPOCH FROM (NOW() - v_last_reviewed)) / 86400;
  
  -- 基于艾宾浩斯曲线的衰减率
  -- R = e^(-t/S) 其中 S 是强度因子，与难度系数相关
  v_decay_rate := EXP(-v_days_since_review / (v_easiness_factor * 10));
  
  -- 计算衰减后的熟练度
  v_decayed_proficiency := v_current_proficiency * v_decay_rate;
  
  RETURN GREATEST(v_decayed_proficiency, 0.0);
END;
$$ LANGUAGE plpgsql;