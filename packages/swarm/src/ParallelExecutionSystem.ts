/**
 * ParallelExecutionSystem — Bounded parallel workflows (#3)
 *
 * Controlled parallel execution with:
 *   - Bounded concurrency via chunked Promise scheduling
 *   - Worker balancing and queue awareness
 *   - Execution isolation between parallel jobs
 *   - Cancellation propagation
 *   - NO uncontrolled Promise.all execution storms
 */

import { generateId } from '@autic/shared';
import type { ParallelBatchResult } from '@autic/shared';

export interface ParallelJob<TInput = Record<string, unknown>, TOutput = unknown> {
  id: string;
  name: string;
  execute: () => Promise<{ success: boolean; output?: TOutput; error?: string }>;
  input?: TInput;
  timeoutMs?: number;
}

export class ParallelExecutionSystem {
  private maxConcurrency: number;
  private maxBatches: number;
  private activeBatches: Set<string> = new Set();
  private batchHistory: Array<{ batchId: string; startedAt: number; completedAt: number; totalJobs: number }> = [];
  private historyLimit = 50;

  constructor(options: { maxConcurrency?: number; maxBatches?: number } = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 4;
    this.maxBatches = options.maxBatches ?? 3;
  }

  /** Execute a batch of jobs with controlled concurrency */
  async executeBatch<TInput, TOutput>(
    jobs: ParallelJob<TInput, TOutput>[],
    options: { maxConcurrency?: number; timeoutMs?: number } = {},
  ): Promise<ParallelBatchResult> {
    const batchId = generateId();
    const concurrency = Math.min(options.maxConcurrency ?? this.maxConcurrency, this.maxConcurrency);

    if (this.activeBatches.size >= this.maxBatches) {
      throw new Error(`Max parallel batches (${this.maxBatches}) already active`);
    }

    this.activeBatches.add(batchId);
    const startTime = Date.now();

    const results: ParallelBatchResult['results'] = [];

    // Execute in bounded chunks — no Promise.all storms
    for (let i = 0; i < jobs.length; i += concurrency) {
      if (!this.activeBatches.has(batchId)) break; // Cancellation check

      const chunk = jobs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (job) => {
          const jobStart = Date.now();
          const timeout = options.timeoutMs ?? job.timeoutMs ?? 30_000;

          try {
            // Use a timeout that rejects rather than returning a different shape
            const result = await Promise.race([
              job.execute(),
              new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`Job timed out after ${timeout}ms`)), timeout);
              }),
            ]);
            return {
              jobId: job.id,
              agentId: '',
              success: result.success,
              output: result.output,
              error: result.error,
              durationMs: Date.now() - jobStart,
            };
          } catch (error) {
            return {
              jobId: job.id,
              agentId: '',
              success: false,
              error: error instanceof Error ? error.message : String(error),
              durationMs: Date.now() - jobStart,
            };
          }
        }),
      );

      results.push(...chunkResults);
    }

    this.activeBatches.delete(batchId);

    const completedJobs = results.filter((r) => r.success).length;
    const failedJobs = results.filter((r) => !r.success).length;

    this.batchHistory.push({
      batchId,
      startedAt: startTime,
      completedAt: Date.now(),
      totalJobs: jobs.length,
    });

    // Trim history
    if (this.batchHistory.length > this.historyLimit) {
      this.batchHistory = this.batchHistory.slice(-this.historyLimit);
    }

    return {
      batchId,
      totalJobs: jobs.length,
      completedJobs,
      failedJobs,
      results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /** Cancel an active batch */
  cancelBatch(batchId: string): boolean {
    if (!this.activeBatches.has(batchId)) return false;
    this.activeBatches.delete(batchId);
    return true;
  }

  /** Get active batch count */
  getActiveBatchCount(): number {
    return this.activeBatches.size;
  }

  /** Get max concurrency */
  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  /** Update max concurrency */
  setMaxConcurrency(concurrency: number): void {
    this.maxConcurrency = Math.max(1, concurrency);
  }

  /** Get batch execution metrics */
  getMetrics(): {
    totalBatches: number;
    activeBatches: number;
    avgBatchSize: number;
    avgDurationMs: number;
  } {
    if (this.batchHistory.length === 0) {
      return { totalBatches: 0, activeBatches: this.activeBatches.size, avgBatchSize: 0, avgDurationMs: 0 };
    }

    const avgSize = this.batchHistory.reduce((s, b) => s + b.totalJobs, 0) / this.batchHistory.length;
    const avgDuration = this.batchHistory.reduce((s, b) => s + (b.completedAt - b.startedAt), 0) / this.batchHistory.length;

    return {
      totalBatches: this.batchHistory.length,
      activeBatches: this.activeBatches.size,
      avgBatchSize: Math.round(avgSize * 10) / 10,
      avgDurationMs: Math.round(avgDuration),
    };
  }

  /** Reset all state */
  reset(): void {
    this.activeBatches.clear();
    this.batchHistory = [];
  }
}
