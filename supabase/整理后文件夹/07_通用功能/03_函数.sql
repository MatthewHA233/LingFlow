-- 07_通用功能模块 - 函数定义

-- 检查和修复约束
CREATE OR REPLACE FUNCTION public.check_and_fix_constraint_for_deferred()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$

-- 设置用户ID
CREATE OR REPLACE FUNCTION public.set_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$function$

-- 更新updated_at列
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$