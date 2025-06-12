-- 创建章节插入函数 V4 - 根据书籍类型设置正确的content_type
CREATE OR REPLACE FUNCTION insert_chapter_at_position(
  p_book_id UUID,
  p_position INTEGER,
  p_title TEXT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content_parent_id UUID;
  v_chapter_id UUID;
  v_block_id UUID;
  v_result JSON;
  v_affected_rows INTEGER;
  v_chapters_to_update RECORD;
  v_book_type TEXT;
BEGIN
  -- 记录调试信息
  RAISE NOTICE '开始创建章节，参数: book_id=%, position=%, title=%, user_id=%', p_book_id, p_position, p_title, p_user_id;
  
  -- 开始事务
  BEGIN
    -- 1. 获取书籍类型以确定正确的content_type
    SELECT type INTO v_book_type
    FROM books
    WHERE id = p_book_id;
    
    IF v_book_type IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '未找到指定的书籍'
      );
    END IF;
    
    RAISE NOTICE '书籍类型: %', v_book_type;
    
    -- 2. 先检查是否存在冲突的order_index
    SELECT COUNT(*) INTO v_affected_rows
    FROM chapters 
    WHERE book_id = p_book_id AND order_index = p_position;
    
    RAISE NOTICE '位置%处现有章节数量: %', p_position, v_affected_rows;
    
    -- 3. 使用临时负索引避免唯一约束冲突
    -- 首先将所有需要移动的章节设置为临时负索引
    UPDATE chapters 
    SET order_index = -(order_index + 1000)  -- 使用负数避免冲突
    WHERE book_id = p_book_id 
      AND order_index >= p_position;
    
    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    RAISE NOTICE '将%个章节设置为临时负索引', v_affected_rows;
    
    -- 4. 创建content_parent记录，根据书籍类型设置正确的content_type
    INSERT INTO content_parents (
      content_type, 
      title, 
      user_id, 
      metadata
    ) VALUES (
      CASE 
        WHEN v_book_type = 'notebook' THEN 'custom_page'::content_type
        ELSE 'chapter'::content_type
      END, 
      p_title, 
      p_user_id, 
      jsonb_build_object('book_id', p_book_id, 'chapter_index', p_position)
    )
    RETURNING id INTO v_content_parent_id;
    
    RAISE NOTICE '创建content_parent成功，ID: %', v_content_parent_id;
    
    -- 5. 创建章节记录
    INSERT INTO chapters (
      book_id, 
      title, 
      order_index, 
      parent_id
    ) VALUES (
      p_book_id, 
      p_title, 
      p_position, 
      v_content_parent_id
    )
    RETURNING id INTO v_chapter_id;
    
    RAISE NOTICE '创建章节成功，ID: %', v_chapter_id;
    
    -- 6. 将临时负索引的章节恢复为正确的正索引
    UPDATE chapters 
    SET order_index = (-order_index - 1000) + 1  -- 恢复并+1
    WHERE book_id = p_book_id 
      AND order_index < 0;
    
    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    RAISE NOTICE '恢复了%个章节的正确索引', v_affected_rows;
    
    -- 7. 创建默认语境块，根据书籍类型设置不同的默认文本
    INSERT INTO context_blocks (
      parent_id, 
      block_type, 
      content, 
      order_index, 
      metadata
    ) VALUES (
      v_content_parent_id, 
      'text', 
      CASE 
        WHEN v_book_type = 'notebook' THEN '这是新页面的默认文本内容，点击编辑开始创作。'
        ELSE '这是新章节的默认文本内容，点击编辑开始创作。'
      END, 
      0, 
      '{}'::jsonb
    )
    RETURNING id INTO v_block_id;
    
    RAISE NOTICE '创建默认语境块成功，ID: %', v_block_id;
    
    -- 8. 构建返回结果
    SELECT jsonb_build_object(
      'success', true,
      'chapter', jsonb_build_object(
        'id', v_chapter_id,
        'title', p_title,
        'order_index', p_position,
        'book_id', p_book_id,
        'parent_id', v_content_parent_id
      ),
      'content_parent_id', v_content_parent_id,
      'default_block', jsonb_build_object(
        'id', v_block_id,
        'parent_id', v_content_parent_id,
        'block_type', 'text',
        'content', CASE 
          WHEN v_book_type = 'notebook' THEN '这是新页面的默认文本内容，点击编辑开始创作。'
          ELSE '这是新章节的默认文本内容，点击编辑开始创作。'
        END,
        'order_index', 0,
        'metadata', '{}'::jsonb
      )
    ) INTO v_result;
    
    RAISE NOTICE '构建返回结果成功';
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- 发生错误时记录详细信息并返回错误
    RAISE NOTICE '创建章节时发生错误: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'detail', 'Error occurred in insert_chapter_at_position function'
    );
  END;
END;
$$;

-- V5: 批量更新策略的章节重排序函数
-- 获取所有章节，重新排序，然后批量更新

