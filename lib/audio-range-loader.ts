/**
 * 音频 Range 分片加载器
 * 负责智能加载和缓存音频分片，支持自适应预加载
 */

interface ChunkInfo {
  start: number;
  end: number;
  data: ArrayBuffer;
  timestamp: number;
  retryCount: number;
}

interface LoadMetrics {
  totalLoaded: number;
  loadSpeed: number; // bytes per second
  avgChunkLoadTime: number; // ms
  cacheHitRate: number;
  failedLoads: number;
}

interface RangeLoaderConfig {
  chunkSize?: number;
  maxCacheSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  preloadStrategy?: 'aggressive' | 'adaptive' | 'conservative';
  minPreloadChunks?: number;
  maxPreloadChunks?: number;
}

export class AudioRangeLoader {
  private config: Required<RangeLoaderConfig>;
  private chunkCache = new Map<string, ChunkInfo>();
  private rangeSupport = new Map<string, boolean>();
  private loadingChunks = new Map<string, Promise<ArrayBuffer | null>>();
  private metrics: LoadMetrics = {
    totalLoaded: 0,
    loadSpeed: 0,
    avgChunkLoadTime: 0,
    cacheHitRate: 0,
    failedLoads: 0
  };
  private loadTimes: number[] = [];
  private lastCleanupTime = Date.now();

  constructor(config: RangeLoaderConfig = {}) {
    this.config = {
      chunkSize: config.chunkSize || 512 * 1024, // 512KB
      maxCacheSize: config.maxCacheSize || 50 * 1024 * 1024, // 50MB
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      preloadStrategy: config.preloadStrategy || 'adaptive',
      minPreloadChunks: config.minPreloadChunks || 2,
      maxPreloadChunks: config.maxPreloadChunks || 5
    };
  }

