/**
 * ContextCachingSystem — Lightweight context caching (#9)
 *
 * Caches assembled context results to avoid repeated expensive retrieval.
 * Features:
 *   - TTL-based expiry (default: 5 minutes)
 *   - File-dependency-aware invalidation
 *   - Memory-safe bounded storage (max 200 entries)
 *   - LRU eviction when full
 *   - Cache hit/miss tracking
 */

import type { ContextAssemblyResult, ContextCacheEntry } from '@autic/shared';
import { EvictableMap } from '@autic/shared';

export interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

export class ContextCachingSystem {
  private cache: EvictableMap<string, ContextCacheEntry>;
  private maxEntries: number;
  private defaultTtlMs: number;
  private totalHits = 0;
  private totalMisses = 0;
  private totalInvalidations = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: CacheOptions = {}) {
    this.maxEntries = options.maxEntries || 200;
    this.defaultTtlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes
    this.cache = new EvictableMap<string, ContextCacheEntry>(this.maxEntries);
  }

  /**
   * Start periodic cleanup.
   */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.runCleanup(), 60_000);
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup.
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get a cached result by key.
   */
  get(key: string): ContextCacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.totalMisses++;
      return undefined;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.createdAt > entry.ttl) {
      this.cache.delete(key);
      this.totalInvalidations++;
      this.totalMisses++;
      return undefined;
    }

    // Update access
    entry.accessedAt = now;
    entry.hits++;
    this.totalHits++;
    return entry;
  }

  /**
   * Set a cached result.
   */
  set(key: string, result: ContextAssemblyResult, files: string[]): void {
    const now = Date.now();
    const entry: ContextCacheEntry = {
      key,
      result,
      files,
      createdAt: now,
      accessedAt: now,
      ttl: this.defaultTtlMs,
      hits: 0,
      sizeBytes: JSON.stringify(result).length,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache entries that depend on specific files.
   * Returns number of invalidated entries.
   */
  invalidateForFile(filePath: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.files.includes(filePath)) {
        this.cache.delete(key);
        this.totalInvalidations++;
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate all cache entries.
   */
  invalidateAll(): void {
    this.totalInvalidations += this.cache.size;
    this.cache.clear();
  }

  /**
   * Get cache stats.
   */
  getStats(): { size: number; hits: number; misses: number; invalidations: number; hitRate: number } {
    const totalOps = this.totalHits + this.totalMisses;
    return {
      size: this.cache.size,
      hits: this.totalHits,
      misses: this.totalMisses,
      invalidations: this.totalInvalidations,
      hitRate: totalOps > 0 ? Math.round((this.totalHits / totalOps) * 100) : 0,
    };
  }

  /**
   * List all cache keys.
   */
  listKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  private runCleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttl) {
        this.cache.delete(key);
        this.totalInvalidations++;
        removed++;
      }
    }
  }
}
