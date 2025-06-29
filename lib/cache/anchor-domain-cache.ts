// 锚点域数据缓存管理器
import type { TimeDomain, SpaceDomain } from '@/types/anchor';

interface CacheData {
  timeDomains: TimeDomain[];
  spaceDomains: SpaceDomain[];
  timestamp: number;
  version: string;
}

interface CacheOptions {
  maxAge?: number; // 缓存最大存活时间（毫秒），默认5分钟
  version?: string; // 数据版本，用于缓存失效
}

class AnchorDomainCache {
  private readonly CACHE_KEY = 'lingflow_anchor_domain_cache';
  private readonly DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5分钟

  /**
   * 获取缓存数据
   */
  get(options: CacheOptions = {}): CacheData | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const data: CacheData = JSON.parse(cached);
      const maxAge = options.maxAge || this.DEFAULT_MAX_AGE;
      const now = Date.now();

      // 检查缓存是否过期
      if (now - data.timestamp > maxAge) {
        this.clear();
        return null;
      }

      // 检查版本是否匹配
      if (options.version && data.version !== options.version) {
        this.clear();
        return null;
      }

      return data;
    } catch (error) {
      console.warn('读取锚点域缓存失败:', error);
      this.clear();
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  set(timeDomains: TimeDomain[], spaceDomains: SpaceDomain[], options: CacheOptions = {}): void {
    try {
      const cacheData: CacheData = {
        timeDomains,
        spaceDomains,
        timestamp: Date.now(),
        version: options.version || '1.0'
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('保存锚点域缓存失败:', error);
      // 如果存储失败（可能是空间不足），清理旧缓存
      this.clear();
    }
  }

  /**
   * 清除缓存
   */
  clear(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.warn('清除锚点域缓存失败:', error);
    }
  }

  /**
   * 检查缓存是否存在且有效
   */
  isValid(options: CacheOptions = {}): boolean {
    return this.get(options) !== null;
  }

  /**
   * 获取缓存信息（用于调试）
   */
  getInfo(): { exists: boolean; age?: number; size?: number } {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return { exists: false };

      const data: CacheData = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      const size = new Blob([cached]).size;

      return { exists: true, age, size };
    } catch {
      return { exists: false };
    }
  }
}

// 导出单例实例
export const anchorDomainCache = new AnchorDomainCache();

// 导出类型
export type { CacheData, CacheOptions }; 