/**
 * LearningObservability — Runtime transparency for the learning system.
 *
 * Provides:
 *   - Active learning retrieval visibility
 *   - Verified fix indicators
 *   - Confidence indicators
 *   - Learning application logs
 *
 * Keeps learning inspectable and trustworthy with structured event logs.
 * All logs are bounded to prevent memory growth.
 */

import type { LearningCategory, LearningEvent, LearningEventType } from '@autic/shared';

export interface LearningObservabilityOptions {
  maxLogEntries?: number;
}

export class LearningObservability {
  private logs: LearningEvent[] = [];
  private maxLogEntries: number;

  constructor(options: LearningObservabilityOptions = {}) {
    this.maxLogEntries = options.maxLogEntries ?? 500;
  }

  /**
   * Log a learning event.
   */
  log(params: {
    type: LearningEventType;
    timestamp: number;
    entryId?: string;
    category?: LearningCategory;
    message: string;
    confidence?: number;
    source?: string;
  }): void {
    const event: LearningEvent = {
      type: params.type,
      timestamp: params.timestamp,
      entryId: params.entryId,
      category: params.category,
      message: params.message,
      confidence: params.confidence,
      source: params.source,
    };

    this.logs.push(event);

    // Enforce max log entries
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }

  /**
   * Get recent learning events.
   */
  getRecent(limit = 20): LearningEvent[] {
    return [...this.logs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get events by type.
   */
  getByType(type: LearningEventType, limit = 20): LearningEvent[] {
    return this.logs
      .filter((e) => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get events within a time range.
   */
  getByTimeRange(startTime: number, endTime: number, limit = 50): LearningEvent[] {
    return this.logs
      .filter((e) => e.timestamp >= startTime && e.timestamp <= endTime)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get summary statistics.
   */
  getStats(): {
    totalEvents: number;
    eventTypeCounts: Record<string, number>;
    recentRetrievalHits: number;
    recentRetrievalMisses: number;
  } {
    const eventTypeCounts: Record<string, number> = {};
    let recentRetrievalHits = 0;
    let recentRetrievalMisses = 0;

    const recentEvents = this.logs.slice(-100);
    for (const event of recentEvents) {
      eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;
      if (event.type === 'learning:retrieval_hit') recentRetrievalHits++;
      if (event.type === 'learning:retrieval_miss') recentRetrievalMisses++;
    }

    return {
      totalEvents: this.logs.length,
      eventTypeCounts,
      recentRetrievalHits,
      recentRetrievalMisses,
    };
  }

  /**
   * Query events matching a condition.
   */
  query(
    predicate: (event: LearningEvent) => boolean,
    limit = 20,
  ): LearningEvent[] {
    return this.logs
      .filter(predicate)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.logs = [];
  }
}
