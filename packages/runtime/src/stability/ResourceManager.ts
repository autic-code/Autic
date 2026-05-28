/**
 * ResourceManager — Runtime resource tracking and monitoring.
 *
 * Tracks:
 * - Memory usage (heap, RSS, external)
 * - Active workers and pool utilization
 * - Queue load and pressure
 * - Provider health and load
 * - Active pipeline count
 *
 * Provides snapshot-based metrics for stability monitoring and CLI display.
 */

import { timestamp } from '@autic/shared';
import type { ResourceMetrics, QueuePressure } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface ResourceManagerOptions {
  historySize?: number;
  pressureThresholds?: {
    queuePendingHigh?: number;
    concurrencyHigh?: number;
    memoryHighMB?: number;
  };
}

export interface ResourceManagerEvents {
  metricsUpdated: (metrics: ResourceMetrics) => void;
  pressureChanged: (pressure: QueuePressure) => void;
  resourceWarning: (type: string, value: number, threshold: number) => void;
}

export class ResourceManager extends EventEmitter {
  private history: ResourceMetrics[] = [];
  private options: Required<ResourceManagerOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private _providers: Map<string, { healthy: boolean; degraded: boolean; active: boolean }> = new Map();
  private _pipelines: { active: number; completed: number; failed: number } = { active: 0, completed: 0, failed: 0 };
  private _queueMetrics = { pending: 0, running: 0, completed: 0, failed: 0 };
  private _workerMetrics = { active: 0, idle: 0, total: 0 };
  private _providerLatencies: number[] = [];
  private _queueWaitTimes: number[] = [];

  constructor(options: ResourceManagerOptions = {}) {
    super();
    this.options = {
      historySize: options.historySize || 100,
      pressureThresholds: {
        queuePendingHigh: options.pressureThresholds?.queuePendingHigh || 50,
        concurrencyHigh: options.pressureThresholds?.concurrencyHigh || 0.8,
        memoryHighMB: options.pressureThresholds?.memoryHighMB || 512,
      },
    };
  }

