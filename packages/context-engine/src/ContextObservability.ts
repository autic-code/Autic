/**
 * ContextObservability — Context engineering transparency (#12)
 *
 * Tracks and exposes:
 *   - Token usage per request and cumulative
 *   - Retrieval statistics (files selected, hits, misses)
 *   - Compression statistics (tokens saved, ratios)
 *   - Cache hit/miss rates
 *   - Budget status and overflow events
 *   - Recent event log for inspection
 *
 * All data is bounded (max 500 events) to prevent memory leaks.
 */

import type { ContextEvent } from '@autic/shared';
import { timestamp } from '@autic/shared';

export interface ObservabilityStats {
  totalAssemblies: number;
  totalTokensUsed: number;
  totalTokensSaved: number;
  totalFilesRetrieved: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  totalSafetyTriggers: number;
  averageTokensPerAssembly: number;
  averageFilesPerAssembly: number;
  averageCompressionRatio: number;
}

export class ContextObservability {
  private events: ContextEvent[] = [];
  private maxEvents = 500;

  // Cumulative stats
  private totalAssemblies = 0;
  private totalTokensUsed = 0;
  private totalTokensSaved = 0;
  private totalFilesRetrieved = 0;
  private totalCacheHits = 0;
  private totalCacheMisses = 0;
  private totalSafetyTriggers = 0;
  private totalCompressionRatio = 0;
  private compressionCount = 0;

  /**
   * Log a context event.
   */
  log(event: Omit<ContextEvent, 'timestamp'> & { timestamp?: number }): void {
    const fullEvent: ContextEvent = {
      ...event,
      timestamp: event.timestamp ?? timestamp(),
    } as ContextEvent;

    this.events.push(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update cumulative stats
    this.totalAssemblies++;
    if (fullEvent.tokensUsed) this.totalTokensUsed += fullEvent.tokensUsed;
    if (fullEvent.filesSelected) this.totalFilesRetrieved += fullEvent.filesSelected;
    if (fullEvent.compressionRatio !== undefined) {
      this.totalCompressionRatio += fullEvent.compressionRatio;
      this.compressionCount++;
    }

    switch (fullEvent.type) {
      case 'context:cache_hit':
        this.totalCacheHits++;
        break;
      case 'context:cache_miss':
        this.totalCacheMisses++;
        break;
      case 'context:safety_triggered':
        this.totalSafetyTriggers++;
        break;
    }
  }

  /**
   * Record tokens saved from compression.
   */
  recordTokensSaved(count: number): void {
    this.totalTokensSaved += count;
  }

  /**
   * Get cumulative stats.
   */
  getStats(): ObservabilityStats {
    return {
      totalAssemblies: this.totalAssemblies,
      totalTokensUsed: this.totalTokensUsed,
      totalTokensSaved: this.totalTokensSaved,
      totalFilesRetrieved: this.totalFilesRetrieved,
      totalCacheHits: this.totalCacheHits,
      totalCacheMisses: this.totalCacheMisses,
      totalSafetyTriggers: this.totalSafetyTriggers,
      averageTokensPerAssembly: this.totalAssemblies > 0
        ? Math.round(this.totalTokensUsed / this.totalAssemblies)
        : 0,
      averageFilesPerAssembly: this.totalAssemblies > 0
        ? Math.round(this.totalFilesRetrieved / this.totalAssemblies)
        : 0,
      averageCompressionRatio: this.compressionCount > 0
        ? Math.round((this.totalCompressionRatio / this.compressionCount) * 100) / 100
        : 0,
    };
  }

  /**
   * Get recent events for inspection.
   */
  getRecentEvents(limit = 20): ContextEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events filtered by type.
   */
  getEventsByType(type: string, limit = 20): ContextEvent[] {
    return this.events
      .filter(e => e.type === type)
      .slice(-limit);
  }

  /**
   * Get token usage summary.
   */
  getTokenUsageSummary(): { used: number; saved: number; net: number; percentSaved: string } {
    const net = this.totalTokensUsed - this.totalTokensSaved;
    const percentSaved = this.totalTokensUsed > 0
      ? `${Math.round((this.totalTokensSaved / (this.totalTokensUsed + this.totalTokensSaved)) * 100)}%`
      : '0%';
    return {
      used: this.totalTokensUsed,
      saved: this.totalTokensSaved,
      net: Math.max(0, net),
      percentSaved,
    };
  }

  /**
   * Get cache efficiency.
   */
  getCacheEfficiency(): { hits: number; misses: number; hitRate: number } {
    const total = this.totalCacheHits + this.totalCacheMisses;
    return {
      hits: this.totalCacheHits,
      misses: this.totalCacheMisses,
      hitRate: total > 0 ? Math.round((this.totalCacheHits / total) * 100) : 0,
    };
  }

  /**
   * Reset all stats (for testing).
   */
  reset(): void {
    this.events = [];
    this.totalAssemblies = 0;
    this.totalTokensUsed = 0;
    this.totalTokensSaved = 0;
    this.totalFilesRetrieved = 0;
    this.totalCacheHits = 0;
    this.totalCacheMisses = 0;
    this.totalSafetyTriggers = 0;
    this.totalCompressionRatio = 0;
    this.compressionCount = 0;
  }
}
