/**
 * MemoryOptimizer — Runtime memory management for long-session stability.
 *
 * Features:
 * - Inactive context cleanup: prunes stale execution contexts
 * - Session memory pruning: removes old history entries beyond retention limit
 * - Cache cleanup: periodic cache eviction for bounded memory growth
 * - Orphan task cleanup: detects and cleans up tasks with no active references
 */

import type { MemoryUsage } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface MemoryOptimizerOptions {
  pruneIntervalMs?: number;
  sessionRetentionCount?: number;
  contextMaxAgeMs?: number;
  cacheMaxEntries?: number;
  heapThresholdPercent?: number;
  cleanupBatchSize?: number;
}

export interface MemoryOptimizerEvents {
  pruneStarted: (type: string) => void;
  pruned: (type: string, freedBytes: number, itemCount: number) => void;
  highMemoryWarning: (usageMB: number, thresholdMB: number) => void;
  memoryStable: (usageMB: number) => void;
}

interface CacheEntry {
  key: string;
  size: number;
  lastAccess: number;
  createdAt: number;
}

export class MemoryOptimizer extends EventEmitter {
  private options: Required<MemoryOptimizerOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cacheEntries: Map<string, CacheEntry> = new Map();
  private totalCacheSize = 0;
  private lastCheckTime = Date.now();
  private lastMemoryUsage = 0;

  constructor(options: MemoryOptimizerOptions = {}) {
    super();
    this.options = {
      pruneIntervalMs: options.pruneIntervalMs || 30_000,
      sessionRetentionCount: options.sessionRetentionCount || 50,
      contextMaxAgeMs: options.contextMaxAgeMs || 300_000,
      cacheMaxEntries: options.cacheMaxEntries || 500,
      heapThresholdPercent: options.heapThresholdPercent || 80,
      cleanupBatchSize: options.cleanupBatchSize || 100,
    };
  }

