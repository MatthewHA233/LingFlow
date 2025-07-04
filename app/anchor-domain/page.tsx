'use client';

import { useState, useCallback, useEffect } from 'react';
import { TimeDomain } from '@/types/anchor';
import { CacheStatusIndicator } from '@/components/anchor-domain/CacheStatusIndicator';
import { YearHeatmap } from '@/components/anchor-domain/YearHeatmap';
import { MultiDateAnchorCloud } from '@/components/anchor-domain/MultiDateAnchorCloud';
import { useAnchorDomainData } from '@/hooks/useAnchorDomainData';
import { useAuthStore } from '@/stores/auth';

export default function AnchorDomainPage() {
  const { session, loading: authLoading } = useAuthStore();
  const [timeDomains, setTimeDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<{start: string, end: string} | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [heatmapExpanded, setHeatmapExpanded] = useState(false);
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 每页显示的日期数量

  const {
    timeDomains: dataTimeDomains,
    loading: dataLoading,
    isFromCache: dataIsFromCache,
    backgroundLoading: dataBackgroundLoading,
    refreshData,
    clearCache
  } = useAnchorDomainData(session, authLoading);

  // 从本地存储读取释义显示偏好
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem('anchor-domain-collapsed');
      if (savedCollapsed !== null) {
        setGlobalCollapsed(JSON.parse(savedCollapsed));
      } else {
        // 默认状态：显示释义（false）
        setGlobalCollapsed(false);
      }
    } catch (error) {
      console.error('读取释义显示偏好失败:', error);
      // 出错时使用默认状态
      setGlobalCollapsed(false);
    }
  }, []);

  // 保存释义显示偏好到本地存储
  const handleGlobalCollapsedChange = useCallback((collapsed: boolean | undefined) => {
    setGlobalCollapsed(collapsed);
    try {
      if (collapsed !== undefined) {
        localStorage.setItem('anchor-domain-collapsed', JSON.stringify(collapsed));
      }
    } catch (error) {
      console.error('保存释义显示偏好失败:', error);
    }
  }, []);

  // 获取最近的活跃时间段
  const getRecentActivePeriod = useCallback(() => {
    if (!dataTimeDomains || dataTimeDomains.length === 0) return null;
    
    // 收集所有有数据的日期
    const allActiveDays: any[] = [];
    for (const domain of dataTimeDomains) {
      if (domain.days) {
        const activeDays = domain.days.filter((day: any) => 
          day.anchors && day.anchors.length > 0
        );
        allActiveDays.push(...activeDays);
      }
    }
    
    if (allActiveDays.length === 0) return null;
    
    // 按日期排序，获取最近的日期
    allActiveDays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // 按5天分组，找到最近的活跃时间段
    const today = new Date();
    const halfYearAgo = new Date(today);
    halfYearAgo.setDate(today.getDate() - 180);
    
    // 生成最近180天的所有日期
    const recentDates = [];
    for (let i = 0; i < 180; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      recentDates.push(date.toISOString().split('T')[0]);
    }
    
    // 按5天分组，找到有数据的最近时间段
    for (let i = 0; i < recentDates.length; i += 5) {
      const periodDates = recentDates.slice(i, i + 5);
      const periodHasData = periodDates.some(date => 
        allActiveDays.some((day: any) => day.date === date)
      );
      
      if (periodHasData) {
        return {
          start: periodDates[periodDates.length - 1], // 最早日期
          end: periodDates[0] // 最晚日期
        };
      }
    }
    
    return null;
  }, [dataTimeDomains]);

  // 自动选择最近的时间段
  useEffect(() => {
    if (!dataLoading && !hasAutoSelected && dataTimeDomains && dataTimeDomains.length > 0) {
      const recentPeriod = getRecentActivePeriod();
      if (recentPeriod) {
        setSelectedPeriod(recentPeriod);
        setHasAutoSelected(true);
      }
    }
  }, [dataLoading, dataTimeDomains, hasAutoSelected, getRecentActivePeriod]);

  // 处理时间段选择
  const handlePeriodSelect = useCallback((startDate: string, endDate: string) => {
    setSelectedPeriod({ start: startDate, end: endDate });
    setHeatmapExpanded(false); // 选择后收起热力图
  }, []);

  // 获取选中时间段的数据（分页优化）
  const getSelectedPeriodData = () => {
    if (!selectedPeriod || !dataTimeDomains || dataTimeDomains.length === 0) return [];
    
    const daysInPeriod = [];
    for (const domain of dataTimeDomains) {
      if (domain.days) {
        const filteredDays = domain.days.filter((day: any) => 
          day.date >= selectedPeriod.start && 
          day.date <= selectedPeriod.end &&
          day.anchors && day.anchors.length > 0
        );
        daysInPeriod.push(...filteredDays);
      }
    }
    
    // 按日期排序
    const sortedDays = daysInPeriod.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 如果数据量大于50天或总锚点数超过1000，启用分页
    const totalAnchors = sortedDays.reduce((sum, day) => sum + day.anchors.length, 0);
    const shouldPaginate = sortedDays.length > 50 || totalAnchors > 1000;
    
    if (shouldPaginate) {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return sortedDays.slice(startIndex, endIndex);
    }
    
    return sortedDays;
  };

  const selectedPeriodData = getSelectedPeriodData();
  
  // 计算分页信息
  const getAllPeriodData = () => {
    if (!selectedPeriod || !dataTimeDomains || dataTimeDomains.length === 0) return [];
    
    const daysInPeriod = [];
    for (const domain of dataTimeDomains) {
      if (domain.days) {
        const filteredDays = domain.days.filter((day: any) => 
          day.date >= selectedPeriod.start && 
          day.date <= selectedPeriod.end &&
          day.anchors && day.anchors.length > 0
        );
        daysInPeriod.push(...filteredDays);
      }
    }
    
    return daysInPeriod.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };
  
  const allPeriodData = getAllPeriodData();
  const totalPages = Math.ceil(allPeriodData.length / itemsPerPage);
  const shouldShowPagination = allPeriodData.length > 50 || allPeriodData.reduce((sum, day) => sum + day.anchors.length, 0) > 1000;

  // 快捷键支持
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // 只在锚点域页面且有数据时响应快捷键
      if (selectedPeriodData.length > 0 && event.key.toLowerCase() === 'x') {
        // 防止在输入框中触发
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          return;
        }
        event.preventDefault();
        const newCollapsed = globalCollapsed === undefined ? true : !globalCollapsed;
        handleGlobalCollapsedChange(newCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedPeriodData.length, globalCollapsed, handleGlobalCollapsedChange]);

  // 监听分页变化，重置页码当选择新时间段时
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPeriod]);

  // 认证检查
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-white/60">验证用户身份...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">请先登录</div>
          <div className="text-white/60">需要登录后才能查看锚点域</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* 顶部控制栏 */}
      <div className="sticky top-0 z-40 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-3">
          <div className="relative flex items-center justify-between">
            {/* 左侧 */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">锚点域</h1>
              <CacheStatusIndicator 
                timeDomains={dataTimeDomains}
                isFromCache={dataIsFromCache}
                backgroundLoading={dataBackgroundLoading}
              />
            </div>
            
            {/* 中间 - 时间段信息（绝对居中） */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              {selectedPeriod ? (
                <div className="text-center">
                  <div className="text-lg font-bold text-white mb-1">
                    {new Date(selectedPeriod.start).toLocaleDateString('zh-CN', {
                      month: 'long',
                      day: 'numeric'
                    })} - {new Date(selectedPeriod.end).toLocaleDateString('zh-CN', {
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="text-sm text-white/60">
                    {selectedPeriodData.length} 个活跃日期，
                    共学习 {selectedPeriodData.reduce((sum, day) => sum + day.anchors.length, 0)} 个单词，
                    新增 {selectedPeriodData.reduce((sum, day) => 
                      sum + day.anchors.reduce((anchorSum: number, anchor: any) => 
                        anchorSum + anchor.meaning_blocks.length, 0), 0)} 个含义
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-lg font-bold text-white/80 mb-1">
                    {dataLoading ? '正在加载学习数据...' : '探索你的学习宇宙'}
                  </div>
                  <div className="text-sm text-white/50">
                    {dataLoading ? '请稍候' : '点击右上角&ldquo;热力图&rdquo;按钮选择学习时间段'}
                  </div>
                </div>
              )}
            </div>
            
            {/* 右侧 */}
            <div className="flex items-center gap-2">
              {/* 全局释义控制 */}
              {selectedPeriodData.length > 0 && (
                <div className="flex items-center gap-1 mr-2">
                  <span className="text-xs text-white/60">释义:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleGlobalCollapsedChange(false)}
                      className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
                        globalCollapsed === false 
                          ? 'bg-green-600/80 text-white shadow-md' 
                          : 'bg-gray-600/50 text-white/70 hover:bg-gray-600/70'
                      }`}
                      title="显示完整释义信息 (快捷键: X)"
                    >
                      显示释义
                    </button>
                    <button
                      onClick={() => handleGlobalCollapsedChange(true)}
                      className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
                        globalCollapsed === true 
                          ? 'bg-blue-600/80 text-white shadow-md' 
                          : 'bg-gray-600/50 text-white/70 hover:bg-gray-600/70'
                      }`}
                      title="隐藏释义，只显示例句 (快捷键: X)"
                    >
                      隐藏释义
                    </button>
                  </div>
                  {globalCollapsed !== undefined && (
                    <div className="text-xs text-white/50 ml-1">
                      {globalCollapsed ? '仅例句' : '完整释义'}
                    </div>
                  )}
                </div>
              )}
              
              {/* 热力图展开按钮 */}
              <button
                onClick={() => setHeatmapExpanded(!heatmapExpanded)}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  heatmapExpanded 
                    ? 'bg-purple-600/80 text-white' 
                    : 'bg-gray-600/80 text-white hover:bg-gray-600'
                }`}
              >
                热力图
              </button>
              
              <button
                onClick={refreshData}
                disabled={dataLoading || dataBackgroundLoading}
                className="px-3 py-1.5 text-sm bg-blue-600/80 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {dataLoading || dataBackgroundLoading ? '刷新中...' : '刷新'}
              </button>
              <button
                onClick={clearCache}
                className="px-3 py-1.5 text-sm bg-gray-600/80 text-white rounded hover:bg-gray-600 transition-colors"
              >
                清缓存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 relative">
        {/* 锚点域容器 - 铺满剩余页面 */}
        <div className="absolute inset-0">
          {dataLoading && !dataTimeDomains.length ? (
            // 初始加载状态
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-white/60">正在加载学习数据...</div>
            </div>
          ) : selectedPeriodData.length > 0 ? (
            // 显示选中时间段的数据
            <MultiDateAnchorCloud 
              days={selectedPeriodData} 
              globalCollapsed={globalCollapsed}
              onGlobalCollapsedChange={handleGlobalCollapsedChange}
            />
          ) : (
            // 无数据状态
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-4">🌌</div>
              <div className="text-white/60 text-center">
                <div className="text-lg mb-2">
                  {selectedPeriod ? '选中的时间段没有学习记录' : '还没有学习记录'}
                </div>
                <div className="text-sm">
                  {selectedPeriod ? '尝试选择其他时间段' : '开始你的学习之旅，创建第一个锚点吧！'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 热力图展开面板 */}
        <div className={`absolute top-4 right-4 z-30 transition-all duration-300 ${
          heatmapExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}>
          <div className="w-80 max-h-96">
            <YearHeatmap
              timeDomains={dataTimeDomains || []}
              onPeriodSelect={handlePeriodSelect}
              selectedPeriod={selectedPeriod}
            />
          </div>
        </div>

        {/* 数据统计和分页控制 */}
        {selectedPeriodData.length > 0 && (
          <div className="absolute bottom-4 left-4 z-30">
            <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 p-3">
              <div className="flex items-center gap-4">
                <div className="text-sm text-white/70">
                  {shouldShowPagination ? (
                    <>显示 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, allPeriodData.length)} / {allPeriodData.length} 天</>
                  ) : (
                    <>共 {selectedPeriodData.length} 天</>
                  )}
                  <span className="mx-2">•</span>
                  {selectedPeriodData.reduce((sum, day) => sum + day.anchors.length, 0)} 个锚点
                </div>
                
                {/* 分页控制 */}
                {shouldShowPagination && totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                    >
                      上一页
                    </button>
                    <span className="text-xs text-white/70">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                    >
                      下一页
                    </button>
                  </div>
                )}
                
                {/* 性能指示器 */}
                <div className="flex items-center gap-2 text-xs">
                  {selectedPeriodData.reduce((sum, day) => sum + day.anchors.length, 0) > 500 && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-200 rounded border border-yellow-500/30">
                      大数据集
                    </span>
                  )}
                  {shouldShowPagination && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-500/30">
                      分页模式
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 