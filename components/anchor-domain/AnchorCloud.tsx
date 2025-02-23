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

export function AnchorCloud({ days }: AnchorCloudProps) {
  // 使用 spring 让移动更流畅
  const x = useSpring(0, { stiffness: 1000, damping: 50 });
  const y = useSpring(0, { stiffness: 1000, damping: 50 });
  
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'auto';
  }, []);

  // 使用 CSS transform 替代 framer-motion 动画
  const containerStyle = {
    transform: 'translate3d(0,0,0)', // 启用硬件加速
    willChange: 'transform', // 提示浏览器优化
  };

  // 计算每个锚点的颜色
  const getAnchorColor = (proficiency: number) => {
    if (proficiency >= 80) return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30';
    if (proficiency >= 60) return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30';
    if (proficiency >= 40) return 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30';
    return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30';
  };

  // 修改位置计算逻辑
  const getPosition = (index: number) => {
    const ITEMS_PER_ROW = 5;
    const HORIZONTAL_GAP = 220;
    const VERTICAL_GAP = 150;
    const START_X = -450;
    const START_Y = -150;

    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const isEvenRow = row % 2 === 0;
    
    const x = isEvenRow 
      ? START_X + (col * HORIZONTAL_GAP)
      : START_X + ((ITEMS_PER_ROW - 1 - col) * HORIZONTAL_GAP);
    
    const y = START_Y + (row * VERTICAL_GAP);

    return { x, y };
  };

  return (
    <div 
      className="relative w-full h-[calc(100vh-12rem)] overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
        ...containerStyle
      }}
    >
      {/* 粒子背景 */}
      <Particles
        className="absolute inset-0"
        quantity={200}
        staticity={30}
        ease={50}
        size={0.5}
        color="#ffffff"
        vx={isDragging ? x.get() * 0.02 : 0}
        vy={isDragging ? y.get() * 0.02 : 0}
      />

      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        drag
        dragElastic={0}
        dragMomentum={false}
        style={{ x, y, ...containerStyle }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative w-full max-w-7xl h-full">
          {days?.map((day, dayIndex) => {
            const { x: posX, y: posY } = getPosition(dayIndex);

            return (
              <div
                key={day.date} 
                className={`absolute left-1/2 top-1/2 transition-opacity duration-300
                  ${isDragging ? 'opacity-90' : 'opacity-100'}`}
                style={{
                  transform: `translate3d(${posX}px, ${posY}px, 0) translate(-50%, -50%)`,
                }}
              >
                <div className="text-white/60 text-sm mb-4 text-center backdrop-blur-sm px-3 py-1 rounded-full bg-white/5">
                  {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex flex-wrap gap-3 justify-center" 
                  style={{ 
                    width: '220px',
                    maxHeight: '150px',
                    transform: 'translate3d(0,0,0)',
                  }}
                >
                  {day.anchors.map((anchor, anchorIndex) => {
                    const avgProficiency = anchor.meaningBlocks.reduce(
                      (sum: number, block: MeaningBlock) => sum + block.proficiency,
                      0
                    ) / anchor.meaningBlocks.length;

                    return (
                      <AnchorTooltip key={anchor.word} anchor={anchor}>
                        <div
                          className={`px-3 py-1.5 rounded-full backdrop-blur-sm cursor-pointer text-xs
                            ${getAnchorColor(avgProficiency)}
                            border transition-transform duration-200 shadow-lg hover:shadow-xl
                            flex items-center gap-1.5 hover:scale-110`}
                          style={{ transform: 'translate3d(0,0,0)' }}
                        >
                          <span className="text-white/90">{anchor.word}</span>
                          {anchor.meaningBlocks.some((b: MeaningBlock) => new Date(b.nextReviewDate!) <= new Date()) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500/80 animate-pulse" />
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

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
        拖动画布探索更多锚点
      </div>
    </div>
  );
} 