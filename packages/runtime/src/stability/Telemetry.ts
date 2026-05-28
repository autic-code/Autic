/**
 * Telemetry — Lightweight runtime performance metrics collection.
 *
 * Tracks:
 * - Workflow duration
 * - Queue latency (time from enqueue to start)
 * - Provider latency (time for provider calls)
 * - Retry frequency
 * - Memory growth over time
 * - Render/update frequency
 * - Tool execution count
 * - Stage transitions
 * - Error counts
 *
 * Local-only storage. No cloud telemetry.
 */

import { timestamp } from '@autic/shared';
import type { TelemetryMetrics } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface TelemetryOptions {
  maxHistorySize?: number;
  flushIntervalMs?: number;
  enabled?: boolean;
}

export interface TelemetryEvents {
  metricsCollected: (metrics: TelemetryMetrics) => void;
  historyFlushed: (count: number) => void;
}

export class Telemetry extends EventEmitter {
  private options: Required<TelemetryOptions>;
  private history: TelemetryMetrics[] = [];
  private current: TelemetryMetrics;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialMemory = process.memoryUsage().heapUsed;

  constructor(options: TelemetryOptions = {}) {
    super();
    this.options = {
      maxHistorySize: options.maxHistorySize || 1000,
      flushIntervalMs: options.flushIntervalMs || 60_000,
      enabled: options.enabled ?? true,
    };

    this.current = this.freshMetrics();
  }

  start(): void {
    if (!this.options.enabled) return;

    // Collect metrics every 30 seconds
    this.timer = setInterval(() => this.collect(), 30_000);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }

    // Flush to history periodically
    this.flushTimer = setInterval(() => this.flush(), this.options.flushIntervalMs);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.timer = null;
    this.flushTimer = null;
  }

  // --- Recording Methods ---

  recordWorkflowDuration(durationMs: number): void {
    this.current.workflowDurationMs = durationMs;
  }

  recordQueueLatency(latencyMs: number): void {
    this.current.queueLatencyMs = latencyMs;
  }

  recordProviderLatency(latencyMs: number): void {
    this.current.providerLatencyMs = latencyMs;
  }

  recordRetry(): void {
    this.current.retryCount++;
  }

  recordRender(): void {
    this.current.renderCount++;
  }

  recordToolExecution(): void {
    this.current.toolExecutionCount++;
  }

  recordStageTransition(): void {
    this.current.stageTransitions++;
  }

  recordError(): void {
    this.current.errorCount++;
  }

  // --- Collection & Flush ---

  collect(): TelemetryMetrics {
    const now = Date.now();
    const memGrowth = process.memoryUsage().heapUsed - this.initialMemory;

    this.current.memoryGrowthBytes = memGrowth;
    this.current.timestamp = now;

    return { ...this.current };
  }

  flush(): TelemetryMetrics[] {
    // Collect current metrics
    const metrics = this.collect();
    this.history.push(metrics);
    this.emit('metricsCollected', metrics);

    // Reset current counters
    this.current = this.freshMetrics();

    // Trim history
    if (this.history.length > this.options.maxHistorySize) {
      const excess = this.history.length - this.options.maxHistorySize;
      this.history.splice(0, excess);
    }

    this.emit('historyFlushed', this.history.length);
    return [...this.history];
  }

  // --- Query Methods ---

  getHistory(count = 10): TelemetryMetrics[] {
    return this.history.slice(-count);
  }

  getCurrentMetrics(): TelemetryMetrics {
    return this.collect();
  }

  getAverageLatency(): number {
    const recent = this.history.slice(-10);
    const withLatency = recent.filter((m) => m.providerLatencyMs > 0);
    if (withLatency.length === 0) return 0;
    return withLatency.reduce((a, b) => a + b.providerLatencyMs, 0) / withLatency.length;
  }

  getTotalRetries(): number {
    return this.history.reduce((sum, m) => sum + m.retryCount, 0) + this.current.retryCount;
  }

  getTotalErrors(): number {
    return this.history.reduce((sum, m) => sum + m.errorCount, 0) + this.current.errorCount;
  }

  getTotalToolExecutions(): number {
    return this.history.reduce((sum, m) => sum + m.toolExecutionCount, 0) + this.current.toolExecutionCount;
  }

  getMemoryGrowthTrend(): { initial: number; current: number; growth: number } {
    return {
      initial: this.initialMemory,
      current: process.memoryUsage().heapUsed,
      growth: process.memoryUsage().heapUsed - this.initialMemory,
    };
  }

  /**
   * Detect memory leak by checking growth rate over recent history.
   */
  detectMemoryLeak(): { likely: boolean; growthRateMBPerMin: number } {
    if (this.history.length < 5) {
      return { likely: false, growthRateMBPerMin: 0 };
    }

    const recent = this.history.slice(-5);
    const firstMem = recent[0].memoryGrowthBytes;
    const lastMem = recent[recent.length - 1].memoryGrowthBytes;
    const elapsedMin = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 60_000;

    if (elapsedMin <= 0) return { likely: false, growthRateMBPerMin: 0 };

    const growthPerMin = ((lastMem - firstMem) / (1024 * 1024)) / elapsedMin;

    return {
      likely: growthPerMin > 5, // >5MB/min growth is suspicious
      growthRateMBPerMin: Math.round(growthPerMin * 100) / 100,
    };
  }

  reset(): void {
    this.history = [];
    this.current = this.freshMetrics();
    this.initialMemory = process.memoryUsage().heapUsed;
  }

  private freshMetrics(): TelemetryMetrics {
    return {
      workflowDurationMs: 0,
      queueLatencyMs: 0,
      providerLatencyMs: 0,
      retryCount: 0,
      memoryGrowthBytes: 0,
      renderCount: 0,
      toolExecutionCount: 0,
      stageTransitions: 0,
      errorCount: 0,
      timestamp: timestamp(),
    };
  }
}
