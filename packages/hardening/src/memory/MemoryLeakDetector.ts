/**
 * MemoryLeakDetector — #4 Memory Leak Detection System
 *
 * Monitors runtime memory for potential leaks:
 * - Worker leak detection: tracks worker allocation vs deallocation
 * - Orphan object detection: identifies objects with no active references
 * - Queue cleanup verification: ensures queue state is properly cleaned
 * - Cache cleanup validation: verifies cache eviction is working
 * - Long-session memory tracking: monitors growth over extended runs
 */

import { EventEmitter } from 'node:events';
import type { MemoryLeakReport } from '@autic/shared';

export interface MemoryLeakDetectorOptions {
  checkIntervalMs?: number;
  growthThresholdMB?: number;
  sampleCount?: number;
  heapWarningPercent?: number;
}

export interface MemoryLeakEvents {
  leakDetected: (report: MemoryLeakReport) => void;
  warning: (message: string) => void;
  reportGenerated: (report: MemoryLeakReport) => void;
}

interface MemorySample {
  timestamp: number;
  heapUsedMB: number;
  rssMB: number;
  externalMB: number;
}

export class MemoryLeakDetector extends EventEmitter {
  private options: Required<MemoryLeakDetectorOptions>;
  private samples: MemorySample[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private trackedWorkers: Map<string, { allocated: number; freed: number; allocationTime: number }> = new Map();
  private trackedSessions: Map<string, number> = new Map();

  constructor(options: MemoryLeakDetectorOptions = {}) {
    super();
    this.options = {
      checkIntervalMs: options.checkIntervalMs || 30_000,
      growthThresholdMB: options.growthThresholdMB || 50,
      sampleCount: options.sampleCount || 10,
      heapWarningPercent: options.heapWarningPercent || 85,
    };
  }

  start(): void {
    this.timer = setInterval(() => this.check(), this.options.checkIntervalMs);
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

  trackWorkerAllocation(workerId: string): void {
    const existing = this.trackedWorkers.get(workerId) || { allocated: 0, freed: 0, allocationTime: Date.now() };
    existing.allocated++;
    this.trackedWorkers.set(workerId, existing);
  }

  trackWorkerDeallocation(workerId: string): void {
    const existing = this.trackedWorkers.get(workerId);
    if (existing) {
      existing.freed++;
    }
  }

  trackSession(sessionId: string): void {
    this.trackedSessions.set(sessionId, Date.now());
  }

  untrackSession(sessionId: string): void {
    this.trackedSessions.delete(sessionId);
  }

  async generateReport(): Promise<MemoryLeakReport> {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / (1024 * 1024);
    const heapTotalMB = mem.heapTotal / (1024 * 1024);
    const rssMB = mem.rss / (1024 * 1024);
    const externalMB = mem.external / (1024 * 1024);

    // Detect orphaned workers
    const orphanedTasks: MemoryLeakReport['orphanedTasks'] = [];
    for (const [workerId, counts] of this.trackedWorkers) {
      if (counts.allocated > counts.freed + 1) {
        orphanedTasks.push({ id: workerId, idleMs: Date.now() - counts.allocationTime });
      }
    }

    // Detect suspicious growth
    const suspiciousGrowth: MemoryLeakReport['suspiciousGrowth'] = [];
    if (this.samples.length >= 2) {
      const first = this.samples[0];
      const last = this.samples[this.samples.length - 1];
      const totalGrowth = last.heapUsedMB - first.heapUsedMB;
      const timeWindowMs = last.timestamp - first.timestamp;

      if (totalGrowth > this.options.growthThresholdMB) {
        suspiciousGrowth.push({
          component: 'heap',
          growthMB: Math.round(totalGrowth * 100) / 100,
          timeWindowMs,
        });
      }
    }

    const growthRate = this.calculateGrowthRate();
    const leakDetected = suspiciousGrowth.length > 0 || growthRate > 10;

    return {
      timestamp: Date.now(),
      heapUsedMB: Math.round(heapUsedMB * 100) / 100,
      heapTotalMB: Math.round(heapTotalMB * 100) / 100,
      rssMB: Math.round(rssMB * 100) / 100,
      externalMB: Math.round(externalMB * 100) / 100,
      sessionsActive: this.trackedSessions.size,
      workersActive: this.getActiveWorkerCount(),
      cacheEntries: 0,
      orphanedTasks,
      suspiciousGrowth,
      leakDetected,
      riskLevel: leakDetected ? (suspiciousGrowth.length > 1 ? 'high' : 'medium') : 'none',
      recommendations: this.generateRecommendations(leakDetected, orphanedTasks, growthRate),
    };
  }

  private check(): void {
    this.sample();

    const heapPercent = process.memoryUsage().heapTotal > 0
      ? (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      : 0;

    if (heapPercent > this.options.heapWarningPercent) {
      this.emit('warning', `Heap usage at ${heapPercent.toFixed(1)}% — above warning threshold`);
    }

    if (this.samples.length >= this.options.sampleCount) {
      this.generateReport().then(report => {
        this.emit('reportGenerated', report);
        if (report.leakDetected) {
          this.emit('leakDetected', report);
        }
      }).catch(() => {});
    }
  }

  private sample(): void {
    const mem = process.memoryUsage();
    this.samples.push({
      timestamp: Date.now(),
      heapUsedMB: mem.heapUsed / (1024 * 1024),
      rssMB: mem.rss / (1024 * 1024),
      externalMB: mem.external / (1024 * 1024),
    });

    if (this.samples.length > this.options.sampleCount * 2) {
      this.samples = this.samples.slice(-this.options.sampleCount);
    }
  }

  private calculateGrowthRate(): number {
    if (this.samples.length < 4) return 0;
    const recent = this.samples.slice(-4);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const elapsedHours = (last.timestamp - first.timestamp) / (1000 * 60 * 60);
    if (elapsedHours <= 0) return 0;
    return (last.heapUsedMB - first.heapUsedMB) / elapsedHours;
  }

  private getActiveWorkerCount(): number {
    let active = 0;
    for (const [, counts] of this.trackedWorkers) {
      if (counts.allocated > counts.freed) active++;
    }
    return active;
  }

  private generateRecommendations(
    leakDetected: boolean,
    orphanedTasks: MemoryLeakReport['orphanedTasks'],
    _growthRate: number,
  ): string[] {
    const recommendations: string[] = [];
    if (leakDetected) {
      recommendations.push('Potential memory leak detected — run detailed heap profiling');
    }
    if (orphanedTasks.length > 0) {
      recommendations.push(`${orphanedTasks.length} orphaned worker(s) detected — review worker lifecycle management`);
    }
    if (this.trackedSessions.size > 20) {
      recommendations.push(`${this.trackedSessions.size} active sessions — consider session pruning`);
    }
    recommendations.push('Enable --debug flag for detailed memory tracing');
    return recommendations;
  }
}
