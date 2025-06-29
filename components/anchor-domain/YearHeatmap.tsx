'use client';

import { useState } from 'react';
import { TimeDomain } from '@/types/anchor';

interface YearHeatmapProps {
  timeDomains: TimeDomain[];
  onPeriodSelect: (startDate: string, endDate: string) => void;
  selectedPeriod?: { start: string; end: string } | null;
}

export function YearHeatmap({ timeDomains, onPeriodSelect, selectedPeriod }: YearHeatmapProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // 生成半年(180天)的数据
  const generateHalfYearData = () => {
    const today = new Date();
    const halfYearData = [];
    
    // 从半年前开始
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      // 查找该日期的数据
      let dayData = null;
      for (const domain of timeDomains) {
        const found = domain.days?.find(day => day.date === dateString);
        if (found) {
          dayData = found;
          break;
        }
      }
      
      const totalMeaningBlocks = dayData?.anchors?.reduce((sum, anchor) => 
        sum + (anchor.meaning_blocks?.length || 0), 0) || 0;
      
      halfYearData.push({
        date: dateString,
        dayOfWeek: date.getDay(), // 0=周日, 1=周一...
        month: date.getMonth(),
        day: date.getDate(),
        totalAnchors: dayData?.anchors?.length || 0,
        totalMeaningBlocks,
        intensity: getIntensity(totalMeaningBlocks)
      });
    }
    
    return halfYearData;
  };

  // 计算强度等级 (0-4)
  const getIntensity = (count: number) => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  };

  // 获取颜色
  const getColor = (intensity: number) => {
    const colors = [
      '#1a1a2e', // 0: 无活动
      '#4a90e2', // 1: 低活动
      '#7b68ee', // 2: 中活动  
      '#ff6b6b', // 3: 高活动
      '#ffd93d'  // 4: 超高活动
    ];
    return colors[intensity];
  };

  // 按5天分组并找到有数据的时间段
  const getDataPeriods = () => {
    const halfYearData = generateHalfYearData();
    const periods = [];
    
    for (let i = 0; i < halfYearData.length; i += 5) {
      const periodData = halfYearData.slice(i, i + 5);
      const hasData = periodData.some(day => day.totalMeaningBlocks > 0);
      
      if (hasData) {
        periods.push({
          startDate: periodData[0].date,
          endDate: periodData[periodData.length - 1].date,
          totalActivity: periodData.reduce((sum, day) => sum + day.totalMeaningBlocks, 0),
          days: periodData.filter(day => day.totalMeaningBlocks > 0)
        });
      }
    }
    
    return periods;
  };

  const halfYearData = generateHalfYearData();
  const dataPeriods = getDataPeriods();
  
  // 按月分组数据
  const groupByMonth = () => {
    const monthGroups: { [key: string]: any[] } = {};
    
    halfYearData.forEach(day => {
      const monthKey = `${new Date(day.date).getFullYear()}-${day.month}`;
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(day);
    });
    
    return monthGroups;
  };

  // 按周分组月内数据
  const groupByWeeksInMonth = (monthData: any[]) => {
    const weeks: any[][] = [];
    let currentWeek: any[] = [];
    
    monthData.forEach((day, index) => {
      if (index === 0) {
        // 第一天，填充前面的空位
        for (let i = 0; i < day.dayOfWeek; i++) {
          currentWeek.push(null);
        }
      }
      
      currentWeek.push(day);
      
      if (day.dayOfWeek === 6 || index === monthData.length - 1) {
        // 周六或最后一天，结束当前周
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks;
  };

  const monthGroups = groupByMonth();
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white/90 text-sm font-medium">学习活动热力图</h3>
        <div className="text-white/60 text-xs">
          过去半年 • {dataPeriods.length}个活跃时间段
        </div>
      </div>

      {/* 热力图网格 - 按月分块 */}
      <div className="space-y-4 max-h-64 overflow-y-auto">
        {Object.entries(monthGroups).reverse().map(([monthKey, monthData]) => {
          const monthDate = new Date(monthData[0].date);
          const monthName = monthNames[monthDate.getMonth()];
          const weeks = groupByWeeksInMonth(monthData);
          
          return (
            <div key={monthKey} className="bg-black/20 rounded-md p-2 border border-white/5">
              {/* 月份标题 */}
              <div className="text-white/70 text-xs font-medium mb-2 text-center">
                {monthDate.getFullYear()}年{monthName}
              </div>
              
              {/* 星期标签 */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayNames.map(dayName => (
                  <div key={dayName} className="text-white/50 text-xs text-center w-4">
                    {dayName}
                  </div>
                ))}
              </div>
              
              {/* 日期网格 */}
              <div className="space-y-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7 gap-1">
                    {week.map((day, dayIndex) => {
                      if (!day) {
                        return <div key={dayIndex} className="w-4 h-4" />;
                      }
                      
                      const isHovered = hoveredDate === day.date;
                      const isInSelectedPeriod = selectedPeriod && 
                        day.date >= selectedPeriod.start && 
                        day.date <= selectedPeriod.end;
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`w-4 h-4 rounded-sm cursor-pointer transition-all duration-200 relative ${
                            isHovered ? 'scale-125 z-10' : ''
                          } ${
                            isInSelectedPeriod ? 'ring-1 ring-white/60' : ''
                          }`}
                          style={{ 
                            backgroundColor: getColor(day.intensity),
                            boxShadow: isHovered ? `0 0 8px ${getColor(day.intensity)}` : 'none'
                          }}
                          onMouseEnter={() => setHoveredDate(day.date)}
                          onMouseLeave={() => setHoveredDate(null)}
                          title={`${day.date}: ${day.totalMeaningBlocks} 个含义`}
                        >
                          {/* 日期数字 */}
                          {day.intensity > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-white text-xs font-bold opacity-60">
                                {day.day}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 活跃时间段列表 */}
      <div className="space-y-1 max-h-24 overflow-y-auto mt-4">
        <div className="text-white/60 text-xs mb-2">活跃时间段 (点击查看详情):</div>
        {dataPeriods.slice(0, 5).map((period, index) => {
          const isSelected = selectedPeriod && 
            selectedPeriod.start === period.startDate && 
            selectedPeriod.end === period.endDate;
          
          return (
            <div
              key={index}
              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                isSelected 
                  ? 'bg-blue-500/30 border border-blue-500/50' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
              onClick={() => onPeriodSelect(period.startDate, period.endDate)}
            >
              <div className="text-white/80">
                {new Date(period.startDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} - {' '}
                {new Date(period.endDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">
                  {period.days.length}天 • {period.totalActivity}个含义
                </span>
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getColor(Math.min(4, Math.floor(period.totalActivity / 5))) }}
                />
              </div>
            </div>
          );
        })}
        {dataPeriods.length > 5 && (
          <div className="text-white/40 text-xs text-center py-1">
            还有 {dataPeriods.length - 5} 个时间段...
          </div>
        )}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
        <div className="text-white/60 text-xs">活跃度:</div>
        <div className="flex items-center gap-1">
          <span className="text-white/50 text-xs mr-1">少</span>
          {[0, 1, 2, 3, 4].map(intensity => (
            <div
              key={intensity}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: getColor(intensity) }}
            />
          ))}
          <span className="text-white/50 text-xs ml-1">多</span>
        </div>
      </div>

      {/* 悬浮信息 */}
      {hoveredDate && (
        <div className="absolute z-50 bg-black/90 backdrop-blur-sm rounded-lg p-2 pointer-events-none border border-white/20">
          <div className="text-white text-xs">
            {new Date(hoveredDate).toLocaleDateString('zh-CN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              weekday: 'long'
            })}
          </div>
          <div className="text-white/70 text-xs">
            {halfYearData.find(d => d.date === hoveredDate)?.totalMeaningBlocks || 0} 个新含义
          </div>
        </div>
      )}
    </div>
  );
} 