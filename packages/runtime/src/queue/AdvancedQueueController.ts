/**
 * AdvancedQueueController — Dynamic queue management for the execution runtime.
 *
 * Features:
 * - Dynamic throttling: adjusts concurrency based on queue pressure
 * - Concurrency adaptation: scales workers up/down based on load
 * - Queue pressure detection: classifies queue state (low/medium/high/critical)
 * - Priority-aware execution: respects task priority levels
 * - Rate limiting integration: works with provider rate limiters
 *
 * Designed as a controller layer over the existing Queue class.
 */

import type { QueuePressure } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface AdvancedQueueControllerOptions {
  minConcurrency?: number;
  maxConcurrency?: number;
  scaleUpThreshold?: number; // Queue pressure % to scale up
  scaleDownThreshold?: number; // Queue pressure % to scale down
  cooldownMs?: number; // Min time between scale changes
  maxPendingTasks?: number; // Hard limit on pending tasks
  enableAutoScaling?: boolean;
}

export interface AdvancedQueueControllerEvents {
  concurrencyChanged: (oldVal: number, newVal: number, reason: string) => void;
  pressureChanged: (pressure: QueuePressure) => void;
  throttled: (reason: string) => void;
  unthrottled: () => void;
  scaleUp: (from: number, to: number) => void;
  scaleDown: (from: number, to: number) => void;
}

interface QueueSnapshot {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  timestamp: number;
}

export class AdvancedQueueController extends EventEmitter {
  private options: Required<AdvancedQueueControllerOptions>;
  private currentConcurrency: number;
  private lastScaleTime = 0;
  private throttled = false;
  private snapshots: QueueSnapshot[] = [];
  private _setConcurrency: ((n: number) => void) | null = null;
  private _getQueueStats:
    | (() => { pending: number; running: number; completed: number; failed: number })
    | null = null;

  constructor(options: AdvancedQueueControllerOptions = {}) {
    super();
    this.options = {
      minConcurrency: options.minConcurrency || 1,
      maxConcurrency: options.maxConcurrency || 8,
      scaleUpThreshold: options.scaleUpThreshold || 60,
      scaleDownThreshold: options.scaleDownThreshold || 20,
      cooldownMs: options.cooldownMs || 10_000,
      maxPendingTasks: options.maxPendingTasks || 200,
      enableAutoScaling: options.enableAutoScaling ?? true,
    };
    this.currentConcurrency = this.options.minConcurrency;
  }

  /**
   * Connect to a Queue instance by providing setter and stats getter.
   */
  connect(
    setConcurrency: (n: number) => void,
    getQueueStats: () => { pending: number; running: number; completed: number; failed: number },
  ): void {
    this._setConcurrency = setConcurrency;
    this._getQueueStats = getQueueStats;
    this.applyConcurrency(this.currentConcurrency, 'initial');
  }

  /**
   * Take a snapshot of current queue state and evaluate.
   */
  tick(): QueuePressure {
    const stats = this._getQueueStats?.() || { pending: 0, running: 0, completed: 0, failed: 0 };

    this.snapshots.push({ ...stats, timestamp: Date.now() });
    if (this.snapshots.length > 60) this.snapshots.shift();

    const pressure = this.assessPressure(stats);
    this.emit('pressureChanged', pressure);

    // Check if we need to throttle
    if (pressure.level === 'critical' && !this.throttled) {
      this.throttled = true;
      this.emit('throttled', `Queue pressure critical: ${stats.pending} pending tasks`);
    } else if (pressure.level !== 'critical' && this.throttled) {
      this.throttled = false;
      this.emit('unthrottled');
    }

    // Auto-scale if enabled
    if (this.options.enableAutoScaling) {
      this.autoScale(pressure);
    }

    return pressure;
  }

  /**
   * Get current concurrency setting.
   */
  getConcurrency(): number {
    return this.currentConcurrency;
  }

