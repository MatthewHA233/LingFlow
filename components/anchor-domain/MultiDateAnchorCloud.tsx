'use client';

import { AnchorTooltip } from './AnchorTooltip';
import { motion, useSpring } from 'framer-motion';
import { useState, useCallback, useRef, useEffect } from 'react';
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

export function MultiDateAnchorCloud({ 
  days, 
  globalCollapsed, 
  onGlobalCollapsedChange 
}: MultiDateAnchorCloudProps) {
  const x = useSpring(0, { stiffness: 1000, damping: 50 });
  const y = useSpring(0, { stiffness: 1000, damping: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredDateAnchor, setHoveredDateAnchor] = useState<string | null>(null);
  const [selectedDateAnchor, setSelectedDateAnchor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerCenter, setContainerCenter] = useState({ x: 0, y: 0 });

  // 获取容器中心点
  useEffect(() => {
    const updateCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerCenter({
          x: rect.width / 2,
          y: rect.height / 2
        });
      }
    };
    
    updateCenter();
    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'auto';
  }, []);

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

  // 计算词汇锚点位置（使用改进的螺旋+分层布局）
  const getWordAnchorPositions = (
    totalWords: number, 
    datePosition: { x: number; y: number }
  ) => {
    const positions = [];
    
    if (totalWords <= 12) {
      // 少量词汇：简单圆形分布
      const radius = 100;
      for (let i = 0; i < totalWords; i++) {
        const angle = (i * 2 * Math.PI) / totalWords;
        positions.push({
          x: datePosition.x + Math.cos(angle) * radius,
          y: datePosition.y + Math.sin(angle) * radius
        });
      }
    } else {
      // 大量词汇：多层螺旋分布
      const baseRadius = 80;
      const spiralSpacing = 15; // 螺旋间距
      const wordsPerLayer = 8; // 每层基础词汇数
      
      for (let i = 0; i < totalWords; i++) {
        const layer = Math.floor(i / wordsPerLayer);
        const indexInLayer = i % wordsPerLayer;
        const layerRadius = baseRadius + layer * 40;
        
        // 螺旋角度计算
        const spiralTurns = layer * 0.8; // 每层旋转角度
        const angleStep = (2 * Math.PI) / (wordsPerLayer + layer * 2); // 随层数增加密度
        const angle = indexInLayer * angleStep + spiralTurns;
        
        // 添加一些随机偏移避免完全规则
        const randomOffset = (Math.sin(i * 0.7) * 0.3 + Math.cos(i * 1.1) * 0.3) * 20;
        const finalRadius = layerRadius + randomOffset;
        
        positions.push({
          x: datePosition.x + Math.cos(angle) * finalRadius,
          y: datePosition.y + Math.sin(angle) * finalRadius
        });
      }
    }
    
    return positions;
  };

  // 生成曲线路径（贝塞尔曲线）
  const generateCurvePath = (
    start: { x: number; y: number }, 
    end: { x: number; y: number }
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 控制点偏移量，基于距离调整
    const controlOffset = Math.min(distance * 0.3, 80);
    
    // 计算垂直于连线的控制点
    const midX = start.x + dx * 0.5;
    const midY = start.y + dy * 0.5;
    
    // 添加一些随机性和曲率
    const perpX = -dy / distance * controlOffset;
    const perpY = dx / distance * controlOffset;
    
    // 添加轻微的随机偏移
    const randomFactor = (Math.sin(start.x * 0.01) + Math.cos(start.y * 0.01)) * 0.5;
    
    const control1X = midX + perpX * (0.8 + randomFactor * 0.4);
    const control1Y = midY + perpY * (0.8 + randomFactor * 0.4);
    
    return `M ${start.x + containerCenter.x} ${start.y + containerCenter.y} 
            Q ${control1X + containerCenter.x} ${control1Y + containerCenter.y} 
            ${end.x + containerCenter.x} ${end.y + containerCenter.y}`;
  };

  // 生成沿路径流动的粒子效果
  const generateFlowingParticles = (pathId: string, isSelected: boolean) => {
    const particleCount = isSelected ? 4 : 3;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const delay = (i * (isSelected ? 0.4 : 0.6)) + 's';
      const size = isSelected ? 2.5 : 1.8;
      const opacity = isSelected ? 1 : 0.8;
      
      particles.push(
        <circle
          key={i}
          r={size}
          fill={`rgba(255,255,255,${opacity})`}
          opacity="0"
        >
          <animateMotion
            dur={isSelected ? "2.5s" : "3s"}
            repeatCount="indefinite"
            begin={delay}
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur={isSelected ? "2.5s" : "3s"}
            repeatCount="indefinite"
            begin={delay}
          />
        </circle>
      );
    }
    
    return particles;
  };

  // 获取锚点颜色
  const getAnchorColor = (proficiency: number) => {
    if (proficiency >= 0.8) return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30';
    if (proficiency >= 0.6) return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30';
    if (proficiency >= 0.4) return 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30';
    return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30';
  };

  // 获取日期锚点样式 - 现代卡片设计
  const getDateAnchorStyle = (dayData: any, isHovered: boolean, isSelected: boolean) => {
    const totalMeaningBlocks = dayData.anchors.reduce((sum: number, anchor: any) => 
      sum + anchor.meaning_blocks.length, 0);
    
    let intensity = 0;
    if (totalMeaningBlocks > 15) intensity = 1.0;
    else if (totalMeaningBlocks > 8) intensity = 0.8;
    else if (totalMeaningBlocks > 3) intensity = 0.6;
    else if (totalMeaningBlocks > 0) intensity = 0.3;

    // 现代化颜色方案 - 更简洁的蓝色调
    let bgColor = 'rgba(15, 23, 42, 0.9)';
    let borderColor = 'rgba(148, 163, 184, 0.2)';
    let glowColor = 'rgba(148, 163, 184, 0.3)';
    
    if (intensity > 0) {
      if (intensity <= 0.3) {
        bgColor = 'rgba(30, 58, 138, 0.2)';
        borderColor = 'rgba(59, 130, 246, 0.3)';
        glowColor = 'rgba(59, 130, 246, 0.4)';
      } else if (intensity <= 0.6) {
        bgColor = 'rgba(30, 58, 138, 0.3)';
        borderColor = 'rgba(59, 130, 246, 0.4)';
        glowColor = 'rgba(59, 130, 246, 0.5)';
      } else if (intensity <= 0.8) {
        bgColor = 'rgba(30, 58, 138, 0.4)';
        borderColor = 'rgba(59, 130, 246, 0.5)';
        glowColor = 'rgba(59, 130, 246, 0.6)';
      } else {
        bgColor = 'rgba(30, 58, 138, 0.5)';
        borderColor = 'rgba(59, 130, 246, 0.6)';
        glowColor = 'rgba(59, 130, 246, 0.7)';
      }
    }
    
    // 选中状态的特殊效果
    if (isSelected) {
      borderColor = 'rgba(34, 197, 94, 0.8)';
      glowColor = 'rgba(34, 197, 94, 0.6)';
    }
    
    // 悬浮时的效果
    const hoverScale = isHovered ? 1.05 : 1;
    const selectedScale = isSelected ? 1.1 : 1;
    const finalScale = Math.max(hoverScale, selectedScale);
    const hoverGlow = isHovered || isSelected ? `0 0 30px ${glowColor}, 0 0 60px ${glowColor}` : `0 0 20px ${glowColor}`;
    
    return {
      backgroundColor: bgColor,
      borderColor: borderColor,
      boxShadow: `${hoverGlow}, 0 8px 32px rgba(0, 0, 0, 0.3)`,
      transform: `scale(${finalScale})`,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
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
    
    // 统计单词和短语
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

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing bg-gradient-to-br from-slate-900/50 via-purple-900/30 to-slate-900/50 rounded-lg"
    >
      {/* 增加背景粒子数量 */}
      <Particles
        className="absolute inset-0"
        quantity={200}
        staticity={30}
        ease={50}
        size={0.5}
        color="#ffffff"
        vx={isDragging ? x.get() * 0.01 : 0}
        vy={isDragging ? y.get() * 0.01 : 0}
      />

      {/* SVG 连接线层 - 低层级 */}
      <svg 
        className="absolute inset-0 pointer-events-none z-0"
        style={{ 
          width: '100%', 
          height: '100%'
        }}
      >
        <defs>
          {/* 基础连接线渐变 */}
          <linearGradient id="baseLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
          
          {/* 选中状态基础线渐变 */}
          <linearGradient id="selectedBaseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
          </linearGradient>
          
          {/* 辉光效果滤镜 */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 连接线组 - 使用 motion.g 来同步移动 */}
        <motion.g
          style={{ x, y }}
          transition={{ type: "spring", stiffness: 1000, damping: 50 }}
        >
          {/* 渲染连接线 */}
          {days?.map((day, dayIndex) => {
            const datePosition = getDateAnchorPosition(dayIndex, days.length);
            const wordPositions = getWordAnchorPositions(day.anchors.length, datePosition);
            const isDateSelected = selectedDateAnchor === day.date;
            
            return day.anchors.map((anchor, anchorIndex) => {
              const wordPosition = wordPositions[anchorIndex];
              if (!wordPosition) return null;
              
              const pathData = generateCurvePath(datePosition, wordPosition);
              const pathId = `path-${day.date}-${anchor.id}`;
              
              return (
                <g key={`${day.date}-${anchor.id}`}>
                  {/* 隐藏的路径定义，用于粒子动画 */}
                  <path
                    id={pathId}
                    d={pathData}
                    fill="none"
                    stroke="none"
                    opacity="0"
                  />
                  
                  {/* 基础连接线 */}
                  <path
                    d={pathData}
                    stroke={isDateSelected ? "url(#selectedBaseGradient)" : "url(#baseLineGradient)"}
                    strokeWidth={isDateSelected ? "3" : "2"}
                    fill="none"
                    opacity="1"
                    filter="url(#glow)"
                  />
                  
                  {/* 选中状态的额外辉光 */}
                  {isDateSelected && (
                    <path
                      d={pathData}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                      fill="none"
                      opacity="0.8"
                      filter="url(#glow)"
                    />
                  )}
                  
                  {/* 沿路径流动的粒子 */}
                  {generateFlowingParticles(pathId, isDateSelected)}
                </g>
              );
            });
          })}
        </motion.g>
      </svg>

      <motion.div 
        className="absolute inset-0 flex items-center justify-center z-10"
        drag
        dragElastic={0}
        dragMomentum={false}
        style={{ x, y }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative w-full h-full">
          {days?.map((day, dayIndex) => {
            const datePosition = getDateAnchorPosition(dayIndex, days.length);
            const isHovered = hoveredDateAnchor === day.date;
            const isSelected = selectedDateAnchor === day.date;
            const dateStyle = getDateAnchorStyle(day, isHovered, isSelected);
            const wordPositions = getWordAnchorPositions(day.anchors.length, datePosition);
            const isTodayDate = isToday(day.date);

            return (
              <div key={day.date}>
                {/* 现代化日期锚点卡片 - 缩小版 */}
                <div
                  className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
                  style={{
                    transform: `translate(${datePosition.x}px, ${datePosition.y}px) translate(-50%, -50%)`
                  }}
                  onMouseEnter={() => setHoveredDateAnchor(day.date)}
                  onMouseLeave={() => setHoveredDateAnchor(null)}
                  onClick={() => setSelectedDateAnchor(isSelected ? null : day.date)}
                >
                  <div
                    className="w-16 h-16 rounded-xl backdrop-blur-xl border cursor-pointer relative overflow-hidden group"
                    style={dateStyle}
                  >
                    {/* 背景渐变叠加 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
                    
                    {/* 内容区域 */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-1">
                      {/* 日期数字 */}
                      <div className={`font-bold text-lg leading-none ${isTodayDate ? 'text-orange-400' : 'text-white'}`}>
                        {new Date(day.date).getDate()}
                      </div>
                      
                      {/* 月份 */}
                      <div className={`text-xs font-medium mt-0.5 ${isTodayDate ? 'text-orange-300/90' : 'text-white/70'}`}>
                        {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short' })}
                      </div>
                    </div>
                    
                    {/* 高活跃度动画环 */}
                    {day.anchors.reduce((sum, anchor) => sum + anchor.meaning_blocks.length, 0) > 15 && (
                      <div className="absolute -inset-0.5 rounded-xl border border-yellow-400/50 animate-pulse" />
                    )}
                    
                    {/* 悬浮时的光效 */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>

                {/* 围绕日期锚点的词汇锚点 */}
                {day.anchors.map((anchor, anchorIndex) => {
                  const wordPosition = wordPositions[anchorIndex];
                  if (!wordPosition) return null;
                  
                  const avgProficiency = anchor.meaning_blocks.reduce(
                    (sum: number, block: MeaningBlock) => sum + block.current_proficiency,
                    0
                  ) / anchor.meaning_blocks.length;

                  const isAnchorCreatedToday = anchor.created_at && anchor.created_at.split('T')[0] === day.date;
                  
                  // 根据距离中心的远近调整透明度和大小
                  const distanceFromCenter = Math.sqrt(
                    Math.pow(wordPosition.x - datePosition.x, 2) + 
                    Math.pow(wordPosition.y - datePosition.y, 2)
                  );
                  const maxDistance = 300;
                  const scale = Math.max(0.8, 1 - (distanceFromCenter / maxDistance) * 0.2);

                  return (
                    <div
                      key={anchor.id}
                      className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{
                        transform: `translate(${wordPosition.x}px, ${wordPosition.y}px) translate(-50%, -50%) scale(${scale})`,
                        opacity: 1
                      }}
                    >
                      <AnchorTooltip 
                        anchor={anchor} 
                        currentDate={day.date}
                        globalCollapsed={globalCollapsed}
                        onGlobalCollapsedChange={onGlobalCollapsedChange}
                      >
                        <div
                          className={`px-2.5 py-1 rounded-full backdrop-blur-sm cursor-pointer text-xs
                            ${getAnchorColor(avgProficiency)}
                            border transition-all duration-200 shadow-md hover:shadow-lg
                            flex items-center gap-1 hover:scale-110 hover:z-30
                            ${isAnchorCreatedToday ? 'ring-1 ring-green-400/50 shadow-green-400/20' : ''}`}
                        >
                          <span className={`${isAnchorCreatedToday ? 'text-green-200' : 'text-white/90'} text-xs font-medium`}>
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

      {/* 信息图例面板 - 右下角 */}
      {selectedDayInfo && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 min-w-72 shadow-2xl">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-100 font-medium text-base">
                {new Date(selectedDayInfo.date).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short'
                })}
              </h3>
              <button
                onClick={() => setSelectedDateAnchor(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            
            {/* 锚点分布 - 分隔条 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm font-medium">锚点分布</span>
                <span className="text-slate-100 text-sm font-semibold">{selectedDayInfo.totalAnchors}</span>
              </div>
              
              {/* 比例分隔条 */}
              <div className="h-6 bg-slate-800 rounded-lg overflow-hidden flex">
                {/* 单词部分 */}
                {selectedDayInfo.words > 0 && (
                  <div 
                    className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white"
                    style={{ 
                      width: `${(selectedDayInfo.words / selectedDayInfo.totalAnchors) * 100}%`,
                      minWidth: selectedDayInfo.words > 0 ? '24px' : '0'
                    }}
                  >
                    {selectedDayInfo.words}
                  </div>
                )}
                
                {/* 短语部分 */}
                {selectedDayInfo.phrases > 0 && (
                  <div 
                    className="bg-indigo-500 flex items-center justify-center text-xs font-medium text-white"
                    style={{ 
                      width: `${(selectedDayInfo.phrases / selectedDayInfo.totalAnchors) * 100}%`,
                      minWidth: selectedDayInfo.phrases > 0 ? '24px' : '0'
                    }}
                  >
                    {selectedDayInfo.phrases}
                  </div>
                )}
              </div>
              
              {/* 图例 */}
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-slate-400">单词</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span className="text-slate-400">短语</span>
                </div>
              </div>
            </div>
            
            {/* 学习数据 - 紧凑网格 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-slate-400 text-xs mb-1">含义块</div>
                <div className="text-slate-100 text-lg font-semibold">{selectedDayInfo.totalMeaningBlocks}</div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-slate-400 text-xs mb-1">例句</div>
                <div className="text-slate-100 text-lg font-semibold">{selectedDayInfo.totalContexts}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm text-center">
        <div>拖动画布探索锚点网络 • 点击日期查看详情</div>
        <div className="text-xs text-white/40 mt-1">
          {days.length} 个日期 • {days.reduce((sum, day) => sum + day.anchors.length, 0)} 个词汇
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