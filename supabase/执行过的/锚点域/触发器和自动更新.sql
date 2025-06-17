-- 自动更新锚点统计信息的触发器
CREATE OR REPLACE FUNCTION update_anchor_stats() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 更新含义块数量
    UPDATE anchors 
    SET total_meaning_blocks = total_meaning_blocks + 1,
        updated_at = NOW()
    WHERE id = NEW.anchor_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- 更新含义块数量
    UPDATE anchors 
    SET total_meaning_blocks = total_meaning_blocks - 1,
        updated_at = NOW()
    WHERE id = OLD.anchor_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_anchor_stats
  AFTER INSERT OR DELETE ON meaning_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_anchor_stats();

-- 自动更新上下文统计的触发器
CREATE OR REPLACE FUNCTION update_context_stats() RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_context_stats
  AFTER INSERT OR DELETE ON meaning_block_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_context_stats();