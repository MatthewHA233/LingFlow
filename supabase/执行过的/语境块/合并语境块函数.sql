/*
文件说明：合并语境块的 Supabase 函数

主要功能：
1. 将当前块的内容合并到目标块
2. 删除当前块
3. 自动调整后续块的排序
4. 保持数据一致性

使用场景：
- 用户在文本块开头按 Backspace 键
- 手动合并相邻的文本块
- 文本编辑和重构

特点：
- 原子性操作，确保数据一致性
- 使用延迟约束避免排序冲突
- 支持不同块类型
- 完整的错误处理

解决方案：
- 使用事务确保操作的原子性
- 先更新目标块内容，再删除当前块，最后调整排序
- 避免中间状态的约束冲突
- 只操作 context_blocks 表，不触及 content_parents 表
*/

-- 合并语境块函数 - 修复版本
CREATE OR REPLACE FUNCTION merge_context_blocks(
  p_current_block_id UUID,
  p_target_block_id UUID,
  p_merged_content TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 添加函数注释
COMMENT ON FUNCTION merge_context_blocks(UUID, UUID, TEXT) IS '合并两个相邻的语境块，将当前块内容合并到目标块并删除当前块。只操作context_blocks表，不触及content_parents表。';

-- 测试函数（可选）
-- SELECT merge_context_blocks(
--   'current-block-uuid'::UUID,
--   'target-block-uuid'::UUID,
--   '合并后的内容'
-- ); 