CREATE OR REPLACE FUNCTION reorder_chapter(
  p_book_id UUID,
  p_from_index INTEGER,
  p_to_index INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chapters RECORD;
  v_chapter_array UUID[];
  v_moved_chapter_id UUID;
  v_updated_count INTEGER := 0;
  v_temp_offset INTEGER := 10000;  -- 临时偏移量，避免冲突
BEGIN
  RAISE NOTICE '开始批量重排序章节: book_id=%, from=%, to=%', p_book_id, p_from_index, p_to_index;
  
  BEGIN
    -- 1. 获取要移动的章节ID
    SELECT id INTO v_moved_chapter_id
    FROM chapters
    WHERE book_id = p_book_id AND order_index = p_from_index;
    
    IF v_moved_chapter_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '未找到要移动的章节'
      );
    END IF;
    
    -- 2. 获取所有章节ID，按当前order_index排序
    SELECT array_agg(id ORDER BY order_index) INTO v_chapter_array
    FROM chapters
    WHERE book_id = p_book_id;
    
    RAISE NOTICE '获取到%个章节', array_length(v_chapter_array, 1);
    
    -- 3. 在数组中重新排列：从from_index移动到to_index
    DECLARE
      v_temp_id UUID;
      i INTEGER;
    BEGIN
      -- 从数组中取出要移动的元素
      v_temp_id := v_chapter_array[p_from_index + 1]; -- 数组索引从1开始
      
      -- 移除该元素
      FOR i IN (p_from_index + 1)..(array_length(v_chapter_array, 1) - 1) LOOP
        v_chapter_array[i] := v_chapter_array[i + 1];
      END LOOP;
      
      -- 缩短数组
      v_chapter_array := v_chapter_array[1:array_length(v_chapter_array, 1) - 1];
      
      -- 在新位置插入元素
      -- 先扩展数组
      v_chapter_array := array_append(v_chapter_array, v_chapter_array[array_length(v_chapter_array, 1)]);
      
      -- 向后移动元素为新位置腾出空间
      FOR i IN REVERSE array_length(v_chapter_array, 1)..(p_to_index + 2) LOOP
        v_chapter_array[i] := v_chapter_array[i - 1];
      END LOOP;
      
      -- 插入到新位置
      v_chapter_array[p_to_index + 1] := v_temp_id;
    END;
    
    -- 4. 分两步更新：先移动到临时范围，再移动到最终位置
    
    -- 第一步：将所有章节移动到临时范围（加上偏移量避免冲突）
    FOR i IN 1..array_length(v_chapter_array, 1) LOOP
      UPDATE chapters 
      SET order_index = v_temp_offset + i - 1
      WHERE id = v_chapter_array[i];
    END LOOP;
    
    -- 第二步：从临时范围移动到最终位置
    FOR i IN 1..array_length(v_chapter_array, 1) LOOP
      UPDATE chapters 
      SET order_index = i - 1  -- 最终的正确索引
      WHERE id = v_chapter_array[i];
      
      v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RAISE NOTICE '批量更新完成，总更新章节数: %', v_updated_count;
    
    RETURN jsonb_build_object(
      'success', true,
      'updated_count', v_updated_count,
      'moved_chapter_id', v_moved_chapter_id
    );
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '重排序时发生错误: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
  END;
END;
$$;

-- 删除章节函数
CREATE OR REPLACE FUNCTION delete_chapter_at_position(
  p_book_id UUID,
  p_position INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chapter_id UUID;
  v_parent_id UUID;
  v_chapter_title TEXT;
  v_affected_rows INTEGER;
  v_deleted_blocks_count INTEGER;
BEGIN
  RAISE NOTICE '开始删除章节，参数: book_id=%, position=%', p_book_id, p_position;
  
  BEGIN
    -- 1. 获取要删除的章节信息
    SELECT id, parent_id, title INTO v_chapter_id, v_parent_id, v_chapter_title
    FROM chapters
    WHERE book_id = p_book_id AND order_index = p_position;
    
    IF v_chapter_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '未找到要删除的章节'
      );
    END IF;
    
    RAISE NOTICE '找到要删除的章节: id=%, title=%, parent_id=%', v_chapter_id, v_chapter_title, v_parent_id;
    
    -- 2. 检查章节总数，至少保留一个章节
    SELECT COUNT(*) INTO v_affected_rows
    FROM chapters
    WHERE book_id = p_book_id;
    
    IF v_affected_rows <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '无法删除最后一个章节，书籍至少需要保留一个章节'
      );
    END IF;
    
    -- 3. 统计将要删除的语境块数量（用于返回信息）
    SELECT COUNT(*) INTO v_deleted_blocks_count
    FROM context_blocks
    WHERE parent_id = v_parent_id;
    
    RAISE NOTICE '章节包含%个语境块，将被级联删除', v_deleted_blocks_count;
    
    -- 4. 删除章节（会级联删除content_parent和context_blocks）
    DELETE FROM chapters
    WHERE id = v_chapter_id;
    
    RAISE NOTICE '删除章节成功';
    
    -- 5. 重新排序后续章节 - 使用临时索引避免唯一约束冲突
    -- 第一步：将需要重新排序的章节移动到临时范围
    UPDATE chapters
    SET order_index = order_index + 10000  -- 临时偏移到安全范围
    WHERE book_id = p_book_id AND order_index > p_position;
    
    -- 第二步：从临时范围移动到最终位置
    UPDATE chapters
    SET order_index = order_index - 10000 - 1  -- 减去偏移量并减1
    WHERE book_id = p_book_id AND order_index > p_position + 10000;
    
    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    RAISE NOTICE '重新排序了%个后续章节', v_affected_rows;
    
    -- 6. 构建返回结果
    RETURN jsonb_build_object(
      'success', true,
      'deleted_chapter', jsonb_build_object(
        'id', v_chapter_id,
        'title', v_chapter_title,
        'position', p_position
      ),
      'deleted_blocks_count', v_deleted_blocks_count,
      'reordered_chapters_count', v_affected_rows
    );
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '删除章节时发生错误: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'detail', 'Error occurred in delete_chapter_at_position function'
    );
  END;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION insert_chapter_at_position(UUID, INTEGER, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_chapter(UUID, INTEGER, INTEGER) TO authenticated; 
GRANT EXECUTE ON FUNCTION delete_chapter_at_position(UUID, INTEGER) TO authenticated; 