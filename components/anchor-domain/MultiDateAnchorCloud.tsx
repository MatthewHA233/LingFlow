'use client';

import { AnchorTooltip } from './AnchorTooltip';
import { motion, useMotionValue } from 'framer-motion';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Particles } from '@/components/ui/particles';
import type { Anchor, MeaningBlock } from '@/types/anchor';

interface MultiDateAnchorCloudProps {
  days: {
    date: string;
    anchors: Anchor[];
  }[];
  globalCollapsed?: boolean;
  onGlobalCollapsedChange?: (collapsed: boolean | undefined) => void;
}

// 性能优化：添加虚拟化参数
const VIEWPORT_PADDING = 200; // 视窗外延
const MAX_VISIBLE_ANCHORS = 500; // 最大可见锚点数量
const LOD_DISTANCE_THRESHOLD = 1000; // 增加LOD距离阈值，让更多锚点显示

// 计算日期锚点位置（圆形分布）
const getDateAnchorPosition = (index: number, total: number) => {
  if (total === 1) return { x: 0, y: 0 };
  
  const radius = Math.min(400, 200 + total * 40);
  const angle = (index * 2 * Math.PI) / total;
  
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
};

// 计算词汇锚点位置（优化的螺旋+分层布局）
const getWordAnchorPositions = (
  totalWords: number, 
  datePosition: { x: number; y: number }
) => {
  const positions = [];
  
  // 性能优化：限制最大渲染数量
  const maxWords = Math.min(totalWords, 50); // 每个日期最多50个锚点
  
  if (maxWords <= 12) {
    // 少量词汇：简单圆形分布
    const radius = 130; // 进一步增加半径
    for (let i = 0; i < maxWords; i++) {
      const angle = (i * 2 * Math.PI) / maxWords;
      positions.push({
        x: datePosition.x + Math.cos(angle) * radius,
        y: datePosition.y + Math.sin(angle) * radius
      });
    }
  } else {
    // 大量词汇：优化的螺旋分布
    const baseRadius = 100; // 进一步增加基础半径
    const wordsPerLayer = 6; // 减少每层词汇数确保间距
    
    for (let i = 0; i < maxWords; i++) {
      const layer = Math.floor(i / wordsPerLayer);
      const indexInLayer = i % wordsPerLayer;
      const layerRadius = baseRadius + layer * 55; // 进一步增加层间距
      
      // 确保每个词汇有足够的角度间距
      const angleStep = (2 * Math.PI) / wordsPerLayer;
      // 每层轻微旋转避免对齐
      const layerOffset = layer * (Math.PI / wordsPerLayer) * 0.5;
      const angle = indexInLayer * angleStep + layerOffset;
      
      positions.push({
        x: datePosition.x + Math.cos(angle) * layerRadius,
        y: datePosition.y + Math.sin(angle) * layerRadius
      });
    }
  }
  
  return positions;
};

