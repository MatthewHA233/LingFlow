'use client';

import { AnchorTooltip } from './AnchorTooltip';
import { motion, useSpring } from 'framer-motion';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Particles } from '@/components/ui/particles';
import type { Anchor, MeaningBlock } from '@/types/anchor';

interface AnchorCloudProps {
  days: {
    date: string;
    anchors: Anchor[];
  }[];
}

// 性能优化常量
const VIEWPORT_PADDING = 300;
const MAX_VISIBLE_ITEMS = 200;
const PERFORMANCE_MODE_THRESHOLD = 1000; // 超过1000个锚点启用性能模式

export function AnchorCloud({ days }: AnchorCloudProps) {
  const x = useSpring(0, { stiffness: 1000, damping: 50 });
  const y = useSpring(0, { stiffness: 1000, damping: 50 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [viewportBounds, setViewportBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [performanceMode, setPerformanceMode] = useState(false);

  // 计算总锚点数量
  const totalAnchors = useMemo(() => {
    return days.reduce((sum, day) => sum + day.anchors.length, 0);
  }, [days]);

  // 检查是否需要性能模式
  useEffect(() => {
    setPerformanceMode(totalAnchors > PERFORMANCE_MODE_THRESHOLD);
  }, [totalAnchors]);

  // 监听窗口大小变化
  useEffect(() => {
    const updateViewport = () => {
      setViewportBounds({
        x: -window.innerWidth / 2,
        y: -window.innerHeight / 2,
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // 视窗剔除函数
  const isInViewport = useCallback((position: { x: number; y: number }) => {
    const currentX = x.get();
    const currentY = y.get();
    
    return (
      position.x + currentX > viewportBounds.x - VIEWPORT_PADDING &&
      position.x + currentX < viewportBounds.x + viewportBounds.width + VIEWPORT_PADDING &&
      position.y + currentY > viewportBounds.y - VIEWPORT_PADDING &&
      position.y + currentY < viewportBounds.y + viewportBounds.height + VIEWPORT_PADDING
    );
  }, [x, y, viewportBounds]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'auto';
  }, []);

  // 优化的位置计算
  const getPosition = useCallback((index: number) => {
    const ITEMS_PER_ROW = performanceMode ? 8 : 5; // 性能模式下增加每行项目数
    const HORIZONTAL_GAP = performanceMode ? 160 : 220;
    const VERTICAL_GAP = performanceMode ? 120 : 150;
    const START_X = performanceMode ? -600 : -450;
    const START_Y = performanceMode ? -200 : -150;

    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const isEvenRow = row % 2 === 0;
    
    const x = isEvenRow 
      ? START_X + (col * HORIZONTAL_GAP)
      : START_X + ((ITEMS_PER_ROW - 1 - col) * HORIZONTAL_GAP);
    
    const y = START_Y + (row * VERTICAL_GAP);

    return { x, y };
  }, [performanceMode]);

  // 计算每个锚点的颜色
  const getAnchorColor = (proficiency: number) => {
    if (proficiency >= 0.8) return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30';
    if (proficiency >= 0.6) return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30';
    if (proficiency >= 0.4) return 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30';
    return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30';
  };

  // 过滤可见的日期和锚点
  const visibleItems = useMemo(() => {
    let visibleDays = [];
    let itemCount = 0;
    
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const position = getPosition(dayIndex);
      
      if (isInViewport(position)) {
        const day = days[dayIndex];
        
        // 在性能模式下限制每个日期的锚点数量
        const maxAnchorsPerDay = performanceMode ? 20 : day.anchors.length;
        const limitedAnchors = day.anchors.slice(0, maxAnchorsPerDay);
        
        visibleDays.push({
          ...day,
          anchors: limitedAnchors,
          position,
          dayIndex
        });
        
        itemCount += limitedAnchors.length;
        
        // 限制总可见项目数
        if (itemCount >= MAX_VISIBLE_ITEMS) {
          break;
        }
      }
    }
    
    return visibleDays;
  }, [days, getPosition, isInViewport, performanceMode]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
        transform: 'translate3d(0,0,0)',
        willChange: 'transform',
      }}
    >
      {/* 减少粒子数量以提升性能 */}
      <Particles
        className="absolute inset-0"
        quantity={performanceMode ? 50 : 150}
        staticity={50}
        ease={80}
        size={performanceMode ? 0.3 : 0.5}
        color="#ffffff"
      />

      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        drag
        dragElastic={0}
        dragMomentum={false}
        style={{ 
          x, 
          y,
          transform: 'translate3d(0,0,0)',
          willChange: 'transform'
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative w-full max-w-7xl h-full">
          {visibleItems.map((day) => {
            const { x: posX, y: posY } = day.position;

            return (
              <div
                key={day.date} 
                className={`absolute left-1/2 top-1/2 transition-opacity duration-300
                  ${isDragging ? 'opacity-80' : 'opacity-100'}`}
                style={{
                  transform: `translate3d(${posX}px, ${posY}px, 0) translate(-50%, -50%)`,
                }}
              >
                {/* 简化的日期标签 */}
                <div className={`text-white/60 mb-3 text-center backdrop-blur-sm px-2 py-1 rounded-full bg-white/5 ${performanceMode ? 'text-xs' : 'text-sm'}`}>
                  {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </div>
                
                {/* 锚点容器 */}
                <div 
                  className="flex flex-wrap gap-3 justify-center" 
                  style={{ 
                    width: performanceMode ? '180px' : '220px',
                    maxHeight: performanceMode ? '120px' : '150px',
                    transform: 'translate3d(0,0,0)',
                  }}
                >
                  {day.anchors.map((anchor, anchorIndex) => {
                    const avgProficiency = anchor.meaning_blocks.reduce(
                      (sum: number, block: MeaningBlock) => sum + block.current_proficiency,
                      0
                    ) / anchor.meaning_blocks.length;

                    const isAnchorCreatedToday = anchor.created_at && anchor.created_at.split('T')[0] === day.date;

                    return (
                      <AnchorTooltip key={anchor.id} anchor={anchor} currentDate={day.date}>
                        <div
                          className={`px-4 py-2 rounded-full backdrop-blur-sm cursor-pointer
                            ${getAnchorColor(avgProficiency)}
                            border transition-transform duration-200 shadow-md hover:shadow-lg
                            flex items-center gap-1 hover:scale-105
                            ${isAnchorCreatedToday ? 'ring-1 ring-green-400/50 shadow-green-400/20' : ''}
                            ${performanceMode ? 'text-xs' : 'text-xs'}`}
                          style={{ 
                            transform: 'translate3d(0,0,0)',
                            whiteSpace: 'nowrap' // 防止文本换行
                          }}
                        >
                          <span className={`${isAnchorCreatedToday ? 'text-green-200' : 'text-white/90'}`}>
                            {anchor.text}
                          </span>
                          {anchor.meaning_blocks.some((b: MeaningBlock) => b.next_review_date && new Date(b.next_review_date) <= new Date()) && (
                            <span className="w-1 h-1 rounded-full bg-red-500/80 animate-pulse" />
                          )}
                        </div>
                      </AnchorTooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* 性能信息显示 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-center">
        <div className={performanceMode ? 'text-xs' : 'text-sm'}>
        拖动画布探索更多锚点
          {performanceMode && (
            <span className="ml-2 px-2 py-1 bg-yellow-500/20 text-yellow-200 rounded text-xs">
              性能模式
            </span>
          )}
        </div>
        <div className="text-xs text-white/40 mt-1">
          显示 {visibleItems.length}/{days.length} 个日期 • 
          {visibleItems.reduce((sum, day) => sum + day.anchors.length, 0)}/{totalAnchors} 个锚点
        </div>
      </div>
    </div>
  );
} 