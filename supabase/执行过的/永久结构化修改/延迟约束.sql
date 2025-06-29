-- 假设约束名为 context_blocks_parent_id_order_index_key
ALTER TABLE context_blocks 
DROP CONSTRAINT context_blocks_parent_id_order_index_key,
ADD CONSTRAINT context_blocks_parent_id_order_index_key 
UNIQUE (parent_id, order_index) DEFERRABLE INITIALLY IMMEDIATE;