-- 先删除旧函数
DROP FUNCTION IF EXISTS update_block_order(uuid[], integer[], uuid);

-- 创建更新块排序的存储过程
CREATE OR REPLACE FUNCTION update_block_order(
  block_ids uuid[],
  new_order_indices int[],
  p_parent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_block_count int;
  v_updated_count int := 0;
  v_result jsonb;
  v_max_order int;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 记录输入参数
  RAISE NOTICE 'update_block_order called with: user_id=%, parent_id=%, block_count=%', 
    v_user_id, p_parent_id, array_length(block_ids, 1);

  -- 验证输入数组长度相等
  IF array_length(block_ids, 1) != array_length(new_order_indices, 1) THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', '数组长度不匹配',
      'block_ids_length', array_length(block_ids, 1),
      'indices_length', array_length(new_order_indices, 1)
    );
    RETURN v_result;
  END IF;

  -- 验证用户权限
  IF NOT EXISTS (
    SELECT 1 FROM content_parents
    WHERE id = p_parent_id AND user_id = v_user_id
  ) THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', '权限验证失败',
      'user_id', v_user_id,
      'parent_id', p_parent_id
    );
    RETURN v_result;
  END IF;

  -- 验证所有块是否存在且属于同一个parent
  SELECT COUNT(*) INTO v_block_count
  FROM context_blocks
  WHERE id = ANY(block_ids) AND parent_id = p_parent_id;

  IF v_block_count != array_length(block_ids, 1) THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', '部分块不存在或不属于指定的parent',
      'expected_count', array_length(block_ids, 1),
      'actual_count', v_block_count
    );
    RETURN v_result;
  END IF;

  -- 获取最大的order_index值
  SELECT COALESCE(MAX(order_index), -1) + array_length(block_ids, 1) INTO v_max_order
  FROM context_blocks
  WHERE parent_id = p_parent_id;

  -- 首先将要更新的块的order_index设置为临时大值，避免唯一约束冲突
  UPDATE context_blocks
  SET order_index = v_max_order + order_index
  WHERE id = ANY(block_ids);

  -- 然后设置最终的order_index值
  FOR i IN 1..array_length(block_ids, 1)
  LOOP
    UPDATE context_blocks
    SET order_index = new_order_indices[i]
    WHERE id = block_ids[i]
    AND parent_id = p_parent_id
    RETURNING 1 INTO v_updated_count;
    
    RAISE NOTICE 'Updated block: id=%, new_index=%, success=%',
      block_ids[i], new_order_indices[i], v_updated_count > 0;
  END LOOP;

  -- 返回成功结果
  v_result := jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'total_blocks', array_length(block_ids, 1)
  );
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- 捕获任何其他错误
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
  RETURN v_result;
END;
$$;