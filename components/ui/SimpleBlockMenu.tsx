'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Type, 
  Heading1, 
  Heading2, 
  Heading3, 
  Hash,
  Trash2,
  Check,
  X,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ContextBlocksService } from '@/lib/services/context-blocks-service';
import { toast } from 'sonner';

// 块类型定义 - 添加四级标题
export type BlockType = 'text' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4';

// 块类型配置 - 包含四个级别的标题
const BLOCK_TYPES = [
  { 
    type: 'text' as BlockType, 
    label: '文本', 
    icon: Type, 
    description: '普通文本段落'
  },
  { 
    type: 'heading_1' as BlockType, 
    label: '一级标题', 
    icon: Heading1, 
    description: '最大标题'
  },
  { 
    type: 'heading_2' as BlockType, 
    label: '二级标题', 
    icon: Heading2, 
    description: '大标题'
  },
  { 
    type: 'heading_3' as BlockType, 
    label: '三级标题', 
    icon: Heading3, 
    description: '中标题'
  },
  { 
    type: 'heading_4' as BlockType, 
    label: '四级标题', 
    icon: Hash, 
    description: '小标题'
  }
];

interface SimpleBlockMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  currentBlockType: string;
  onTypeChange: (newType: BlockType) => void;
  onDelete: () => void;
  onShare?: () => void;
  blockId: string;
  blockData?: {
    content: string;
    order_index: number;
    parent_id: string;
  };
}

export function SimpleBlockMenu({
  isOpen,
  onClose,
  position,
  currentBlockType,
  onTypeChange,
  onDelete,
  onShare,
  blockId,
  blockData
}: SimpleBlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState(position);
  const [isDeleting, setIsDeleting] = useState(false);

  // 判断是否显示类型转换选项
  const shouldShowTypeOptions = !['audio_aligned', 'image'].includes(currentBlockType);

  // 组件挂载状态
  useEffect(() => {
    setMounted(true);
  }, []);

  // 计算菜单位置，确保不超出视窗，并定位在手柄左侧
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 默认在手柄左侧显示，Y轴居中对齐手柄
    let newX = position.x - rect.width - 15; // 左侧，留10px间距
    let newY = position.y - rect.height / 2; // Y轴居中

    // 水平方向调整 - 如果左侧空间不够，则显示在右侧
    if (newX < 20) {
      newX = position.x + 40; // 手柄右侧，假设手柄宽度约32px
    }
    
    // 如果右侧也不够，则尽量靠右
    if (newX + rect.width > viewportWidth - 20) {
      newX = viewportWidth - rect.width - 20;
    }

    // 垂直方向调整 - 确保不超出视窗
    if (newY < 20) {
      newY = 20;
    }
    if (newY + rect.height > viewportHeight - 20) {
      newY = viewportHeight - rect.height - 20;
    }

    setMenuPosition({ x: newX, y: newY });
  }, [isOpen, position]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // 处理块类型转换
  const handleTypeChange = useCallback((newType: BlockType) => {
    if (newType !== currentBlockType) {
      onTypeChange(newType);
    }
    onClose();
  }, [currentBlockType, onTypeChange, onClose]);

  // 处理分享链接
  const handleShare = useCallback(() => {
    if (onShare) {
      onShare();
    }
    onClose();
  }, [onShare, onClose]);

  // 处理删除 - 使用ContextBlocksService和事件机制
  const handleDelete = useCallback(async () => {
    if (isDeleting) return;
    
    try {
      setIsDeleting(true);
      
      // === 第一步：立即更新UI，提供即时反馈 ===
      // 立即通知父组件移除块（乐观更新）
      window.dispatchEvent(new CustomEvent('remove-temp-block', {
        detail: { tempId: blockId }
      }));
      
      // 不显示"正在删除"的提示，直接进行后台操作
      console.log('📡 后台验证数据库删除操作');
      
      const result = await ContextBlocksService.deleteBlock(blockId);
      
      if (result.success) {
        console.log('✅ 数据库删除成功:', result);
        // 只在成功时显示一次提示
        toast.success('块已删除');
        
        // 数据库操作成功，UI已经更新，不需要再次触发事件
        // 如果有父组件回调，也可以调用
        if (onDelete) {
          onDelete();
        }
        
      } else {
        console.error('❌ 数据库删除失败:', result);
        
        // === 第三步：如果数据库操作失败，回滚UI更改 ===
        console.log('🔄 回滚UI更改 - 重新创建块');
        
        // 重新创建块（回滚删除操作）
        window.dispatchEvent(new CustomEvent('create-temp-block', {
          detail: { 
            tempId: blockId,
            content: blockData?.content || '',
            orderIndex: blockData?.order_index || 0,
            parentId: blockData?.parent_id || '',
            afterBlockId: null // 可能需要重新计算位置
          }
        }));
        
        // 只在真正失败时显示错误提示
        toast.error(`删除失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('💥 删除块异常:', error);
      
      // 异常情况下的回滚处理
      console.log('🔄 异常回滚 - 重新创建块');
      
      // 重新创建块
      window.dispatchEvent(new CustomEvent('create-temp-block', {
        detail: { 
          tempId: blockId,
          content: blockData?.content || '',
          orderIndex: blockData?.order_index || 0,
          parentId: blockData?.parent_id || '',
          afterBlockId: null
        }
      }));
      
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
      onClose(); // 关闭菜单
    }
  }, [isDeleting, blockId, blockData, onDelete, onClose]);

  if (!mounted) return null;

  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-lg min-w-[180px] overflow-hidden"
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
          }}
        >
          {/* 菜单头部 - 更紧致 */}
          <div className="px-3 py-1.5 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {shouldShowTypeOptions ? '块类型' : '块操作'}
              </span>
              <button
                onClick={onClose}
                className="p-0.5 hover:bg-accent rounded-sm transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="py-1">
            {/* 块类型转换选项 - 只在支持的块类型时显示 */}
            {shouldShowTypeOptions && (
              <>
                <div className="px-1 space-y-0">
                  {BLOCK_TYPES.map((blockType) => {
                    const Icon = blockType.icon;
                    const isCurrent = blockType.type === currentBlockType;
                    
                    return (
                      <button
                        key={blockType.type}
                        onClick={() => handleTypeChange(blockType.type)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                          isCurrent 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-accent/80 text-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs">{blockType.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate leading-tight">
                            {blockType.description}
                          </div>
                        </div>
                        {isCurrent && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>

                {/* 分隔线 - 只在有类型选项时显示 */}
                <div className="h-px bg-border mx-2 my-1" />
              </>
            )}

            {/* 删除操作 - 悬浮时变红色 */}
            <div className="px-1">
              {/* 分享链接按钮 */}
              {onShare && (
                <button
                  onClick={handleShare}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                    "hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-600 dark:hover:text-green-400"
                  )}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    复制块链接
                  </span>
                </button>
              )}

              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                  "hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {isDeleting ? '删除中...' : '删除此块'}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(menuContent, document.body);
} 