  start(): void {
    this.timer = setInterval(() => {
      try {
        this.runMaintenance();
      } catch (err) {
        this.emit(
          'error',
          `Maintenance error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }, this.options.pruneIntervalMs);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // --- Cache Management ---

  registerCacheEntry(key: string, sizeBytes: number): void {
    const existing = this.cacheEntries.get(key);
    if (existing) {
      this.totalCacheSize -= existing.size;
    }
    this.cacheEntries.set(key, {
      key,
      size: sizeBytes,
      lastAccess: Date.now(),
      createdAt: Date.now(),
    });
    this.totalCacheSize += sizeBytes;
  }

  updateCacheAccess(key: string): void {
    const entry = this.cacheEntries.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
    }
  }

  removeCacheEntry(key: string): void {
    const entry = this.cacheEntries.get(key);
    if (entry) {
      this.totalCacheSize -= entry.size;
      this.cacheEntries.delete(key);
    }
  }

  clearAllCache(): number {
    const freed = this.totalCacheSize;
    const count = this.cacheEntries.size;
    this.cacheEntries.clear();
    this.totalCacheSize = 0;
    this.emit('pruned', 'cache', freed, count);
    return freed;
  }

  // --- Memory Assessment ---

  getMemoryUsage(): MemoryUsage {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / (1024 * 1024);
    const heapTotalMB = mem.heapTotal / (1024 * 1024);
    const rssMB = mem.rss / (1024 * 1024);
    const externalMB = mem.external / (1024 * 1024);
    const cacheSizeMB = this.totalCacheSize / (1024 * 1024);
    const totalMB = heapUsedMB + cacheSizeMB;

    // Calculate growth rate
    const elapsedHours = (Date.now() - this.lastCheckTime) / (1000 * 60 * 60);
    const growthRateMBPerHour =
      elapsedHours > 0 ? (heapUsedMB - this.lastMemoryUsage) / elapsedHours : 0;

    this.lastCheckTime = Date.now();
    this.lastMemoryUsage = heapUsedMB;

    return {
      heapUsedMB: Math.round(heapUsedMB * 100) / 100,
      heapTotalMB: Math.round(heapTotalMB * 100) / 100,
      rssMB: Math.round(rssMB * 100) / 100,
      externalMB: Math.round(externalMB * 100) / 100,
      sessionCacheMB: 0, // Set externally via session manager integration
      contextCacheMB: cacheSizeMB,
      eventLogMB: 0, // Set externally
      totalMB: Math.round(totalMB * 100) / 100,
      growthRateMBPerHour: Math.round(growthRateMBPerHour * 100) / 100,
    };
  }

  // --- Session Pruning ---

  pruneSessions(
    sessionList: Array<{ id: string; lastActive: number }>,
    activeSessionIds: Set<string>,
  ): string[] {
    const pruned: string[] = [];

    // Sort by last active (most recent first)
    const sorted = [...sessionList].sort((a, b) => b.lastActive - a.lastActive);

    // Keep active sessions and the N most recent inactive
    const kept = new Set<string>();
    let keptCount = 0;

    for (const session of sorted) {
      if (activeSessionIds.has(session.id)) {
        kept.add(session.id);
      } else if (keptCount < this.options.sessionRetentionCount) {
        kept.add(session.id);
        keptCount++;
      }
    }

    // Prune the rest
    for (const session of sessionList) {
      if (!kept.has(session.id)) {
        pruned.push(session.id);
      }
    }

    if (pruned.length > 0) {
      this.emit('pruned', 'sessions', 0, pruned.length);
    }

    return pruned;
  }

  // --- Context Pruning ---

  pruneStaleContexts(contexts: Array<{ id: string; lastActivity: number }>): string[] {
    const now = Date.now();
    const stale = contexts.filter((ctx) => now - ctx.lastActivity > this.options.contextMaxAgeMs);

    if (stale.length > 0) {
      this.emit('pruned', 'contexts', 0, stale.length);
    }

    return stale.map((ctx) => ctx.id);
  }

  // --- Cache Eviction ---

  evictStaleCache(): number {
    const entries = Array.from(this.cacheEntries.values());

    // Sort by last access (oldest first)
    entries.sort((a, b) => a.lastAccess - b.lastAccess);

    let evicted = 0;
    let freed = 0;

    // Evict until under max entries
    while (this.cacheEntries.size > this.options.cacheMaxEntries && evicted < entries.length) {
      const entry = entries[evicted];
      this.cacheEntries.delete(entry.key);
      this.totalCacheSize -= entry.size;
      freed += entry.size;
      evicted++;
    }

    if (evicted > 0) {
      this.emit('pruned', 'cache_eviction', freed, evicted);
    }

    return evicted;
  }

  // --- Orphan Detection ---

  detectOrphanedTasks(
    activeTaskIds: Set<string>,
    allTaskRecords: Array<{ id: string; state: string; updatedAt: number }>,
  ): Array<{ id: string; state: string; idleSince: number }> {
    const now = Date.now();
    const orphans: Array<{ id: string; state: string; idleSince: number }> = [];

    for (const task of allTaskRecords) {
      if (!activeTaskIds.has(task.id)) {
        // Task exists but no active reference — orphan
        orphans.push({
          id: task.id,
          state: task.state,
          idleSince: now - task.updatedAt,
        });
      }
    }

    return orphans;
  }

  // --- Maintenance Run ---

  private runMaintenance(): void {
    // 1. Check memory threshold
    const memUsage = this.getMemoryUsage();
    const heapPercent = (memUsage.heapUsedMB / memUsage.heapTotalMB) * 100;

    if (heapPercent > this.options.heapThresholdPercent) {
      this.emit(
        'highMemoryWarning',
        memUsage.heapUsedMB,
        memUsage.heapTotalMB * (this.options.heapThresholdPercent / 100),
      );

      // Aggressive cleanup when memory is high
      this.evictStaleCache();
    }

    // 2. Cache eviction (always do a light pass)
    this.evictStaleCache();
  }
}
