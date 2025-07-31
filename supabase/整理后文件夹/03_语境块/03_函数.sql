-- 03_语境块模块 - 函数定义

-- 完成块转换
CREATE OR REPLACE FUNCTION public.complete_block_conversion(p_conversion_id uuid, p_success boolean, p_error_message text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_block_id UUID;
  v_to_type block_type;
BEGIN
  -- 获取转换信息
  SELECT block_id, to_type INTO v_block_id, v_to_type
  FROM block_conversions
  WHERE id = p_conversion_id;
  
  -- 更新转换记录
  UPDATE block_conversions
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
      progress = CASE WHEN p_success THEN 100 ELSE progress END,
      error_message = p_error_message,
      completed_at = NOW()
  WHERE id = p_conversion_id;
  
  -- 更新块状态
  UPDATE context_blocks
  SET conversion_status = CASE 
        WHEN p_success THEN 'converted'
        ELSE 'failed'
      END,
      block_type = CASE 
        WHEN p_success THEN v_to_type
        ELSE block_type
      END
  WHERE id = v_block_id;
END;
$function$

-- 删除语境块
CREATE OR REPLACE FUNCTION public.delete_context_block(p_block_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_parent_id UUID;
  v_order_index INTEGER;
  v_user_id UUID;
  v_affected_rows INTEGER := 0;
  v_result jsonb;
  v_constraint_name TEXT;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 验证用户权限并获取块信息
  SELECT cb.parent_id, cb.order_index
  INTO v_parent_id, v_order_index
  FROM context_blocks cb
  JOIN content_parents cp ON cp.id = cb.parent_id
  WHERE cb.id = p_block_id AND cp.user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '权限不足或块不存在',
      'error_code', 'PERMISSION_DENIED'
    );
  END IF;
  
  -- 查找约束名称
  SELECT conname INTO v_constraint_name
  FROM pg_constraint 
  WHERE conrelid = 'context_blocks'::regclass 
    AND contype = 'u'
    AND conkey = (SELECT array_agg(attnum ORDER BY attnum) 
                  FROM pg_attribute 
                  WHERE attrelid = 'context_blocks'::regclass 
                    AND attname IN ('parent_id', 'order_index'));
  
  BEGIN
    -- 设置延迟约束
    IF v_constraint_name IS NOT NULL THEN
      BEGIN
        EXECUTE format('SET CONSTRAINTS %I DEFERRED', v_constraint_name);
      EXCEPTION WHEN OTHERS THEN
        NULL; -- 忽略错误
      END;
    END IF;
    
    -- 删除块
    DELETE FROM context_blocks WHERE id = p_block_id;
    
    -- 重新排序后续块
    UPDATE context_blocks
    SET order_index = order_index - 1,
        updated_at = NOW()
    WHERE parent_id = v_parent_id AND order_index > v_order_index;
    
    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    
    v_result := jsonb_build_object(
      'success', true,
      'deleted_block_id', p_block_id,
      'reordered_blocks', v_affected_rows,
      'message', '语境块删除成功'
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', 'DELETE_FAILED',
      'sqlstate', SQLSTATE
    );
    
    RETURN v_result;
  END;
END;
$function$

-- 插入语境块
CREATE OR REPLACE FUNCTION public.insert_context_block(p_parent_id uuid, p_block_type block_type, p_content text, p_insert_after_order integer DEFAULT NULL::integer, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_new_order INTEGER;
  v_new_block_id UUID;
  v_user_id UUID;
  v_result jsonb;
  v_constraint_name TEXT;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 验证用户权限
  IF NOT EXISTS (
    SELECT 1 FROM content_parents
    WHERE id = p_parent_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '权限不足或父级不存在',
      'error_code', 'PERMISSION_DENIED'
    );
  END IF;
  
  -- 查找约束名称
  SELECT conname INTO v_constraint_name
  FROM pg_constraint 
  WHERE conrelid = 'context_blocks'::regclass 
    AND contype = 'u'
    AND conkey = (SELECT array_agg(attnum ORDER BY attnum) 
                  FROM pg_attribute 
                  WHERE attrelid = 'context_blocks'::regclass 
                    AND attname IN ('parent_id', 'order_index'));
  
  -- 确定新块的排序位置
  IF p_insert_after_order IS NULL THEN
    -- 插入到最后
    SELECT COALESCE(MAX(order_index), -1) + 1 INTO v_new_order
    FROM context_blocks
    WHERE parent_id = p_parent_id;
  ELSE
    -- 插入到指定位置之后
    v_new_order := p_insert_after_order + 1;
    
    -- 设置延迟约束
    IF v_constraint_name IS NOT NULL THEN
      BEGIN
        EXECUTE format('SET CONSTRAINTS %I DEFERRED', v_constraint_name);
      EXCEPTION WHEN OTHERS THEN
        NULL; -- 忽略错误
      END;
    END IF;
    
    -- 更新后续块的排序
    UPDATE context_blocks
    SET order_index = order_index + 1,
        updated_at = NOW()
    WHERE parent_id = p_parent_id AND order_index >= v_new_order;
  END IF;
  
  -- 创建新块
  INSERT INTO context_blocks (
    parent_id,
    block_type,
    content,
    order_index,
    metadata
  )
  VALUES (
    p_parent_id,
    p_block_type,
    COALESCE(TRIM(p_content), ''),
    v_new_order,
    p_metadata
  )
  RETURNING id INTO v_new_block_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'block_id', v_new_block_id,
    'order_index', v_new_order,
    'message', '语境块创建成功'
  );
  
  RETURN v_result;
END;
$function$

-- 合并语境块
CREATE OR REPLACE FUNCTION public.merge_context_blocks(p_current_block_id uuid, p_target_block_id uuid, p_merged_content text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_current_block RECORD;
  v_target_block RECORD;
  v_updated_count INTEGER := 0;
  v_result JSON;
  v_user_id UUID;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 开始事务并设置延迟约束
  SET CONSTRAINTS ALL DEFERRED;
  
  -- 记录操作开始
  RAISE NOTICE '🔄 开始合并块操作: current=%, target=%, user=%', 
    p_current_block_id, p_target_block_id, v_user_id;
  
  -- 1. 获取当前块信息并验证权限
  SELECT cb.*, cp.user_id as parent_user_id
  INTO v_current_block
  FROM context_blocks cb
  JOIN content_parents cp ON cp.id = cb.parent_id
  WHERE cb.id = p_current_block_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE '❌ 当前块不存在: %', p_current_block_id;
    RETURN json_build_object(
      'success', false,
      'error', '当前块不存在: ' || p_current_block_id
    );
  END IF;
  
  -- 验证当前块的权限
  IF v_current_block.parent_user_id != v_user_id THEN
    RAISE NOTICE '❌ 当前块权限不足: user=%, owner=%', v_user_id, v_current_block.parent_user_id;
    RETURN json_build_object(
      'success', false,
      'error', '权限不足：无法访问当前块'
    );
  END IF;
  
  -- 2. 获取目标块信息并验证权限
  SELECT cb.*, cp.user_id as parent_user_id
  INTO v_target_block
  FROM context_blocks cb
  JOIN content_parents cp ON cp.id = cb.parent_id
  WHERE cb.id = p_target_block_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE '❌ 目标块不存在: %', p_target_block_id;
    RETURN json_build_object(
      'success', false,
      'error', '目标块不存在: ' || p_target_block_id
    );
  END IF;
  
  -- 验证目标块的权限
  IF v_target_block.parent_user_id != v_user_id THEN
    RAISE NOTICE '❌ 目标块权限不足: user=%, owner=%', v_user_id, v_target_block.parent_user_id;
    RETURN json_build_object(
      'success', false,
      'error', '权限不足：无法访问目标块'
    );
  END IF;
  
  -- 3. 验证块可以合并（同一父级，目标块在当前块之前）
  IF v_current_block.parent_id != v_target_block.parent_id THEN
    RAISE NOTICE '❌ 块不在同一父级下: current_parent=%, target_parent=%', 
      v_current_block.parent_id, v_target_block.parent_id;
    RETURN json_build_object(
      'success', false,
      'error', '块不在同一父级下，无法合并'
    );
  END IF;
  
  IF v_target_block.order_index >= v_current_block.order_index THEN
    RAISE NOTICE '❌ 目标块必须在当前块之前: target_order=%, current_order=%', 
      v_target_block.order_index, v_current_block.order_index;
    RETURN json_build_object(
      'success', false,
      'error', '目标块必须在当前块之前'
    );
  END IF;
  
  RAISE NOTICE '✅ 验证通过，开始执行合并操作';
  
  -- 4. 更新目标块内容（只操作 context_blocks 表）
  RAISE NOTICE '📝 更新目标块内容: %', substring(p_merged_content, 1, 50) || '...';
  
  UPDATE context_blocks 
  SET 
    content = p_merged_content,
    updated_at = NOW()
  WHERE id = p_target_block_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ 已更新目标块内容，影响行数: %', v_updated_count;
  
  IF v_updated_count = 0 THEN
    RAISE NOTICE '❌ 更新目标块失败，没有行被更新';
    RETURN json_build_object(
      'success', false,
      'error', '更新目标块失败'
    );
  END IF;
  
  -- 5. 删除当前块（只操作 context_blocks 表）
  RAISE NOTICE '🗑️ 删除当前块: %', p_current_block_id;
  
  DELETE FROM context_blocks 
  WHERE id = p_current_block_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ 已删除当前块，影响行数: %', v_updated_count;
  
  IF v_updated_count = 0 THEN
    RAISE NOTICE '❌ 删除当前块失败，没有行被删除';
    RETURN json_build_object(
      'success', false,
      'error', '删除当前块失败'
    );
  END IF;
  
  -- 6. 调整后续块的排序（只操作 context_blocks 表）
  RAISE NOTICE '📊 调整后续块排序，parent_id=%, order_index > %', 
    v_current_block.parent_id, v_current_block.order_index;
  
  UPDATE context_blocks 
  SET 
    order_index = order_index - 1,
    updated_at = NOW()
  WHERE parent_id = v_current_block.parent_id 
    AND order_index > v_current_block.order_index;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ 已调整后续块排序，影响行数: %', v_updated_count;
  
  -- 7. 构建成功响应
  v_result := json_build_object(
    'success', true,
    'message', '块合并成功',
    'merged_block_id', p_target_block_id,
    'deleted_block_id', p_current_block_id,
    'updated_count', v_updated_count,
    'merged_content', p_merged_content
  );
  
  RAISE NOTICE '🎉 合并操作完成: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '💥 合并操作失败: SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    
    -- 记录详细的错误信息
    RAISE NOTICE '错误详情: current_block=%, target_block=%, user=%', 
      p_current_block_id, p_target_block_id, v_user_id;
    
    RETURN json_build_object(
      'success', false,
      'error', '合并操作失败: ' || SQLERRM,
      'error_code', SQLSTATE,
      'current_block_id', p_current_block_id,
      'target_block_id', p_target_block_id
    );
END;
$function$

-- 分割后重新排序块
CREATE OR REPLACE FUNCTION public.reorder_blocks_after_split(p_parent_id uuid, p_start_order integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- 重新排序指定位置之后的所有块
  WITH ordered_blocks AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) + p_start_order AS new_order
    FROM context_blocks
    WHERE parent_id = p_parent_id AND order_index > p_start_order
  )
  UPDATE context_blocks
  SET order_index = ordered_blocks.new_order,
      updated_at = NOW()
  FROM ordered_blocks
  WHERE context_blocks.id = ordered_blocks.id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$

-- 回退块转换
CREATE OR REPLACE FUNCTION public.revert_block_conversion(p_block_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 更新最新的转换记录为已回退
  UPDATE block_conversions
  SET status = 'reverted',
      completed_at = NOW()
  WHERE block_id = p_block_id
  AND status IN ('completed', 'failed')
  AND id = (
    SELECT id FROM block_conversions
    WHERE block_id = p_block_id
    ORDER BY created_at DESC
    LIMIT 1
  );
  
  -- 恢复块的原始状态
  UPDATE context_blocks
  SET content = original_content,
      conversion_status = 'reverted',
      block_type = (
        SELECT from_type
        FROM block_conversions
        WHERE block_id = p_block_id
        ORDER BY created_at DESC
        LIMIT 1
      )
  WHERE id = p_block_id;
END;
$function$

-- 分割语境块
CREATE OR REPLACE FUNCTION public.split_context_block(p_block_id uuid, p_split_position integer, p_new_content_1 text, p_new_content_2 text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_block RECORD;
  v_user_id UUID;
  v_new_block_id UUID;
  v_affected_rows INTEGER;
  v_result JSON;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 获取原始块信息并验证权限
  SELECT cb.*, cp.user_id as parent_user_id
  INTO v_block
  FROM context_blocks cb
  JOIN content_parents cp ON cp.id = cb.parent_id
  WHERE cb.id = p_block_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '块不存在'
    );
  END IF;
  
  -- 验证权限
  IF v_block.parent_user_id != v_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', '权限不足'
    );
  END IF;
  
  BEGIN
    -- 设置延迟约束
    SET CONSTRAINTS ALL DEFERRED;
    
    -- 更新原始块的内容为第一部分
    UPDATE context_blocks
    SET content = p_new_content_1,
        updated_at = NOW()
    WHERE id = p_block_id;
    
    -- 为后续块腾出空间
    UPDATE context_blocks
    SET order_index = order_index + 1,
        updated_at = NOW()
    WHERE parent_id = v_block.parent_id
      AND order_index > v_block.order_index;
    
    -- 插入新块（第二部分内容）
    INSERT INTO context_blocks (
      parent_id,
      block_type,
      content,
      order_index,
      metadata
    ) VALUES (
      v_block.parent_id,
      v_block.block_type,
      p_new_content_2,
      v_block.order_index + 1,
      v_block.metadata
    )
    RETURNING id INTO v_new_block_id;
    
    v_result := json_build_object(
      'success', true,
      'original_block_id', p_block_id,
      'new_block_id', v_new_block_id,
      'message', '块分割成功'
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', '分割操作失败: ' || SQLERRM
    );
  END;
END;
$function$

-- 开始块转换
CREATE OR REPLACE FUNCTION public.start_block_conversion(p_block_id uuid, p_from_type block_type, p_to_type block_type)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_conversion_id UUID;
BEGIN
  -- 创建转换记录
  INSERT INTO block_conversions (
    block_id,
    from_type,
    to_type,
    status,
    progress,
    created_at
  ) VALUES (
    p_block_id,
    p_from_type,
    p_to_type,
    'processing',
    0,
    NOW()
  )
  RETURNING id INTO v_conversion_id;
  
  -- 更新块的转换状态
  UPDATE context_blocks
  SET conversion_status = 'processing'
  WHERE id = p_block_id;
  
  RETURN v_conversion_id;
END;
$function$

-- 更新块顺序
CREATE OR REPLACE FUNCTION public.update_block_order(p_block_id uuid, p_new_order integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_block RECORD;
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 获取块信息并验证权限
  SELECT cb.*, cp.user_id as parent_user_id
  INTO v_block
  FROM context_blocks cb
  JOIN content_parents cp ON cp.id = cb.parent_id
  WHERE cb.id = p_block_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '块不存在'
    );
  END IF;
  
  -- 验证权限
  IF v_block.parent_user_id != v_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', '权限不足'
    );
  END IF;
  
  BEGIN
    -- 设置延迟约束
    SET CONSTRAINTS ALL DEFERRED;
    
    -- 如果新位置大于当前位置，需要将中间的块向前移动
    IF p_new_order > v_block.order_index THEN
      UPDATE context_blocks
      SET order_index = order_index - 1,
          updated_at = NOW()
      WHERE parent_id = v_block.parent_id
        AND order_index > v_block.order_index
        AND order_index <= p_new_order;
    -- 如果新位置小于当前位置，需要将中间的块向后移动
    ELSIF p_new_order < v_block.order_index THEN
      UPDATE context_blocks
      SET order_index = order_index + 1,
          updated_at = NOW()
      WHERE parent_id = v_block.parent_id
        AND order_index >= p_new_order
        AND order_index < v_block.order_index;
    END IF;
    
    -- 更新目标块的位置
    UPDATE context_blocks
    SET order_index = p_new_order,
        updated_at = NOW()
    WHERE id = p_block_id;
    
    v_result := json_build_object(
      'success', true,
      'block_id', p_block_id,
      'old_order', v_block.order_index,
      'new_order', p_new_order,
      'message', '块顺序更新成功'
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', '更新块顺序失败: ' || SQLERRM
    );
  END;
END;
$function$

-- 更新翻译更新时间
CREATE OR REPLACE FUNCTION public.update_translation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.translation_content IS DISTINCT FROM OLD.translation_content THEN
        NEW.translation_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$function$