import { useState, useEffect } from 'react';
import { TimeDomain, SpaceDomain } from '@/types/anchor';
import { anchorDomainCache } from '@/lib/cache/anchor-domain-cache';
import { toast } from 'sonner';

interface UseAnchorDomainDataResult {
  timeDomains: TimeDomain[];
  spaceDomains: SpaceDomain[];
  loading: boolean;
  isFromCache: boolean;
  backgroundLoading: boolean;
  refreshData: () => Promise<void>;
  clearCache: () => void;
}

// 获取时间域数据
async function getTimeDomainData(): Promise<TimeDomain[]> {
  try {
    const { supabase } = await import('@/lib/supabase-client');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('用户未登录');
    }

    const response = await fetch('/api/anchors/stats?type=time&groupBy=day', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取时间域数据失败');
    }

    const result = await response.json();
    return result.data?.timeDomains || [];
  } catch (error) {
    console.error('获取时间域数据失败:', error);
    return [];
  }
}

// 获取空间域数据
async function getSpaceDomainData(): Promise<SpaceDomain[]> {
  try {
    const { supabase } = await import('@/lib/supabase-client');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('用户未登录');
    }

    const response = await fetch('/api/anchors/stats?type=space', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取空间域数据失败');
    }

    const result = await response.json();
    return result.data?.spaceDomains || [];
  } catch (error) {
    console.error('获取空间域数据失败:', error);
    return [];
  }
}

export function useAnchorDomainData(
  session: any,
  authLoading: boolean
): UseAnchorDomainDataResult {
  const [timeDomains, setTimeDomains] = useState<TimeDomain[]>([]);
  const [spaceDomains, setSpaceDomains] = useState<SpaceDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);

  // 加载数据的核心逻辑
  const loadData = async (forceRefresh = false) => {
    if (authLoading || !session) {
      return;
    }

    // 如果强制刷新，跳过缓存
    if (!forceRefresh) {
      // 1. 先尝试从缓存加载
      const cached = anchorDomainCache.get();
      if (cached) {
        console.log('🚀 从缓存加载锚点域数据');
        setTimeDomains(cached.timeDomains);
        setSpaceDomains(cached.spaceDomains);
        setIsFromCache(true);
        setLoading(false);
        
        // 显示缓存数据后，在后台偷偷更新
        setBackgroundLoading(true);
        try {
          const [timeData, spaceData] = await Promise.all([
            getTimeDomainData(),
            getSpaceDomainData()
          ]);
          
          // 检查数据是否有变化（使用更精确的比较）
          const timeChanged = JSON.stringify(timeData) !== JSON.stringify(cached.timeDomains);
          const spaceChanged = JSON.stringify(spaceData) !== JSON.stringify(cached.spaceDomains);
          
          if (timeChanged || spaceChanged) {
            console.log('🔄 检测到数据更新，刷新显示');
            setTimeDomains(timeData);
            setSpaceDomains(spaceData);
            
            // 更新缓存
            anchorDomainCache.set(timeData, spaceData);
            
            // 可选：显示更新提示（仅在有实质性变化时）
            const newItemsCount = timeData.reduce((sum, domain) => 
              sum + domain.days.reduce((daySum, day) => daySum + day.anchors.length, 0), 0
            );
            const cachedItemsCount = cached.timeDomains.reduce((sum, domain) => 
              sum + domain.days.reduce((daySum, day) => daySum + day.anchors.length, 0), 0
            );
            
            if (newItemsCount > cachedItemsCount) {
              toast.success(`发现 ${newItemsCount - cachedItemsCount} 个新锚点`, { 
                duration: 3000,
                description: '数据已自动更新'
              });
            }
          } else {
            console.log('✅ 数据无变化，保持缓存显示');
          }
        } catch (error) {
          console.error('❌ 后台更新数据失败:', error);
          // 静默失败，继续显示缓存数据
        } finally {
          setBackgroundLoading(false);
          setIsFromCache(false);
        }
        return;
      }
    }

    // 2. 没有缓存或强制刷新，正常加载
    console.log(forceRefresh ? '🔄 强制刷新数据' : '📡 没有缓存，正常加载数据');
    try {
      setLoading(true);
      const [timeData, spaceData] = await Promise.all([
        getTimeDomainData(),
        getSpaceDomainData()
      ]);
      
      setTimeDomains(timeData);
      setSpaceDomains(spaceData);
      
      // 保存到缓存
      anchorDomainCache.set(timeData, spaceData);
      
      if (forceRefresh) {
        toast.success('数据已刷新');
      }
    } catch (error) {
      console.error('加载锚点域数据失败:', error);
      toast.error('加载数据失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const refreshData = async () => {
    await loadData(true);
  };

  // 清除缓存
  const clearCache = () => {
    anchorDomainCache.clear();
    toast.success('缓存已清除');
  };

  useEffect(() => {
    loadData();
  }, [session, authLoading]);

  return {
    timeDomains,
    spaceDomains,
    loading,
    isFromCache,
    backgroundLoading,
    refreshData,
    clearCache
  };
} 