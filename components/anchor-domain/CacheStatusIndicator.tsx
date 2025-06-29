import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database, Wifi, WifiOff, Clock, Zap } from 'lucide-react';
import { anchorDomainCache } from '@/lib/cache/anchor-domain-cache';
import { useEffect, useState } from 'react';

interface CacheStatusIndicatorProps {
  isFromCache: boolean;
  backgroundLoading: boolean;
  loading: boolean;
}

export function CacheStatusIndicator({ 
  isFromCache, 
  backgroundLoading, 
  loading 
}: CacheStatusIndicatorProps) {
  const [cacheInfo, setCacheInfo] = useState<{
    exists: boolean;
    age?: number;
    size?: number;
  }>({ exists: false });

  useEffect(() => {
    const updateCacheInfo = () => {
      setCacheInfo(anchorDomainCache.getInfo());
    };

    updateCacheInfo();
    const interval = setInterval(updateCacheInfo, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, [isFromCache, backgroundLoading]);

  const formatAge = (age: number) => {
    const minutes = Math.floor(age / 60000);
    const seconds = Math.floor((age % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}分${seconds}秒前`;
    }
    return `${seconds}秒前`;
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getStatusInfo = () => {
    if (loading) {
      return {
        icon: <Wifi className="w-3 h-3" />,
        text: '加载中',
        variant: 'secondary' as const,
        description: '正在从服务器获取最新数据'
      };
    }

    if (backgroundLoading) {
      return {
        icon: <Zap className="w-3 h-3 animate-pulse" />,
        text: '更新中',
        variant: 'default' as const,
        description: '正在后台检查数据更新'
      };
    }

    if (isFromCache) {
      return {
        icon: <Database className="w-3 h-3" />,
        text: '缓存',
        variant: 'outline' as const,
        description: `显示缓存数据，${cacheInfo.age ? formatAge(cacheInfo.age) : '刚刚'}缓存`
      };
    }

    if (cacheInfo.exists) {
      return {
        icon: <Wifi className="w-3 h-3" />,
        text: '最新',
        variant: 'default' as const,
        description: '显示最新数据'
      };
    }

    return {
      icon: <WifiOff className="w-3 h-3" />,
      text: '离线',
      variant: 'destructive' as const,
      description: '无法连接到服务器'
    };
  };

  const status = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={status.variant}
            className="flex items-center gap-1.5 text-xs cursor-help"
          >
            {status.icon}
            {status.text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{status.description}</p>
            {cacheInfo.exists && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {cacheInfo.age && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    缓存时间：{formatAge(cacheInfo.age)}
                  </div>
                )}
                {cacheInfo.size && (
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    缓存大小：{formatSize(cacheInfo.size)}
                  </div>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 