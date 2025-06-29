/*
文件说明：创建分割语境块的 Supabase 函数

主要功能：
1. 在指定位置分割语境块
2. 更新原块内容
3. 创建新块
4. 自动调整后续块的排序
5. 保持数据一致性

使用场景：
- 用户在文本块中按回车键创建新块
- 编辑器中的块分割操作
- 文本重构和组织

特点：
- 原子性操作，确保数据一致性
- 使用 PostgreSQL 延迟约束避免排序冲突
- 支持不同块类型
- 完整的错误处理

解决方案：
- 使用 DEFERRABLE INITIALLY DEFERRED 约束延迟检查
- 在事务提交时才检查唯一性约束
- 避免中间状态的约束冲突
*/

-- 首先检查并修改表约束（如果需要）
-- 注意：这个部分需要在生产环境中谨慎执行
-- 可能需要单独运行，因为涉及表结构变更

-- 检查当前约束是否支持延迟
DO $$
DECLARE
    constraint_info RECORD;
BEGIN
    -- 查询当前的唯一约束信息
    SELECT 
        conname,
        condeferrable,
        condeferred
    INTO constraint_info
    FROM pg_constraint 
    WHERE conrelid = 'context_blocks'::regclass 
      AND contype = 'u'
      AND conkey = (SELECT array_agg(attnum ORDER BY attnum) 
                    FROM pg_attribute 
                    WHERE attrelid = 'context_blocks'::regclass 
                      AND attname IN ('parent_id', 'order_index'));
    
    IF FOUND THEN
        -- 如果约束存在但不支持延迟，给出提示
        IF NOT constraint_info.condeferrable THEN
            RAISE NOTICE '当前唯一约束 % 不支持延迟检查，建议在生产环境中重建约束', constraint_info.conname;
            RAISE NOTICE '执行命令：ALTER TABLE context_blocks DROP CONSTRAINT %, ADD CONSTRAINT % UNIQUE (parent_id, order_index) DEFERRABLE INITIALLY IMMEDIATE;', 
                constraint_info.conname, constraint_info.conname;
        ELSE
            RAISE NOTICE '约束 % 已支持延迟检查', constraint_info.conname;
        END IF;
    ELSE
        RAISE NOTICE '未找到 (parent_id, order_index) 的唯一约束';
    END IF;
END $$;

-- 创建分割语境块的函数（使用延迟约束方法）
CREATE OR REPLACE FUNCTION split_context_block(
  p_block_id UUID,
  p_split_content TEXT,
  p_remaining_content TEXT,
  p_cursor_position INTEGER DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id UUID;
  v_order_index INTEGER;
  v_block_type block_type;
  v_new_block_id UUID;
  v_result jsonb;
  v_user_id UUID;
  v_affected_rows INTEGER := 0;
  v_constraint_name TEXT;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  -- 验证用户权限
  IF NOT EXISTS (
    SELECT 1 FROM context_blocks cb
    JOIN content_parents cp ON cp.id = cb.parent_id
    WHERE cb.id = p_block_id AND cp.user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '权限不足或块不存在',
      'error_code', 'PERMISSION_DENIED'
    );
  END IF;
  
  -- 获取原块信息
  SELECT parent_id, order_index, block_type 
  INTO v_parent_id, v_order_index, v_block_type
  FROM context_blocks 
  WHERE id = p_block_id;
  
  -- 验证内容不为空
  IF p_split_content IS NULL AND p_remaining_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '分割内容不能全部为空',
      'error_code', 'INVALID_CONTENT'
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
  
  -- 开始事务操作
  BEGIN
    -- 如果约束支持延迟，则设置为延迟检查
    IF v_constraint_name IS NOT NULL THEN
      BEGIN
        EXECUTE format('SET CONSTRAINTS %I DEFERRED', v_constraint_name);
        RAISE NOTICE '已设置约束 % 为延迟检查', v_constraint_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '无法设置约束延迟，使用传统方法: %', SQLERRM;
      END;
    END IF;
    
    -- 使用 PostgreSQL 官方推荐的方法：
    -- 1. 先将后续块向后移动1位（延迟约束避免冲突）
    UPDATE context_blocks 
    SET order_index = order_index + 1,
        updated_at = NOW()
    WHERE parent_id = v_parent_id 
      AND order_index > v_order_index;
    
    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    
    -- 2. 更新原块内容（保持原有的 order_index）
    UPDATE context_blocks 
    SET content = COALESCE(TRIM(p_split_content), ''),
        updated_at = NOW()
    WHERE id = p_block_id;
    
    -- 3. 创建新块在正确位置（原块的下一个位置）
    INSERT INTO context_blocks (
      parent_id, 
      block_type, 
      content, 
      order_index,
      metadata
    )
    VALUES (
      v_parent_id, 
      v_block_type, 
      COALESCE(TRIM(p_remaining_content), ''), 
      v_order_index + 1,
      jsonb_build_object(
        'created_by_split', true,
        'original_block_id', p_block_id,
        'split_position', p_cursor_position,
        'split_timestamp', NOW()
      )
    )
    RETURNING id INTO v_new_block_id;
    
    -- 构建成功返回结果
    v_result := jsonb_build_object(
      'success', true,
      'original_block_id', p_block_id,
      'new_block_id', v_new_block_id,
      'new_order_index', v_order_index + 1,
      'affected_blocks', v_affected_rows,
      'method', 'deferred_constraints',
      'message', '语境块分割成功'
    );
    
    -- 记录操作日志
    RAISE NOTICE '语境块分割成功: 原块=%, 新块=%, 影响块数=%, 方法=延迟约束', 
      p_block_id, v_new_block_id, v_affected_rows;
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- 捕获所有错误并回滚
    RAISE WARNING '语境块分割失败: %', SQLERRM;
    
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', 'SPLIT_FAILED',
      'sqlstate', SQLSTATE,
      'suggestion', '可能需要重建约束为延迟约束'
    );
    
    RETURN v_result;
  END;
