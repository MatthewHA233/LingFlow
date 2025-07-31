-- 04_锚点域模块 - 函数定义

-- 计算自然衰减
CREATE OR REPLACE FUNCTION public.calculate_natural_decay(p_meaning_block_id uuid)
 RETURNS double precision
 LANGUAGE plpgsql
AS $function$
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
$function$

-- 提取中文含义
CREATE OR REPLACE FUNCTION public.extract_chinese_meaning(meaning_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  -- 提取中文含义部分 (音标后的部分)
  RETURN trim(substring(meaning_text FROM '/[^/]+/\s*(.*)'));
END;
$function$

-- 提取音标
CREATE OR REPLACE FUNCTION public.extract_phonetic(meaning_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  -- 提取音标部分 (假设格式为 /音标/ 含义)
  RETURN substring(meaning_text FROM '/([^/]+)/');
END;
$function$

-- 更新锚点统计
CREATE OR REPLACE FUNCTION public.update_anchor_stats(p_anchor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_contexts INTEGER;
  v_reviewed_contexts INTEGER;
  v_avg_proficiency DOUBLE PRECISION;
BEGIN
  -- 计算该锚点的相关统计数据
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN mb.last_reviewed_at IS NOT NULL THEN 1 END),
    AVG(mb.current_proficiency)
  INTO v_total_contexts, v_reviewed_contexts, v_avg_proficiency
  FROM meaning_blocks mb
  JOIN meaning_block_contexts mbc ON mbc.meaning_block_id = mb.id
  WHERE mbc.anchor_id = p_anchor_id;
  
  -- 更新锚点的统计信息
  UPDATE anchors
  SET 
    total_contexts = v_total_contexts,
    reviewed_contexts = v_reviewed_contexts,
    average_proficiency = COALESCE(v_avg_proficiency, 0.0),
    updated_at = NOW()
  WHERE id = p_anchor_id;
END;
$function$

-- 更新上下文统计
CREATE OR REPLACE FUNCTION public.update_context_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 更新上下文数量
    UPDATE anchors 
    SET total_contexts = (
      SELECT COUNT(DISTINCT mbc.context_block_id)
      FROM meaning_blocks mb
      JOIN meaning_block_contexts mbc ON mb.id = mbc.meaning_block_id
      WHERE mb.anchor_id = (SELECT anchor_id FROM meaning_blocks WHERE id = NEW.meaning_block_id)
    ),
    updated_at = NOW()
    WHERE id = (SELECT anchor_id FROM meaning_blocks WHERE id = NEW.meaning_block_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    -- 更新上下文数量
    UPDATE anchors 
    SET total_contexts = (
      SELECT COUNT(DISTINCT mbc.context_block_id)
      FROM meaning_blocks mb
      JOIN meaning_block_contexts mbc ON mb.id = mbc.meaning_block_id
      WHERE mb.anchor_id = (SELECT anchor_id FROM meaning_blocks WHERE id = OLD.meaning_block_id)
    ),
    updated_at = NOW()
    WHERE id = (SELECT anchor_id FROM meaning_blocks WHERE id = OLD.meaning_block_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$

-- 通过复习更新熟练度
CREATE OR REPLACE FUNCTION public.update_proficiency_with_review(p_meaning_block_id uuid, p_quality_score integer, p_review_duration_seconds integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$