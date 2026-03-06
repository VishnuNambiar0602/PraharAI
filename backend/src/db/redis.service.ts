/**
 * Redis Caching Service
 *
 * Provides get/set/del with JSON serialization and TTL.
 * Falls back gracefully when Redis is unavailable — the app
 * continues to work, just without caching.
 *
 * Includes cache statistics tracking for monitoring.
 */

import RedisConnection from '../cache/redis.config';

/** Predefined TTL constants (seconds) */
export const CacheTTL = {
  SCHEME_DETAIL: 1800, // 30 min — schemes rarely change
  SCHEME_SEARCH: 600, // 10 min — search results
  RECOMMENDATIONS: 900, // 15 min — recommendations
  USER_PROFILE: 600, // 10 min — user data
  CATEGORIES: 3600, // 1 hr — category list
  SYNC_META: 300, // 5 min
  ELIGIBILITY: 900, // 15 min — eligibility results
} as const;

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  available: boolean;
  uptime: number;
}

class RedisService {
  private available = false;
  private startTime = 0;

  // Stats counters
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private errors = 0;

  async init(): Promise<void> {
    try {
      await RedisConnection.connect();
      this.available = true;
      this.startTime = Date.now();
      console.log('✅ Redis cache ready');
    } catch (err: any) {
      this.available = false;
      console.warn('⚠️  Redis not available — running without cache:', err.message);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const client = RedisConnection.getClient();
      const raw = await client.get(key);
      if (raw == null) {
        this.misses++;
        return null;
      }
      this.hits++;
      return JSON.parse(raw) as T;
    } catch {
      this.errors++;
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.available) return;
    try {
      const client = RedisConnection.getClient();
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      this.sets++;
    } catch {
      this.errors++;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.available) return;
    try {
      const client = RedisConnection.getClient();
      await client.del(key);
      this.deletes++;
    } catch {
      this.errors++;
    }
  }

  /** Delete all keys matching a pattern (e.g. "schemes:*") */
  async delPattern(pattern: string): Promise<void> {
    if (!this.available) return;
    try {
      const client = RedisConnection.getClient();
      let cursor = 0;
      do {
        const result = await client.scan(cursor, { MATCH: pattern, COUNT: 200 });
        cursor = result.cursor;
        if (result.keys.length > 0) {
          await client.del(result.keys);
          this.deletes += result.keys.length;
        }
      } while (cursor !== 0);
    } catch {
      this.errors++;
    }
  }

  /** Get cache performance statistics */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      errors: this.errors,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
      available: this.available,
      uptime: this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    };
  }

  /** Reset stats counters */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.deletes = 0;
    this.errors = 0;
  }

  async close(): Promise<void> {
    try {
      await RedisConnection.disconnect();
      this.available = false;
      console.log('Redis connection closed');
    } catch {
      /* silent */
    }
  }
}

export const redisService = new RedisService();