export function MultiDateAnchorCloud({ 
  days, 
  globalCollapsed, 
  onGlobalCollapsedChange 
}: MultiDateAnchorCloudProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredDateAnchor, setHoveredDateAnchor] = useState<string | null>(null);
  const [selectedDateAnchor, setSelectedDateAnchor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerCenter, setContainerCenter] = useState({ x: 0, y: 0 });
  const [viewportBounds, setViewportBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 性能优化：缓存位置计算结果
  const memoizedPositions = useMemo(() => {
    const datePositions = new Map();
    const wordPositions = new Map();
    
    days.forEach((day, dayIndex) => {
      const datePos = getDateAnchorPosition(dayIndex, days.length);
      datePositions.set(day.date, datePos);
      
      const wordPos = getWordAnchorPositions(day.anchors.length, datePos);
      wordPositions.set(day.date, wordPos);
    });
    
    return { datePositions, wordPositions };
  }, [days]);

  // 获取容器中心点
  useEffect(() => {
    const updateCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerCenter({
          x: rect.width / 2,
          y: rect.height / 2
        });
        setViewportBounds({
          x: -rect.width / 2,
          y: -rect.height / 2,
          width: rect.width,
          height: rect.height
        });
      }
    };
    
    updateCenter();
    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, []);

  // 性能优化：视窗剔除函数
  const isInViewport = useCallback((pos: { x: number; y: number }) => {
    const currentX = x.get();
    const currentY = y.get();
    
    return (
      pos.x + currentX > viewportBounds.x - VIEWPORT_PADDING &&
      pos.x + currentX < viewportBounds.x + viewportBounds.width + VIEWPORT_PADDING &&
      pos.y + currentY > viewportBounds.y - VIEWPORT_PADDING &&
      pos.y + currentY < viewportBounds.y + viewportBounds.height + VIEWPORT_PADDING
    );
  }, [x, y, viewportBounds]);

  // 性能优化：LOD系统
  const getDetailLevel = useCallback((position: { x: number; y: number }) => {
    const distance = Math.sqrt(position.x * position.x + position.y * position.y);
    if (distance > LOD_DISTANCE_THRESHOLD) return 'low';
    if (distance > LOD_DISTANCE_THRESHOLD / 2) return 'medium';
    return 'high';
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'auto';
  }, []);

  // 生成曲线路径（简化版本）
  const generateCurvePath = (
    start: { x: number; y: number }, 
    end: { x: number; y: number }
  ) => {
    // 性能优化：简化路径计算
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    return `M ${start.x + containerCenter.x} ${start.y + containerCenter.y} 
            Q ${midX + containerCenter.x} ${midY + containerCenter.y} 
            ${end.x + containerCenter.x} ${end.y + containerCenter.y}`;
  };

  // 简化的粒子效果（仅选中状态）
  const generateFlowingParticles = (pathId: string, isSelected: boolean) => {
    if (!isSelected) return []; // 只在选中时显示粒子
    
    return [
      <circle
        key={0}
        r={2}
        fill="rgba(255,255,255,0.8)"
        opacity="0"
      >
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
        <animate
          attributeName="opacity"
          values="0;1;0"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    ];
  };

  // 获取锚点颜色
  const getAnchorColor = (proficiency: number) => {
    if (proficiency >= 0.8) return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30';
    if (proficiency >= 0.6) return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30';
    if (proficiency >= 0.4) return 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30';
    return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30';
  };

  // 获取日期锚点样式
  const getDateAnchorStyle = (dayData: any, isHovered: boolean, isSelected: boolean) => {
    const totalMeaningBlocks = dayData.anchors.reduce((sum: number, anchor: any) => 
      sum + anchor.meaning_blocks.length, 0);
    
    let intensity = Math.min(totalMeaningBlocks / 20, 1); // 简化强度计算

    let bgColor = `rgba(30, 58, 138, ${0.2 + intensity * 0.3})`;
    let borderColor = `rgba(59, 130, 246, ${0.3 + intensity * 0.3})`;
    
    if (isSelected) {
      borderColor = 'rgba(34, 197, 94, 0.8)';
    }
    
    const scale = isHovered ? 1.05 : isSelected ? 1.1 : 1;
    
    return {
      backgroundColor: bgColor,
      borderColor: borderColor,
      transform: `scale(${scale})`,
      transition: 'all 0.3s ease' // 简化过渡
    };
  };

  // 检查是否是今天
  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return today.toDateString() === date.toDateString();
  };

  // 获取选中日期的详细信息
  const getSelectedDayInfo = () => {
    if (!selectedDateAnchor) return null;
    
    const selectedDay = days.find(day => day.date === selectedDateAnchor);
    if (!selectedDay) return null;
    
    const totalMeaningBlocks = selectedDay.anchors.reduce((sum, anchor) => 
      sum + anchor.meaning_blocks.length, 0);
    
    const totalContexts = selectedDay.anchors.reduce((sum, anchor) => 
      sum + anchor.meaning_blocks.reduce((contextSum: number, block: any) => 
        contextSum + (block.contexts?.length || 0), 0), 0);
    
    const words = selectedDay.anchors.filter(anchor => !anchor.text.includes(' '));
    const phrases = selectedDay.anchors.filter(anchor => anchor.text.includes(' '));
    
    return {
      date: selectedDay.date,
      totalAnchors: selectedDay.anchors.length,
      totalMeaningBlocks,
      totalContexts,
      words: words.length,
      phrases: phrases.length
    };
  };

  const selectedDayInfo = getSelectedDayInfo();

  // 性能优化：过滤可见元素
  const visibleDays = useMemo(() => {
    return days.filter((day, dayIndex) => {
      const datePos = memoizedPositions.datePositions.get(day.date);
      return datePos && isInViewport(datePos);
    }).slice(0, 50); // 限制最多50个日期
  }, [days, memoizedPositions, isInViewport]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing bg-gradient-to-br from-slate-900/50 via-purple-900/30 to-slate-900/50 rounded-lg"
    >
      {/* 减少粒子数量 */}
      <Particles
        className="absolute inset-0"
        quantity={isDragging ? 50 : 100}
        staticity={50}
        ease={80}
        size={0.4}
        color="#ffffff"
      />

      {/* 简化的SVG连接线层 */}
      <svg 
        className="absolute inset-0 pointer-events-none z-0"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>
        </defs>
        
        <motion.g style={{ x: x, y: y }}>
          {/* 只渲染选中日期的连接线 */}
          {selectedDateAnchor && visibleDays.map((day) => {
            if (day.date !== selectedDateAnchor) return null;
            
            const datePosition = memoizedPositions.datePositions.get(day.date);
            const wordPositions = memoizedPositions.wordPositions.get(day.date);
            
            return day.anchors.slice(0, 20).map((anchor, anchorIndex) => { // 限制连接线数量
              const wordPosition = wordPositions?.[anchorIndex];
              if (!wordPosition || !datePosition) return null;
              
              const pathData = generateCurvePath(datePosition, wordPosition);
              const pathId = `path-${day.date}-${anchor.id}`;
              
              return (
                <g key={`${day.date}-${anchor.id}`}>
                  <path id={pathId} d={pathData} fill="none" stroke="none" opacity="0" />
                  <path
                    d={pathData}
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                  />
                  {generateFlowingParticles(pathId, true)}
                </g>
              );
            });
          })}
        </motion.g>
      </svg>

      {/* 扩大的拖拽层 */}
      <motion.div 
        className="absolute z-10"
        style={{ 
          x: x, 
          y: y,
          left: '-1000px',
          top: '-1000px',
          width: 'calc(100% + 2000px)',
          height: 'calc(100% + 2000px)'
        }}
        drag
        dragElastic={0}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />

      {/* 内容层 */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
        style={{ x: x, y: y }}
      >
        <div className="relative w-full h-full">
          {visibleDays.map((day, dayIndex) => {
            const datePosition = memoizedPositions.datePositions.get(day.date);
            if (!datePosition) return null;
            
            const isHovered = hoveredDateAnchor === day.date;
            const isSelected = selectedDateAnchor === day.date;
            const dateStyle = getDateAnchorStyle(day, isHovered, isSelected);
            const wordPositions = memoizedPositions.wordPositions.get(day.date);
            const isTodayDate = isToday(day.date);
            const detailLevel = getDetailLevel(datePosition);

            return (
              <div key={day.date}>
                {/* 简化的日期锚点 */}
                <div
                  className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto"
                  style={{
                    transform: `translate(${datePosition.x}px, ${datePosition.y}px) translate(-50%, -50%)`
                  }}
                  onMouseEnter={() => setHoveredDateAnchor(day.date)}
                  onMouseLeave={() => setHoveredDateAnchor(null)}
                  onClick={() => setSelectedDateAnchor(isSelected ? null : day.date)}
                >
                  <div
                    className="w-12 h-12 rounded-lg backdrop-blur-md border cursor-pointer flex flex-col items-center justify-center"
                    style={dateStyle}
                  >
                    <div className={`font-bold text-sm ${isTodayDate ? 'text-orange-400' : 'text-white'}`}>
                      {new Date(day.date).getDate()}
                    </div>
                    <div className={`text-xs ${isTodayDate ? 'text-orange-300/90' : 'text-white/70'}`}>
                      {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short' })}
                    </div>
                  </div>
                </div>

                {/* 锚点渲染优化 */}
                {(isSelected || detailLevel === 'high') && day.anchors.slice(0, isSelected ? 50 : 20).map((anchor, anchorIndex) => {
                  const wordPosition = wordPositions?.[anchorIndex];
                  if (!wordPosition) return null;
                  
                  const avgProficiency = anchor.meaning_blocks.reduce(
                    (sum: number, block: MeaningBlock) => sum + block.current_proficiency,
                    0
                  ) / anchor.meaning_blocks.length;

                  const isAnchorCreatedToday = anchor.created_at && anchor.created_at.split('T')[0] === day.date;

                  return (
                    <div
                      key={anchor.id}
                      className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                      style={{
                        transform: `translate(${wordPosition.x}px, ${wordPosition.y}px) translate(-50%, -50%)`,
                      }}
                    >
                      <AnchorTooltip 
                        anchor={anchor} 
                        currentDate={day.date}
                        globalCollapsed={globalCollapsed}
                        onGlobalCollapsedChange={onGlobalCollapsedChange}
                      >
                        <div
                          className={`px-2 py-1 rounded-full backdrop-blur-sm cursor-pointer text-xs
                            ${getAnchorColor(avgProficiency)}
                            border transition-all duration-200 shadow-sm hover:shadow-md
                            flex items-center gap-1 hover:scale-105
                            ${isAnchorCreatedToday ? 'ring-1 ring-green-400/50' : ''}`}
                        >
                          <span className={`${isAnchorCreatedToday ? 'text-green-200' : 'text-white/90'} text-xs`}>
                            {anchor.text}
                          </span>
                          {anchor.meaning_blocks.some((b: MeaningBlock) => b.next_review_date && new Date(b.next_review_date) <= new Date()) && (
                            <span className="w-1 h-1 rounded-full bg-red-500/80 animate-pulse" />
                          )}
                        </div>
                      </AnchorTooltip>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* 简化的信息面板 */}
      {selectedDayInfo && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 max-w-64">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-100 text-sm font-medium">
                {new Date(selectedDayInfo.date).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric'
                })}
              </h3>
              <button
                onClick={() => setSelectedDateAnchor(null)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/50 rounded p-2 text-center">
                <div className="text-slate-400">锚点</div>
                <div className="text-slate-100 font-semibold">{selectedDayInfo.totalAnchors}</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2 text-center">
                <div className="text-slate-400">含义</div>
                <div className="text-slate-100 font-semibold">{selectedDayInfo.totalMeaningBlocks}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm text-center">
        <div>拖动画布探索锚点网络 • 点击日期查看详情</div>
        <div className="text-xs text-white/40 mt-1">
          显示 {visibleDays.length}/{days.length} 个日期 • {days.reduce((sum, day) => sum + day.anchors.length, 0)} 个词汇
        </div>
      </div>
    </div>
  );
}

// 慢速旋转动画
const styles = `
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .animate-spin-slow {
    animation: spin-slow 15s linear infinite;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
} 