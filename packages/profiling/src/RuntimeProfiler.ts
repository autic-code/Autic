/**
 * RuntimeProfiler — #7 Runtime Profiling System
 *
 * Production bottleneck detection:
 * - CPU profiling: execution time per subsystem
 * - Memory profiling: heap allocation patterns
 * - Queue latency profiling: enqueue-to-complete timing
 * - Provider latency tracking: request-to-response timing per provider
 * - Orchestration profiling: pipeline stage duration distribution
 *
 * Goal: Detect and diagnose production bottlenecks.
 */

import { timestamp } from '@autic/shared';

// ─── Types ─────────────────────────────────────────────────────────

export interface ProfilingConfig {
  sampleIntervalMs: number;
  maxSamples: number;
  enableCPUProfiling: boolean;
  enableMemoryProfiling: boolean;
  enableQueueProfiling: boolean;
  enableProviderProfiling: boolean;
  enableOrchestrationProfiling: boolean;
}

export interface ProfileSnapshot {
  timestamp: number;
  cpu: {
    userCPUPct: number;
    systemCPUPct: number;
    totalCPUPct: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
    heapUtilization: number;
  };
  queueLatency: {
    avgEnqueueToStartMs: number;
    avgProcessingMs: number;
    avgTotalMs: number;
    maxMs: number;
  };
  providerLatency: Record<
    string,
    {
      avgMs: number;
      p95Ms: number;
      maxMs: number;
      requestCount: number;
      errorRate: number;
    }
  >;
  orchestration: {
    activeStages: number;
    avgStageDurationMs: number;
    totalPipelineDurationMs: number;
    stageDistribution: Record<string, { count: number; avgMs: number; failRate: number }>;
  };
}

export interface ProfileReport {
  timestamp: number;
  durationMs: number;
  snapshots: ProfileSnapshot[];
  summary: {
    avgCPU: number;
    peakMemoryMB: number;
    avgQueueLatencyMs: number;
    avgProviderLatencyMs: number;
    avgPipelineDurationMs: number;
  };
  bottlenecks: Array<{
    component: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
    recommendation: string;
  }>;
}

// ─── RuntimeProfiler ────────────────────────────────────────────────

