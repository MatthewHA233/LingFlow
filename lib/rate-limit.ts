import { NextRequest } from 'next/server';
import { LRUCache } from 'lru-cache';

export interface RateLimitOptions {
  interval?: number;
  uniqueTokenPerInterval?: number;
}

export class RateLimit {
  private tokenCache: LRUCache<string, number[]>;
  private interval: number;

  constructor(options: RateLimitOptions) {
    this.tokenCache = new LRUCache({
      max: options.uniqueTokenPerInterval || 500,
      ttl: options.interval || 60000,
    });
    this.interval = options.interval || 60000;
  }

  async check(
    req: NextRequest,
    limit: number,
    token: string
  ): Promise<{ success: boolean; limit: number; remaining: number }> {
    const tokenCount = this.tokenCache.get(token) || [];
    const currentTime = Date.now();
    const validTimestamps = tokenCount.filter(
      (timestamp) => currentTime - timestamp < this.interval
    );

    validTimestamps.push(currentTime);
    this.tokenCache.set(token, validTimestamps);

    const remaining = Math.max(0, limit - validTimestamps.length);
    const success = validTimestamps.length <= limit;

    if (!success) {
      throw new Error('速率限制超出');
    }

    return {
      success,
      limit,
      remaining,
    };
  }
}

export function rateLimit(options: RateLimitOptions) {
  return new RateLimit(options);
} 