END;
$$;

-- 创建批量重排序函数（辅助函数）
CREATE OR REPLACE FUNCTION reorder_blocks_after_split(
  p_parent_id UUID,
  p_start_order INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 创建插入新块的函数（在指定位置插入）
CREATE OR REPLACE FUNCTION insert_context_block(
  p_parent_id UUID,
  p_block_type block_type,
  p_content TEXT,
  p_insert_after_order INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 创建删除块并重排序的函数
CREATE OR REPLACE FUNCTION delete_context_block(
  p_block_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 添加函数注释
COMMENT ON FUNCTION split_context_block(UUID, TEXT, TEXT, INTEGER) IS '分割语境块：使用延迟约束方法避免排序冲突';
COMMENT ON FUNCTION reorder_blocks_after_split(UUID, INTEGER) IS '重排序函数：在分割后重新排序块';
COMMENT ON FUNCTION insert_context_block(UUID, block_type, TEXT, INTEGER, JSONB) IS '插入新语境块：使用延迟约束在指定位置插入新块';
COMMENT ON FUNCTION delete_context_block(UUID) IS '删除语境块：使用延迟约束删除块并重新排序';

-- 创建约束检查和修复脚本
CREATE OR REPLACE FUNCTION check_and_fix_constraint_for_deferred()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    constraint_info RECORD;
    fix_sql TEXT;
    result_msg TEXT := '';
BEGIN
    -- 查询当前的唯一约束信息
    SELECT 
        conname,
        condeferrable,
        condeferred
    INTO constraint_info
    FROM pg_constraint 
    WHERE conrelid = 'context_blocks'::regclass 
      AND contype = 'u'
      AND conkey = (SELECT array_agg(attnum ORDER BY attnum) 
                    FROM pg_attribute 
                    WHERE attrelid = 'context_blocks'::regclass 
                      AND attname IN ('parent_id', 'order_index'));
    
    IF FOUND THEN
        IF constraint_info.condeferrable THEN
            result_msg := format('约束 %s 已支持延迟检查 (deferrable=%s, deferred=%s)', 
                constraint_info.conname, 
                constraint_info.condeferrable, 
                constraint_info.condeferred);
        ELSE
            fix_sql := format('ALTER TABLE context_blocks DROP CONSTRAINT %I, ADD CONSTRAINT %I UNIQUE (parent_id, order_index) DEFERRABLE INITIALLY IMMEDIATE;', 
                constraint_info.conname, constraint_info.conname);
            result_msg := format('约束 %s 不支持延迟检查，需要执行: %s', constraint_info.conname, fix_sql);
        END IF;
    ELSE
        result_msg := '未找到 (parent_id, order_index) 的唯一约束，可能需要创建';
    END IF;
    
    RETURN result_msg;
END;
$$;

-- 创建使用示例的注释
/*
使用前检查和修复：

1. 检查约束状态：
SELECT check_and_fix_constraint_for_deferred();

2. 如果需要修复约束（在生产环境中谨慎执行）：
-- 示例：假设约束名为 context_blocks_parent_id_order_index_key
ALTER TABLE context_blocks 
DROP CONSTRAINT context_blocks_parent_id_order_index_key,
ADD CONSTRAINT context_blocks_parent_id_order_index_key 
UNIQUE (parent_id, order_index) DEFERRABLE INITIALLY IMMEDIATE;

使用示例：

1. 分割语境块：
SELECT split_context_block(
  'block-uuid-here',
  '第一部分内容',
  '第二部分内容',
  15  -- 光标位置（可选）
);

2. 插入新块：
SELECT insert_context_block(
  'parent-uuid-here',
  'text',
  '新块内容',
  2,  -- 插入到第2个位置之后
  '{"created_by": "user"}'::jsonb
);

3. 删除块：
SELECT delete_context_block('block-uuid-here');

返回格式：
{
  "success": true,
  "original_block_id": "uuid",
  "new_block_id": "uuid", 
  "new_order_index": 3,
  "affected_blocks": 5,
  "method": "deferred_constraints",
  "message": "语境块分割成功"
}

优势：
- 使用 PostgreSQL 官方推荐的延迟约束方法
- 避免中间状态的唯一约束冲突
- 更简洁、更可靠的实现
- 符合数据库最佳实践
*/ 