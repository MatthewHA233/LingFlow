-- 基于艾宾浩斯遗忘曲线和SuperMemo算法的熟练度更新函数
CREATE OR REPLACE FUNCTION update_proficiency_with_review(
  p_meaning_block_id UUID,
  p_quality_score INTEGER, -- 0-5的评分
  p_review_duration_seconds INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current_proficiency FLOAT;
  v_easiness_factor FLOAT;
  v_interval_days INTEGER;
  v_review_count INTEGER;
  v_new_proficiency FLOAT;
  v_new_easiness_factor FLOAT;
  v_new_interval_days INTEGER;
  v_next_review_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 获取当前状态
  SELECT current_proficiency, easiness_factor, interval_days, review_count
  INTO v_current_proficiency, v_easiness_factor, v_interval_days, v_review_count
  FROM meaning_blocks
  WHERE id = p_meaning_block_id;
  
  -- 记录复习前状态
  INSERT INTO proficiency_records (meaning_block_id, proficiency_before, proficiency_after, quality_score, review_duration_seconds)
  VALUES (p_meaning_block_id, v_current_proficiency, v_current_proficiency, p_quality_score, p_review_duration_seconds);
  
  -- 计算新的难度系数 (SuperMemo算法)
  v_new_easiness_factor := v_easiness_factor + (0.1 - (5 - p_quality_score) * (0.08 + (5 - p_quality_score) * 0.02));
  v_new_easiness_factor := GREATEST(v_new_easiness_factor, 1.3); -- 最小值限制
  
  -- 计算新的熟练度
  IF p_quality_score >= 3 THEN
    -- 回忆成功
    v_new_proficiency := LEAST(v_current_proficiency + (p_quality_score - 2) * 0.2, 1.0);
    
    -- 计算新的复习间隔
    IF v_review_count = 0 THEN
      v_new_interval_days := 1;
    ELSIF v_review_count = 1 THEN
      v_new_interval_days := 6;
    ELSE
      v_new_interval_days := CEIL(v_interval_days * v_new_easiness_factor);
    END IF;
  ELSE
    -- 回忆失败
    v_new_proficiency := GREATEST(v_current_proficiency - (3 - p_quality_score) * 0.3, 0.0);
    v_new_interval_days := 1; -- 重新开始
  END IF;
  
  -- 计算下次复习时间
  v_next_review_date := NOW() + INTERVAL '1 day' * v_new_interval_days;
  
  -- 更新含义块状态
  UPDATE meaning_blocks
  SET 
    current_proficiency = v_new_proficiency,
    easiness_factor = v_new_easiness_factor,
    interval_days = v_new_interval_days,
    review_count = v_review_count + 1,
    next_review_date = v_next_review_date,
    updated_at = NOW()
  WHERE id = p_meaning_block_id;
  
  -- 更新熟练度记录
  UPDATE proficiency_records
  SET proficiency_after = v_new_proficiency
  WHERE meaning_block_id = p_meaning_block_id
    AND reviewed_at = (SELECT MAX(reviewed_at) FROM proficiency_records WHERE meaning_block_id = p_meaning_block_id);
END;
$$ LANGUAGE plpgsql;