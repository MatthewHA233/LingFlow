-- 05_音频处理模块 - 函数定义

-- 批量插入对齐数据
CREATE OR REPLACE FUNCTION public.batch_insert_alignment_data(alignment_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  speech_id_text text;
  speech_id_uuid uuid;
  block_count integer := 0;
  sentence_count integer := 0;
  word_count integer := 0;
  block_data jsonb;
  sentence_data jsonb;
  sentence_id uuid;
  block_ids text[] := '{}';
  sentence_ids uuid[] := '{}';
  start_time timestamp := clock_timestamp();
  processing_time interval;
BEGIN
  -- 提取基本信息并转换类型
  speech_id_text := alignment_data->>'speechId';
  
  IF speech_id_text IS NULL THEN
    RAISE EXCEPTION '缺少speechId参数';
  END IF;
  
  -- 将字符串转换为UUID
  BEGIN
    speech_id_uuid := speech_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'speechId格式无效，必须是有效的UUID: %', speech_id_text;
  END;
  
  RAISE NOTICE '开始批量插入对齐数据 - speechId: %', speech_id_uuid;
  
  -- 开始事务处理
  BEGIN
    -- 1. 遍历所有语境块
    FOR block_data IN SELECT * FROM jsonb_array_elements(alignment_data->'blocks')
    LOOP
      DECLARE
        block_id text;
        block_sentence_ids uuid[] := '{}';
        block_begin_time integer;
        block_end_time integer;
        new_content text := '';
      BEGIN
        block_id := block_data->>'blockId';
        block_count := block_count + 1;
        block_ids := array_append(block_ids, block_id);
        
        RAISE NOTICE '处理语境块: % (第 % 个)', block_id, block_count;
        
        -- 2. 遍历该块的所有句子
        FOR sentence_data IN SELECT * FROM jsonb_array_elements(block_data->'sentences')
        LOOP
          DECLARE
            text_content text;
            begin_time integer;
            end_time integer;
            sentence_order integer;
            order_in_block integer;
            words_array jsonb;
          BEGIN
            text_content := sentence_data->>'textContent';
            begin_time := (sentence_data->>'beginTime')::integer;
            end_time := (sentence_data->>'endTime')::integer;
            sentence_order := (sentence_data->>'order')::integer;
            order_in_block := (sentence_data->>'orderInBlock')::integer;
            words_array := sentence_data->'words';
            
            -- 插入句子记录，使用正确的UUID类型
            INSERT INTO sentences (
              speech_id,
              text_content,
              begin_time,
              end_time,
              "order"
            ) VALUES (
              speech_id_uuid,  -- 使用转换后的UUID
              text_content,
              begin_time,
              end_time,
              sentence_order
            ) RETURNING id INTO sentence_id;
            
            sentence_count := sentence_count + 1;
            sentence_ids := array_append(sentence_ids, sentence_id);
            block_sentence_ids := array_append(block_sentence_ids, sentence_id);
            
            -- 构建新的内容格式
            new_content := new_content || '[[' || sentence_id::text || ']]';
            
            -- 更新块的时间范围
            IF block_begin_time IS NULL OR begin_time < block_begin_time THEN
              block_begin_time := begin_time;
            END IF;
            IF block_end_time IS NULL OR end_time > block_end_time THEN
              block_end_time := end_time;
            END IF;
            
            -- 3. 批量插入该句子的所有单词
            IF jsonb_array_length(words_array) > 0 THEN
              INSERT INTO words (sentence_id, word, begin_time, end_time)
              SELECT 
                sentence_id,
                word_item->>'word',
                (word_item->>'beginTime')::integer,
                (word_item->>'endTime')::integer
              FROM jsonb_array_elements(words_array) AS word_item;
              
              word_count := word_count + jsonb_array_length(words_array);
            END IF;
            
            -- 4. 插入block_sentences关联
            INSERT INTO block_sentences (block_id, sentence_id, order_index)
            VALUES (block_id::uuid, sentence_id, order_in_block);
            
          END;
        END LOOP;
        
        -- 5. 更新语境块信息（先备份content到original_content）
        UPDATE context_blocks 
        SET 
          original_content = COALESCE(content, ''),  -- 备份当前content到original_content
          speech_id = speech_id_uuid,  -- 使用转换后的UUID
          begin_time = block_begin_time,
          end_time = block_end_time,
          content = new_content,
          block_type = 'audio_aligned',
          updated_at = now()
        WHERE id = block_id::uuid;
        
        RAISE NOTICE '完成语境块: %, 句子数: %', block_id, array_length(block_sentence_ids, 1);
        
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '处理语境块 % 时发生错误: %', block_id, SQLERRM;
      END;
    END LOOP;
    
    processing_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '批量插入完成 - 语境块: %, 句子: %, 单词: %, 耗时: %', 
      block_count, sentence_count, word_count, processing_time;
    
    -- 返回处理结果
    RETURN jsonb_build_object(
      'success', true,
      'speech_id', speech_id_uuid,
      'blocks_processed', block_count,
      'sentences_created', sentence_count,
      'words_created', word_count,
      'block_ids', block_ids,
      'sentence_ids', sentence_ids,
      'processing_time_ms', EXTRACT(EPOCH FROM processing_time) * 1000,
      'completed_at', clock_timestamp()
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- 回滚事务
    RAISE EXCEPTION '批量插入失败: %', SQLERRM;
  END;
END;
$function$

-- 删除语音相关数据
CREATE OR REPLACE FUNCTION public.delete_speech_related_data()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- 获取时间范围内的语音结果
CREATE OR REPLACE FUNCTION public.get_speech_results_in_timerange(p_user_id uuid, p_start_time timestamp without time zone, p_end_time timestamp without time zone)
 RETURNS TABLE(speech_id uuid, task_id text, audio_url text, sentence_count bigint, word_count bigint, avg_speech_rate numeric, avg_emotion_value numeric)
 LANGUAGE plpgsql
AS $function$
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
$function$