  start(intervalMs = 10_000): void {
    this.timer = setInterval(() => {
      try {
        this.snapshot();
      } catch (err) {
        this.emit('error', `Snapshot error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, intervalMs);
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

  // --- State Updates ---

  updateQueueMetrics(pending: number, running: number, completed: number, failed: number): void {
    this._queueMetrics = { pending, running, completed, failed };
  }

  updateWorkerMetrics(active: number, idle: number, total: number): void {
    this._workerMetrics = { active, idle, total };
  }

  updateProviderHealth(providerId: string, healthy: boolean, degraded: boolean): void {
    this._providers.set(providerId, { healthy, degraded, active: healthy && !degraded });
  }

  removeProvider(providerId: string): void {
    this._providers.delete(providerId);
  }

  updatePipelineCounts(active: number, completed: number, failed: number): void {
    this._pipelines = { active, completed, failed };
  }

  recordProviderLatency(latencyMs: number): void {
    this._providerLatencies.push(latencyMs);
    if (this._providerLatencies.length > 100) {
      this._providerLatencies.shift();
    }
  }

  recordQueueWaitTime(waitMs: number): void {
    this._queueWaitTimes.push(waitMs);
    if (this._queueWaitTimes.length > 100) {
      this._queueWaitTimes.shift();
    }
  }

  // --- Metrics Snapshot ---

  snapshot(): ResourceMetrics {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    const totalProviders = this._providers.size || 1;

    const metrics: ResourceMetrics = {
      timestamp: timestamp(),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external,
        heapPercent: mem.heapTotal > 0 ? (mem.heapUsed / mem.heapTotal) * 100 : 0,
      },
      cpu: {
        user: cpu.user,
        system: cpu.system,
        percent: this.calculateCpuPercent(cpu),
      },
      workers: { ...this._workerMetrics },
      queue: {
        ...this._queueMetrics,
        pressure: this.calculatePressure(),
      },
      providers: {
        total: totalProviders,
        healthy: this.countHealthyProviders(),
        degraded: this.countDegradedProviders(),
        unhealthy: totalProviders - this.countHealthyProviders() - this.countDegradedProviders(),
      },
      pipelines: { ...this._pipelines },
    };

    this.history.push(metrics);
    if (this.history.length > this.options.historySize) {
      this.history.shift();
    }

    this.emit('metricsUpdated', metrics);

    // Check thresholds
    this.checkResourceWarnings(metrics);

    return metrics;
  }

  getLatestMetrics(): ResourceMetrics | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getMetricsHistory(count = 10): ResourceMetrics[] {
    return this.history.slice(-count);
  }

  // --- Queue Pressure ---

  getQueuePressure(): QueuePressure {
    const pending = this._queueMetrics.pending;
    const running = this._queueMetrics.running;

    let level: QueuePressure['level'] = 'low';
    const threshold = this.options.pressureThresholds.queuePendingHigh!;

    if (pending > threshold * 2) level = 'critical';
    else if (pending > threshold) level = 'high';
    else if (pending > threshold / 2) level = 'medium';

    const avgWait = this._queueWaitTimes.length > 0
      ? this._queueWaitTimes.reduce((a, b) => a + b, 0) / this._queueWaitTimes.length
      : 0;

    return {
      level,
      pendingCount: pending,
      runningCount: running,
      avgWaitMs: Math.round(avgWait),
      throughputPerMin: this.calculateThroughput(),
      concurrencyUtilization: this._workerMetrics.total > 0
        ? (this._workerMetrics.active / this._workerMetrics.total) * 100
        : 0,
      recommendation: this.getPressureRecommendation(level),
    };
  }

  // --- Provider Stats ---

  getProviderStats() {
    const healthy = this.countHealthyProviders();
    const degraded = this.countDegradedProviders();
    const total = this._providers.size;

    const avgLatency = this._providerLatencies.length > 0
      ? this._providerLatencies.reduce((a, b) => a + b, 0) / this._providerLatencies.length
      : 0;

    return {
      total,
      healthy,
      degraded,
      unhealthy: total - healthy - degraded,
      avgLatencyMs: Math.round(avgLatency),
    };
  }

  // --- Private Helpers ---

  private calculatePressure(): number {
    const pending = this._queueMetrics.pending;
    const running = this._queueMetrics.running;
    const total = pending + running;
    if (total === 0) return 0;
    return Math.min(100, (pending / Math.max(running, 1)) * 100);
  }

  private calculateCpuPercent(cpu: NodeJS.CpuUsage): number {
    const total = cpu.user + cpu.system;
    // Rough CPU percent based on time since last check
    return Math.min(100, Math.round((total / 1_000_000) * 100));
  }

  private calculateThroughput(): number {
    if (this.history.length < 2) return 0;
    const recent = this.history.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const elapsedSec = (newest.timestamp - oldest.timestamp) / 1000;
    if (elapsedSec <= 0) return 0;
    const completed = newest.queue.completed - oldest.queue.completed;
    return Math.round((completed / elapsedSec) * 60);
  }

  private countHealthyProviders(): number {
    let count = 0;
    for (const [, p] of this._providers) {
      if (p.healthy && !p.degraded) count++;
    }
    return count;
  }

  private countDegradedProviders(): number {
    let count = 0;
    for (const [, p] of this._providers) {
      if (p.degraded) count++;
    }
    return count;
  }

  private getPressureRecommendation(level: QueuePressure['level']): string {
    switch (level) {
      case 'low': return 'Normal operation';
      case 'medium': return 'Monitor queue growth';
      case 'high': return 'Consider increasing worker count or throttling new tasks';
      case 'critical': return 'Immediate intervention needed — reduce task inflow';
    }
  }

  private checkResourceWarnings(metrics: ResourceMetrics): void {
    if (metrics.memory.heapPercent > this.options.pressureThresholds!.memoryHighMB!) {
      this.emit('resourceWarning', 'memory', metrics.memory.heapPercent, this.options.pressureThresholds!.memoryHighMB!);
    }
    if (this._queueMetrics.pending > this.options.pressureThresholds!.queuePendingHigh!) {
      this.emit('resourceWarning', 'queue', this._queueMetrics.pending, this.options.pressureThresholds!.queuePendingHigh!);
    }
  }

  getActiveWorkerCount(): number { return this._workerMetrics.active; }
  getQueuedTaskCount(): number { return this._queueMetrics.pending; }
  getProviderCount(): number { return this._providers.size; }
  getActivePipelineCount(): number { return this._pipelines.active; }
}
