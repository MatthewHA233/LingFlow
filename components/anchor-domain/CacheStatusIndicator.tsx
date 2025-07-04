'use client';

import { useState, useEffect } from 'react';

interface CacheStatusIndicatorProps {
  timeDomains: any[];
  isFromCache: boolean;
  backgroundLoading: boolean;
}

interface PerformanceMetrics {
  totalAnchors: number;
  performanceLevel: string;
  recommendations: string[];
}

export function CacheStatusIndicator({ 
  timeDomains, 
  isFromCache, 
  backgroundLoading 
}: CacheStatusIndicatorProps) {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    // 安全地计算性能指标
    try {
      if (timeDomains && Array.isArray(timeDomains) && timeDomains.length > 0) {
        let totalAnchors = 0;
        let totalDays = 0;
        
        timeDomains.forEach(domain => {
          if (domain && domain.days && Array.isArray(domain.days)) {
            totalDays += domain.days.length;
            domain.days.forEach((day: any) => {
              if (day && day.anchors && Array.isArray(day.anchors)) {
                totalAnchors += day.anchors.length;
              }
            });
          }
        });
        
        // 性能评估
        let performanceLevel = 'excellent';
        let recommendations: string[] = [];
        
        if (totalAnchors > 2000) {
          performanceLevel = 'heavy';
          recommendations.push('考虑使用时间过滤器减少显示的数据量');
          recommendations.push('建议分页浏览以提升性能');
        } else if (totalAnchors > 1000) {
          performanceLevel = 'moderate';
          recommendations.push('数据量较大，已启用性能优化');
        } else if (totalAnchors > 500) {
          performanceLevel = 'light';
          recommendations.push('当前性能表现良好');
        } else {
          recommendations.push('性能表现极佳');
    }
        
        if (totalDays > 100) {
          recommendations.push('建议缩小时间范围以提升响应速度');
        }
        
        setPerformanceMetrics({
          totalAnchors,
          performanceLevel,
          recommendations
        });
      } else {
        setPerformanceMetrics(null);
      }
    } catch (error) {
      console.warn('计算性能指标时出错:', error);
      setPerformanceMetrics(null);
    }
  }, [timeDomains]);

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'light': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'moderate': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'heavy': return 'text-red-400 bg-red-500/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getPerformanceLabel = (level: string) => {
    switch (level) {
      case 'excellent': return '极佳';
      case 'light': return '良好';
      case 'moderate': return '适中';
      case 'heavy': return '较重';
      default: return '未知';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* 缓存状态 */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          isFromCache ? 'bg-green-500 animate-pulse' : 
          backgroundLoading ? 'bg-yellow-500 animate-pulse' : 
          'bg-blue-500'
        }`} />
        <span className="text-xs text-white/70">
          {isFromCache ? '缓存' : backgroundLoading ? '更新中' : '实时'}
        </span>
      </div>

      {/* 性能指标 */}
      {performanceMetrics && (
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-xs border ${getPerformanceColor(performanceMetrics.performanceLevel)}`}>
            性能: {getPerformanceLabel(performanceMetrics.performanceLevel)}
          </div>
          
          {/* 数据统计 */}
          <div className="text-xs text-white/60">
            {performanceMetrics.totalAnchors.toLocaleString()} 个锚点
          </div>
          
          {/* 性能警告 */}
          {performanceMetrics.performanceLevel === 'heavy' && (
            <div className="text-xs text-red-400 animate-pulse">
              ⚠️ 数据量大
                  </div>
                )}
          
          {/* 性能建议tooltip */}
          {performanceMetrics.recommendations && performanceMetrics.recommendations.length > 0 && (
            <div 
              className="text-xs text-white/50 cursor-help" 
              title={performanceMetrics.recommendations.join('\n')}
            >
              💡 建议
                  </div>
                )}
              </div>
            )}
          </div>
  );
} 