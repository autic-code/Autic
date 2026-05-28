/**
 * OperationalOptimizationMemory — Tracks successful operational patterns.
 *
 * Stores:
 *   - Successful provider selections (which provider/model worked best)
 *   - Stable execution patterns (which approaches succeeded)
 *   - Queue optimization strategies (throttling, batching)
 *   - Retry optimization patterns (backoff durations that worked)
 *   - Workflow efficiency improvements
 *
 * All data is learned from verified successful executions only.
 * Never stores failed patterns or unverified data.
 */

import { timestamp, generateId } from '@autic/shared';
import type { OperationalOptimization } from '@autic/shared';

export interface OperationalOptimizationMemoryOptions {
  maxEntries?: number;
}

export class OperationalOptimizationMemory {
  private optimizations: Map<string, OperationalOptimization> = new Map();
  private maxEntries: number;

  constructor(options: OperationalOptimizationMemoryOptions = {}) {
    this.maxEntries = options.maxEntries ?? 200;
  }

  /**
   * Record a successful operational outcome.
   * Only call this for VERIFIED successful operations.
   */
  record(params: {
    type: OperationalOptimization['type'];
    description: string;
    improvementMs?: number;
  }): OperationalOptimization {
    const existing = Array.from(this.optimizations.values()).find(
      (o) => o.type === params.type && o.description === params.description,
    );
    if (existing) {
      existing.successCount += 1;
      existing.lastApplied = timestamp();
      if (params.improvementMs) {
        existing.avgImprovementMs = existing.avgImprovementMs
          ? Math.round((existing.avgImprovementMs + params.improvementMs) / 2)
          : params.improvementMs;
      }
      return existing;
    }

    const now = timestamp();
    const opt: OperationalOptimization = {
      id: generateId(),
      type: params.type,
      description: params.description,
      successCount: 1,
      failureCount: 0,
      avgImprovementMs: params.improvementMs,
      lastApplied: now,
      createdAt: now,
    };

    this.optimizations.set(opt.id, opt);

    // Enforce limit
    if (this.optimizations.size > this.maxEntries) {
      const oldest = Array.from(this.optimizations.entries()).sort(
        ([, a], [, b]) => a.createdAt - b.createdAt,
      )[0];
      if (oldest) this.optimizations.delete(oldest[0]);
    }

    return opt;
  }

  /**
   * Record a failure for an existing optimization to track reliability.
   */
  recordFailure(type: OperationalOptimization['type'], description: string): void {
    const existing = Array.from(this.optimizations.values()).find(
      (o) => o.type === type && o.description === description,
    );
    if (existing) {
      existing.failureCount += 1;
    }
  }

  /**
   * Find optimizations by type, sorted by success rate.
   */
  findByType(type: OperationalOptimization['type'], limit = 10): OperationalOptimization[] {
    return Array.from(this.optimizations.values())
      .filter((o) => o.type === type)
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, limit);
  }

  /**
   * Find optimizations by framework from description.
   */
  findByFramework(framework: string, limit = 10): OperationalOptimization[] {
    const lower = framework.toLowerCase();
    return Array.from(this.optimizations.values())
      .filter((o) => o.description.toLowerCase().includes(lower))
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, limit);
  }

  /**
   * Get the best provider selection optimization by success rate.
   */
  getBestProviderSelection(): OperationalOptimization | undefined {
    return Array.from(this.optimizations.values())
      .filter((o) => o.type === 'provider_selection' && o.successCount > 0)
      .sort((a, b) => {
        const aRate = a.successCount / Math.max(1, a.successCount + a.failureCount);
        const bRate = b.successCount / Math.max(1, b.successCount + b.failureCount);
        return bRate - aRate;
      })[0];
  }

  /**
   * Get the best retry pattern by success rate.
   */
  getBestRetryPattern(): OperationalOptimization | undefined {
    return Array.from(this.optimizations.values())
      .filter((o) => o.type === 'retry_pattern' && o.successCount > 0)
      .sort((a, b) => b.successCount - a.successCount)[0];
  }

  /**
   * Get all optimizations sorted by success rate.
   */
  getAll(limit = 50): OperationalOptimization[] {
    return Array.from(this.optimizations.values())
      .sort((a, b) => {
        const aRate = a.successCount / Math.max(1, a.successCount + a.failureCount);
        const bRate = b.successCount / Math.max(1, b.successCount + b.failureCount);
        return bRate - aRate;
      })
      .slice(0, limit);
  }

  /**
   * Get stats.
   */
  getStats(): { totalOptimizations: number; totalSuccesses: number; totalFailures: number } {
    let totalSuccesses = 0;
    let totalFailures = 0;
    for (const opt of this.optimizations.values()) {
      totalSuccesses += opt.successCount;
      totalFailures += opt.failureCount;
    }
    return {
      totalOptimizations: this.optimizations.size,
      totalSuccesses,
      totalFailures,
    };
  }

  clear(): void {
    this.optimizations.clear();
  }
}