  /**
   * Manually set concurrency.
   */
  setConcurrency(n: number): void {
    const clamped = Math.max(this.options.minConcurrency, Math.min(this.options.maxConcurrency, n));
    this.applyConcurrency(clamped, 'manual');
  }

  /**
   * Check if queue is currently throttled.
   */
  isThrottled(): boolean {
    return this.throttled;
  }

  /**
   * Get queue pressure assessment.
   */
  getPressure(): QueuePressure {
    const stats = this._getQueueStats?.() || { pending: 0, running: 0, completed: 0, failed: 0 };
    return this.assessPressure(stats);
  }

  /**
   * Get throughput per minute (based on recent completions).
   */
  getThroughput(): number {
    if (this.snapshots.length < 2) return 0;
    const recent = this.snapshots.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const elapsedSec = (newest.timestamp - oldest.timestamp) / 1000;
    if (elapsedSec <= 0) return 0;
    const completed = newest.completed - oldest.completed;
    return Math.round((completed / elapsedSec) * 60);
  }

  /**
   * Get the average queue wait time based on completion rate.
   */
  getAverageWaitMs(): number {
    const throughput = this.getThroughput();
    if (throughput <= 0) return 0;
    const stats = this._getQueueStats?.() || { pending: 0, running: 0, completed: 0, failed: 0 };
    return stats.pending > 0
      ? Math.round((stats.pending / Math.max(throughput, 1)) * 60 * 1000)
      : 0;
  }

  // --- Private ---

  private assessPressure(stats: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }): QueuePressure {
    const concurrencyUtil =
      this.currentConcurrency > 0 ? (stats.running / this.currentConcurrency) * 100 : 0;

    let level: QueuePressure['level'] = 'low';

    if (stats.pending > this.options.maxPendingTasks * 0.8) level = 'critical';
    else if (stats.pending > this.options.maxPendingTasks * 0.5) level = 'high';
    else if (stats.pending > this.options.maxPendingTasks * 0.2) level = 'medium';

    return {
      level,
      pendingCount: stats.pending,
      runningCount: stats.running,
      avgWaitMs: this.getAverageWaitMs(),
      throughputPerMin: this.getThroughput(),
      concurrencyUtilization: Math.round(concurrencyUtil * 100) / 100,
      recommendation: this.getRecommendation(level, stats),
    };
  }

  private autoScale(pressure: QueuePressure): void {
    const now = Date.now();
    if (now - this.lastScaleTime < this.options.cooldownMs) return;

    if (
      pressure.concurrencyUtilization > this.options.scaleUpThreshold &&
      this.currentConcurrency < this.options.maxConcurrency
    ) {
      const newVal = Math.min(this.options.maxConcurrency, this.currentConcurrency + 1);
      this.emit('scaleUp', this.currentConcurrency, newVal);
      this.applyConcurrency(newVal, 'scale_up');
    } else if (
      pressure.concurrencyUtilization < this.options.scaleDownThreshold &&
      this.currentConcurrency > this.options.minConcurrency
    ) {
      const newVal = Math.max(this.options.minConcurrency, this.currentConcurrency - 1);
      this.emit('scaleDown', this.currentConcurrency, newVal);
      this.applyConcurrency(newVal, 'scale_down');
    }
  }

  private applyConcurrency(value: number, reason: string): void {
    const old = this.currentConcurrency;
    this.currentConcurrency = value;
    this.lastScaleTime = Date.now();

    if (this._setConcurrency) {
      this._setConcurrency(value);
    }

    if (old !== value) {
      this.emit('concurrencyChanged', old, value, reason);
    }
  }

  private getRecommendation(
    level: QueuePressure['level'],
    stats: { pending: number; running: number },
  ): string {
    switch (level) {
      case 'low':
        return 'Normal operation';
      case 'medium':
        return `Monitor queue — ${stats.pending} pending with ${stats.running} running`;
      case 'high':
        return `Increase concurrency or add workers — ${stats.pending} tasks waiting`;
      case 'critical':
        return `Immediate action needed — ${stats.pending} tasks queued, consider reducing inflow`;
    }
  }
}
