import { useState, useRef, useEffect } from 'react';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface ContentBlockProps {
  block: {
    id: string;
    block_type: string;
    content: string;
    metadata?: Record<string, any>;
    order_index: number;
  };
  resources?: Array<{ original_path: string; oss_path: string }>;
  onBlockUpdate?: (blockId: string, newType: string, content: string) => void;
  onOrderChange?: (draggedId: string, droppedId: string, position: 'before' | 'after') => void;
  isSelected?: boolean;
  onSelect?: (blockId: string, event: React.MouseEvent) => void;
}

export function ContentBlock({ 
  block, 
  resources, 
  onBlockUpdate,
  onOrderChange,
  isSelected,
  onSelect
}: ContentBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showDragHandle, setShowDragHandle] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(block.content);
  const blockRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  // 处理快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 添加日志来调试
      console.log('Key pressed:', {
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        target: document.activeElement,
        contains: blockRef.current?.contains(document.activeElement)
      });

      // 修改判断条件，确保在编辑状态下也能响应快捷键
      if (e.ctrlKey && e.shiftKey && 
          (blockRef.current?.contains(document.activeElement) || isSelected)) {
        let newType = block.block_type;

        switch (e.key) {
          case '1':
            newType = 'heading_1';
            break;
          case '2':
            newType = 'heading_2';
            break;
          case '3':
            newType = 'heading_3';
            break;
          case '4':
            newType = 'heading_4';
            break;
          case '0':
            newType = 'text';
            break;
          default:
            return;
        }

        e.preventDefault();
        if (isEditing) {
          setIsEditing(false);
        }
        onBlockUpdate?.(block.id, newType, block.content);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [block, onBlockUpdate, isSelected, isEditing]);

  // 处理拖拽
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', block.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = blockRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseY = e.clientY;
      const threshold = rect.top + (rect.height / 3);
      setDropPosition(mouseY < threshold ? 'before' : 'after');
    }
  };

  const handleDragLeave = () => {
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId !== block.id && dropPosition) {
      onOrderChange?.(draggedId, block.id, dropPosition);
    }
    setDropPosition(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    onSelect?.(block.id, e);
  };

  const handleDoubleClick = () => {
    if (block.block_type !== 'image') {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editContent !== block.content) {
      onBlockUpdate?.(block.id, block.block_type, editContent);
    }
  };

  const getOssUrl = (originalPath: string) => {
    const resource = resources?.find(r => r.original_path === originalPath);
    return resource?.oss_path || originalPath;
  };

  const renderContent = () => {
    if (isEditing) {
      return (
        <textarea
          ref={editRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleBlur();
            }
          }}
          className="w-full min-h-[100px] bg-transparent border-none focus:outline-none resize-none"
          style={{
            fontSize: block.block_type.startsWith('heading') ? 'inherit' : '1rem',
            fontWeight: block.block_type.startsWith('heading') ? 'bold' : 'normal'
          }}
        />
      );
    }

    switch (block.block_type) {
      case 'heading_1':
        return <h1 className="text-4xl font-bold my-6">{block.content}</h1>;
      case 'heading_2':
        return <h2 className="text-3xl font-bold my-5">{block.content}</h2>;
      case 'heading_3':
        return <h3 className="text-2xl font-bold my-4">{block.content}</h3>;
      case 'heading_4':
        return <h4 className="text-xl font-bold my-3">{block.content}</h4>;
      case 'heading_5':
        return <h5 className="text-lg font-bold my-2">{block.content}</h5>;
      case 'heading_6':
        return <h6 className="text-base font-bold my-2">{block.content}</h6>;
      case 'image':
        const imageUrl = getOssUrl(block.content);
        return (
          <div className="my-4">
            <img 
              src={imageUrl}
              alt={block.metadata?.alt || ''}
              className="max-w-full rounded-lg shadow-md"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-image.png';
              }}
            />
          </div>
        );
      default:
        return (
          <p className="text-base leading-relaxed my-3 whitespace-pre-wrap">
            {block.content}
          </p>
        );
    }
  };

  return (
    <div
      ref={blockRef}
      className={cn(
        'group relative px-4 -mx-4 rounded transition-colors',
        {
          'opacity-50': isDragging,
          'bg-accent/10': isSelected,
          'hover:bg-accent/5': !isSelected
        }
      )}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setShowDragHandle(true)}
      onMouseLeave={() => setShowDragHandle(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {dropPosition && (
        <div 
          className={cn(
            "absolute left-0 right-0 h-0.5 bg-primary",
            dropPosition === 'before' ? '-top-px' : '-bottom-px'
          )}
        />
      )}
      
      {showDragHandle && (
        <div className="absolute left+1 top-3 -translate-y-1/2 -translate-x-full px-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <div className="p-2 hover:bg-accent/10 rounded-md">
            <DragHandleDots2Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  );
} 