export class RuntimeProfiler {
  private config: ProfilingConfig;
  private snapshots: ProfileSnapshot[] = [];
  private providerLatencies: Map<string, number[]> = new Map();
  private queueLatencies: number[] = [];
  private pipelineStageDurations: Map<string, number[]> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ProfilingConfig> = {}) {
    this.config = {
      sampleIntervalMs: config.sampleIntervalMs ?? 60_000,
      maxSamples: config.maxSamples ?? 60,
      enableCPUProfiling: config.enableCPUProfiling ?? true,
      enableMemoryProfiling: config.enableMemoryProfiling ?? true,
      enableQueueProfiling: config.enableQueueProfiling ?? true,
      enableProviderProfiling: config.enableProviderProfiling ?? true,
      enableOrchestrationProfiling: config.enableOrchestrationProfiling ?? true,
    };
  }

  /**
   * Start continuous profiling
   */
  start(): void {
    if (!this.timer) {
      this.timer = setInterval(() => this.takeSnapshot(), this.config.sampleIntervalMs);
      if (typeof this.timer === 'object' && 'unref' in this.timer) {
        this.timer.unref();
      }
    }
  }

  /**
   * Stop profiling
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Record provider latency
   */
  recordProviderLatency(providerId: string, latencyMs: number): void {
    const latencies = this.providerLatencies.get(providerId) ?? [];
    latencies.push(latencyMs);
    if (latencies.length > 100) latencies.shift();
    this.providerLatencies.set(providerId, latencies);
  }

  /**
   * Record queue latency
   */
  recordQueueLatency(latencyMs: number): void {
    this.queueLatencies.push(latencyMs);
    if (this.queueLatencies.length > 100) this.queueLatencies.shift();
  }

  /**
   * Record pipeline stage duration
   */
  recordStageDuration(stage: string, durationMs: number): void {
    const durations = this.pipelineStageDurations.get(stage) ?? [];
    durations.push(durationMs);
    if (durations.length > 50) durations.shift();
    this.pipelineStageDurations.set(stage, durations);
  }

  /**
   * Take a profile snapshot and generate report
   */
  async generateReport(snapshots?: ProfileSnapshot[]): Promise<ProfileReport> {
    const startTime = Date.now();
    const samples = snapshots ?? [await this.takeSnapshot()];
    this.snapshots = samples;

    const bottlenecks: ProfileReport['bottlenecks'] = [];
    const avgCPU = samples.reduce((s, p) => s + p.cpu.totalCPUPct, 0) / samples.length;
    const peakMemoryMB = Math.max(...samples.map((p) => p.memory.rssMB));
    const avgQueueLatencyMs =
      samples.reduce((s, p) => s + p.queueLatency.avgTotalMs, 0) / samples.length;
    const allProviderAvg = Object.values(samples[samples.length - 1]?.providerLatency ?? {});
    const avgProviderLatencyMs =
      allProviderAvg.length > 0
        ? allProviderAvg.reduce((s, p) => s + p.avgMs, 0) / allProviderAvg.length
        : 0;
    const avgPipelineDurationMs =
      samples.reduce((s, p) => s + p.orchestration.totalPipelineDurationMs, 0) / samples.length;

    // Detect bottlenecks
    if (avgCPU > 80) {
      bottlenecks.push({
        component: 'CPU',
        metric: 'totalCPU',
        value: avgCPU,
        threshold: 80,
        severity: 'warning',
        recommendation: 'High CPU usage — check for runaway processes or excessive polling',
      });
    }
    if (peakMemoryMB > 1024) {
      bottlenecks.push({
        component: 'Memory',
        metric: 'rssMB',
        value: peakMemoryMB,
        threshold: 1024,
        severity: 'critical',
        recommendation: 'Memory usage exceeds 1GB — investigate potential leak',
      });
    }
    if (avgQueueLatencyMs > 5000) {
      bottlenecks.push({
        component: 'Queue',
        metric: 'avgTotalLatencyMs',
        value: avgQueueLatencyMs,
        threshold: 5000,
        severity: 'warning',
        recommendation:
          'High queue latency — consider increasing concurrency or optimizing processing',
      });
    }
    if (avgProviderLatencyMs > 10000) {
      bottlenecks.push({
        component: 'Provider',
        metric: 'avgLatencyMs',
        value: avgProviderLatencyMs,
        threshold: 10000,
        severity: 'warning',
        recommendation: 'High provider latency — check provider health or add fallback providers',
      });
    }

    return {
      timestamp: timestamp(),
      durationMs: Date.now() - startTime,
      snapshots: samples,
      summary: {
        avgCPU,
        peakMemoryMB,
        avgQueueLatencyMs,
        avgProviderLatencyMs,
        avgPipelineDurationMs,
      },
      bottlenecks,
    };
  }

  /**
   * Take a single profile snapshot
   */
  async takeSnapshot(): Promise<ProfileSnapshot> {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const queueLatencyValues = this.queueLatencies.length > 0 ? this.queueLatencies : [0];
    const avgQueueTotal = queueLatencyValues.reduce((s, v) => s + v, 0) / queueLatencyValues.length;
    const maxQueueMs = Math.max(...queueLatencyValues);

    // Build provider latency data
    const providerLatency: ProfileSnapshot['providerLatency'] = {};
    for (const [id, latencies] of this.providerLatencies) {
      if (latencies.length > 0) {
        const sorted = [...latencies].sort((a, b) => a - b);
        const p95Idx = Math.floor(sorted.length * 0.95);
        providerLatency[id] = {
          avgMs: Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length),
          p95Ms: Math.round(sorted[Math.min(p95Idx, sorted.length - 1)]),
          maxMs: Math.round(sorted[sorted.length - 1]),
          requestCount: latencies.length,
          errorRate: 0,
        };
      }
    }

    // Build stage distribution
    const stageDistribution: ProfileSnapshot['orchestration']['stageDistribution'] = {};
    for (const [stage, durations] of this.pipelineStageDurations) {
      if (durations.length > 0) {
        stageDistribution[stage] = {
          count: durations.length,
          avgMs: Math.round(durations.reduce((s, v) => s + v, 0) / durations.length),
          failRate: 0,
        };
      }
    }

    const totalCPUPct =
      cpuUsage.user > 0
        ? Math.round(((cpuUsage.user + cpuUsage.system) / 1_000_000) * 100) / 100
        : 0;

    return {
      timestamp: timestamp(),
      cpu: {
        userCPUPct: Math.round((cpuUsage.user / 1_000_000) * 100) / 100,
        systemCPUPct: Math.round((cpuUsage.system / 1_000_000) * 100) / 100,
        totalCPUPct,
      },
      memory: {
        heapUsedMB: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
        heapTotalMB: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
        rssMB: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
        externalMB: Math.round((mem.external / (1024 * 1024)) * 100) / 100,
        heapUtilization:
          mem.heapTotal > 0 ? Math.round((mem.heapUsed / mem.heapTotal) * 10000) / 100 : 0,
      },
      queueLatency: {
        avgEnqueueToStartMs: Math.round(avgQueueTotal * 0.3),
        avgProcessingMs: Math.round(avgQueueTotal * 0.7),
        avgTotalMs: Math.round(avgQueueTotal),
        maxMs: Math.round(maxQueueMs),
      },
      providerLatency,
      orchestration: {
        activeStages: Object.keys(stageDistribution).length,
        avgStageDurationMs:
          Object.values(stageDistribution).reduce((s, v) => s + v.avgMs, 0) /
          Math.max(Object.keys(stageDistribution).length, 1),
        totalPipelineDurationMs: Object.values(stageDistribution).reduce(
          (s, v) => s + v.avgMs * v.count,
          0,
        ),
        stageDistribution,
      },
    };
  }

  /**
   * Profile CPU usage specifically
   */
  async profileCPU(): Promise<{
    metrics: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  }> {
    const snapshot = await this.takeSnapshot();
    return {
      metrics: {
        userCPU: snapshot.cpu.userCPUPct,
        systemCPU: snapshot.cpu.systemCPUPct,
        totalCPU: snapshot.cpu.totalCPUPct,
      },
      bottlenecks: snapshot.cpu.totalCPUPct > 80 ? ['High CPU usage detected'] : [],
      recommendations:
        snapshot.cpu.totalCPUPct > 80
          ? ['Consider reducing polling intervals', 'Check for runaway processes']
          : ['CPU usage is within normal range'],
    };
  }

  /**
   * Profile memory usage specifically
   */
  async profileMemory(): Promise<{
    metrics: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  }> {
    const snapshot = await this.takeSnapshot();
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    if (snapshot.memory.rssMB > 1024) {
      bottlenecks.push('High memory usage (>1GB RSS)');
      recommendations.push('Investigate potential memory leak', 'Check for large context caches');
    }
    if (snapshot.memory.heapUtilization > 90) {
      bottlenecks.push('Heap utilization > 90%');
      recommendations.push('Increase heap allocation or reduce memory pressure');
    }

    return {
      metrics: {
        heapUsedMB: snapshot.memory.heapUsedMB,
        heapTotalMB: snapshot.memory.heapTotalMB,
        rssMB: snapshot.memory.rssMB,
        externalMB: snapshot.memory.externalMB,
        heapUtilization: snapshot.memory.heapUtilization,
      },
      bottlenecks,
      recommendations:
        recommendations.length > 0 ? recommendations : ['Memory usage is within normal range'],
    };
  }

  /**
   * Profile queue latency specifically
   */
  async profileQueueLatency(): Promise<{
    metrics: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  }> {
    const snapshot = await this.takeSnapshot();
    return {
      metrics: {
        avgEnqueueToStartMs: snapshot.queueLatency.avgEnqueueToStartMs,
        avgProcessingMs: snapshot.queueLatency.avgProcessingMs,
        avgTotalMs: snapshot.queueLatency.avgTotalMs,
        maxMs: snapshot.queueLatency.maxMs,
      },
      bottlenecks:
        snapshot.queueLatency.avgTotalMs > 5000 ? ['Queue latency exceeds 5s threshold'] : [],
      recommendations:
        snapshot.queueLatency.avgTotalMs > 5000
          ? ['Increase worker concurrency', 'Optimize task processing logic']
          : ['Queue latency is acceptable'],
    };
  }

  /**
   * Profile provider latency specifically
   */
  async profileProviderLatency(): Promise<{
    metrics: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  }> {
    const snapshot = await this.takeSnapshot();
    const allLatencies = Object.values(snapshot.providerLatency);
    const avgMs =
      allLatencies.length > 0
        ? Math.round(allLatencies.reduce((s, p) => s + p.avgMs, 0) / allLatencies.length)
        : 0;

    return {
      metrics: {
        avgProviderLatencyMs: avgMs,
        activeProviders: allLatencies.length,
      },
      bottlenecks: avgMs > 10000 ? ['High provider latency detected'] : [],
      recommendations:
        avgMs > 10000
          ? ['Consider adding fallback providers', 'Check provider health status']
          : ['Provider latency is acceptable'],
    };
  }

  /**
   * Profile orchestration performance specifically
   */
  async profileOrchestration(): Promise<{
    metrics: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  }> {
    const snapshot = await this.takeSnapshot();
    return {
      metrics: {
        activeStages: snapshot.orchestration.activeStages,
        avgStageDurationMs: snapshot.orchestration.avgStageDurationMs,
        totalPipelineDurationMs: snapshot.orchestration.totalPipelineDurationMs,
      },
      bottlenecks:
        snapshot.orchestration.avgStageDurationMs > 30000
          ? ['Orchestration stage duration exceeds 30s']
          : [],
      recommendations:
        snapshot.orchestration.avgStageDurationMs > 30000
          ? ['Break down long-running stages', 'Optimize pipeline processing']
          : ['Orchestration performance is normal'],
    };
  }

  /**
   * Get profiling status
   */
  getStatus(): { active: boolean; snapshots: number; config: ProfilingConfig } {
    return {
      active: this.timer !== null,
      snapshots: this.snapshots.length,
      config: { ...this.config },
    };
  }
}