  /**
   * 检测 URL 是否支持 Range 请求
   */
  async checkRangeSupport(url: string): Promise<boolean> {
    // 使用规范化的 URL 作为缓存键
    const cacheKey = this.normalizeUrl(url);
    
    if (this.rangeSupport.has(cacheKey)) {
      return this.rangeSupport.get(cacheKey)!;
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'Range': 'bytes=0-1' }
      });

      const supportsRange = 
        response.status === 206 || 
        response.headers.get('accept-ranges') === 'bytes';

      this.rangeSupport.set(cacheKey, supportsRange);
      console.log(`[RangeLoader] Range support for ${url}: ${supportsRange ? '✅' : '❌'}`);
      
      return supportsRange;
    } catch (error) {
      console.warn('[RangeLoader] Failed to check range support:', error);
      this.rangeSupport.set(cacheKey, false);
      return false;
    }
  }

  /**
   * 获取音频文件总大小
   */
  async getFileSize(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch (error) {
      console.warn('[RangeLoader] Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * 加载指定的音频分片（带重试机制）
   */
  async loadChunk(
    url: string, 
    chunkIndex: number, 
    fileSize: number
  ): Promise<ArrayBuffer | null> {
    const start = chunkIndex * this.config.chunkSize;
    const end = Math.min(start + this.config.chunkSize - 1, fileSize - 1);
    const cacheKey = this.getChunkKey(url, start, end);

    // 检查缓存
    const cached = this.chunkCache.get(cacheKey);
    if (cached) {
      this.updateCacheHitRate(true);
      console.log(`[RangeLoader] Cache hit: chunk ${chunkIndex}`);
      return cached.data;
    }

    // 检查是否正在加载
    const loading = this.loadingChunks.get(cacheKey);
    if (loading) {
      console.log(`[RangeLoader] Chunk ${chunkIndex} already loading, waiting...`);
      return loading;
    }

    // 开始加载
    const loadPromise = this.loadChunkWithRetry(url, start, end, 0);
    this.loadingChunks.set(cacheKey, loadPromise);

    try {
      const result = await loadPromise;
      this.updateCacheHitRate(false);
      return result;
    } finally {
      this.loadingChunks.delete(cacheKey);
    }
  }

  /**
   * 带重试的分片加载
   */
  private async loadChunkWithRetry(
    url: string,
    start: number,
    end: number,
    retryCount: number
  ): Promise<ArrayBuffer | null> {
    const startTime = Date.now();

    try {
      console.log(`[RangeLoader] Loading chunk: ${start}-${end} (attempt ${retryCount + 1})`);
      
      const response = await fetch(url, {
        headers: { 'Range': `bytes=${start}-${end}` }
      });

      if (response.status === 206) {
        const arrayBuffer = await response.arrayBuffer();
        const loadTime = Date.now() - startTime;
        
        // 更新加载指标
        this.updateLoadMetrics(arrayBuffer.byteLength, loadTime);
        
        // 缓存数据
        this.cacheChunk(url, start, end, arrayBuffer, retryCount);
        
        console.log(`[RangeLoader] Chunk loaded successfully in ${loadTime}ms`);
        return arrayBuffer;
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[RangeLoader] Chunk load failed:`, error);
      this.metrics.failedLoads++;

      // 重试逻辑
      if (retryCount < this.config.maxRetries) {
        console.log(`[RangeLoader] Retrying in ${this.config.retryDelay}ms...`);
        await this.delay(this.config.retryDelay * (retryCount + 1));
        return this.loadChunkWithRetry(url, start, end, retryCount + 1);
      }

      return null;
    }
  }

  /**
   * 智能预加载分片
   */
  async preloadChunks(
    url: string,
    currentPosition: number,
    duration: number,
    fileSize: number
  ): Promise<void> {
    if (!await this.checkRangeSupport(url)) {
      return;
    }

    // 计算当前分片索引
    const bytesPerMs = fileSize / duration;
    const currentByte = Math.floor(currentPosition * bytesPerMs);
    const currentChunkIndex = Math.floor(currentByte / this.config.chunkSize);

    // 根据策略确定预加载数量
    const preloadCount = this.calculatePreloadCount();
    
    // 计算需要预加载的分片范围
    const totalChunks = Math.ceil(fileSize / this.config.chunkSize);
    const startChunk = Math.max(0, currentChunkIndex - Math.floor(preloadCount / 2));
    const endChunk = Math.min(totalChunks - 1, currentChunkIndex + Math.ceil(preloadCount / 2));

    console.log(`[RangeLoader] Preloading chunks ${startChunk}-${endChunk} (current: ${currentChunkIndex})`);

    // 并行预加载
    const preloadPromises: Promise<ArrayBuffer | null>[] = [];
    for (let i = startChunk; i <= endChunk; i++) {
      preloadPromises.push(this.loadChunk(url, i, fileSize));
    }

    await Promise.allSettled(preloadPromises);
    
    // 定期清理缓存
    this.periodicCleanup();
  }

  /**
   * 根据网络状况计算预加载数量
   */
  private calculatePreloadCount(): number {
    if (this.config.preloadStrategy === 'conservative') {
      return this.config.minPreloadChunks;
    }
    
    if (this.config.preloadStrategy === 'aggressive') {
      return this.config.maxPreloadChunks;
    }

    // 自适应策略：根据加载速度调整
    if (this.metrics.avgChunkLoadTime === 0) {
      return this.config.minPreloadChunks;
    }

    // 根据平均加载时间动态调整
    if (this.metrics.avgChunkLoadTime < 200) { // 快速网络
      return this.config.maxPreloadChunks;
    } else if (this.metrics.avgChunkLoadTime < 500) { // 中速网络
      return Math.floor((this.config.minPreloadChunks + this.config.maxPreloadChunks) / 2);
    } else { // 慢速网络
      return this.config.minPreloadChunks;
    }
  }

  /**
   * 缓存分片数据
   */
  private cacheChunk(
    url: string,
    start: number,
    end: number,
    data: ArrayBuffer,
    retryCount: number
  ): void {
    const key = this.getChunkKey(url, start, end);
    
    this.chunkCache.set(key, {
      start,
      end,
      data,
      timestamp: Date.now(),
      retryCount
    });

    // 检查缓存大小
    if (this.getCacheSize() > this.config.maxCacheSize) {
      this.evictOldestChunks();
    }
  }

  /**
   * 计算缓存大小
   */
  private getCacheSize(): number {
    let size = 0;
    for (const chunk of this.chunkCache.values()) {
      size += chunk.data.byteLength;
    }
    return size;
  }

  /**
   * 清理最旧的分片（LRU）
   */
  private evictOldestChunks(): void {
    const chunks = Array.from(this.chunkCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const targetSize = this.config.maxCacheSize * 0.7; // 清理到70%
    let currentSize = this.getCacheSize();

    for (const [key, chunk] of chunks) {
      if (currentSize <= targetSize) break;
      
      currentSize -= chunk.data.byteLength;
      this.chunkCache.delete(key);
    }

    console.log(`[RangeLoader] Cache cleaned, ${this.chunkCache.size} chunks remaining`);
  }

  /**
   * 定期清理（每分钟）
   */
  private periodicCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanupTime > 60000) { // 1 minute
      this.evictOldestChunks();
      this.lastCleanupTime = now;
    }
  }

  /**
   * 更新加载指标
   */
  private updateLoadMetrics(bytesLoaded: number, loadTime: number): void {
    this.metrics.totalLoaded += bytesLoaded;
    this.loadTimes.push(loadTime);

    // 保留最近100次的加载时间
    if (this.loadTimes.length > 100) {
      this.loadTimes.shift();
    }

    // 计算平均加载时间
    this.metrics.avgChunkLoadTime = 
      this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length;

    // 计算加载速度（字节/秒）
    this.metrics.loadSpeed = bytesLoaded / (loadTime / 1000);
  }

  /**
   * 更新缓存命中率
   */
  private updateCacheHitRate(isHit: boolean): void {
    // 简单的滑动窗口实现
    const weight = 0.95;
    this.metrics.cacheHitRate = 
      this.metrics.cacheHitRate * weight + (isHit ? 1 : 0) * (1 - weight);
  }

  /**
   * 生成分片缓存键
   */
  private getChunkKey(url: string, start: number, end: number): string {
    const normalizedUrl = this.normalizeUrl(url);
    return `${normalizedUrl}:${start}-${end}`;
  }

  /**
   * 规范化 URL（移除变化的参数）
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 移除可能变化的参数（如时间戳、token等）
      const keysToRemove = ['t', 'timestamp', 'token', 'expire'];
      keysToRemove.forEach(key => urlObj.searchParams.delete(key));
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取加载状态信息
   */
  getStatus() {
    return {
      cacheSize: this.getCacheSize(),
      cachedChunks: this.chunkCache.size,
      maxCacheSize: this.config.maxCacheSize,
      metrics: { ...this.metrics },
      supportedUrls: Array.from(this.rangeSupport.entries())
    };
  }

  /**
   * 清理所有缓存
   */
  clear(): void {
    this.chunkCache.clear();
    this.rangeSupport.clear();
    this.loadingChunks.clear();
    this.metrics = {
      totalLoaded: 0,
      loadSpeed: 0,
      avgChunkLoadTime: 0,
      cacheHitRate: 0,
      failedLoads: 0
    };
    this.loadTimes = [];
    console.log('[RangeLoader] All caches cleared');
  }
}