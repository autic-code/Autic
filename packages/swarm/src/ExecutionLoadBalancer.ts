/**
 * ExecutionLoadBalancer — Runtime-aware balancing (#4)
 *
 * Tracks runtime pressure metrics and recommends delegation strategies:
 *   - Active workers and provider load
 *   - Queue pressure assessment
 *   - Memory and CPU pressure
 *   - Orchestration load recommendations
 *
 * All metrics are estimates from observable runtime state.
 */

import type { LoadBalancerMetrics } from '@autic/shared';

export interface LoadBalancerOptions {
  cpuThreshold?: number;
  memoryThreshold?: number;
  providerThreshold?: number;
  queueThreshold?: number;
}

export class ExecutionLoadBalancer {
  private options: Required<LoadBalancerOptions>;

  constructor(options: LoadBalancerOptions = {}) {
    this.options = {
      cpuThreshold: options.cpuThreshold ?? 80,
      memoryThreshold: options.memoryThreshold ?? 80,
      providerThreshold: options.providerThreshold ?? 70,
      queueThreshold: options.queueThreshold ?? 60,
    };
  }

  /** Assess current load and return metrics with recommendation */
  assessMetrics(params: {
    activeWorkers: number;
    totalWorkers: number;
    providerUtilization: number;
    queuePressure: number;
    memoryUsagePercent: number;
    cpuUsagePercent: number;
    pendingDelegations: number;
    activeDelegations: number;
  }): LoadBalancerMetrics {
    const cpuPressure = params.cpuUsagePercent;
    const memoryPressure = params.memoryUsagePercent;
    const providerPressure = params.providerUtilization;

    let recommendation: string;

    if (cpuPressure >= this.options.cpuThreshold || memoryPressure >= this.options.memoryThreshold) {
      recommendation = 'throttle';
    } else if (cpuPressure >= this.options.cpuThreshold * 0.8 || memoryPressure >= this.options.memoryThreshold * 0.8) {
      recommendation = 'reduce';
    } else if (providerPressure >= this.options.providerThreshold || params.queuePressure >= this.options.queueThreshold) {
      recommendation = 'caution';
    } else if (cpuPressure < 30 && memoryPressure < 30 && params.queuePressure < 20) {
      recommendation = 'scale_up';
    } else {
      recommendation = 'normal';
    }

    return {
      activeWorkers: params.activeWorkers,
      idleWorkers: params.totalWorkers - params.activeWorkers,
      totalWorkers: params.totalWorkers,
      providerUtilization: providerPressure,
      queuePressure: params.queuePressure,
      memoryPressure,
      cpuPressure,
      pendingDelegations: params.pendingDelegations,
      activeDelegations: params.activeDelegations,
      recommendation,
      timestamp: Date.now(),
    };
  }

  /** Should we scale up? */
  shouldScaleUp(metrics: LoadBalancerMetrics): boolean {
    return metrics.recommendation === 'scale_up' && metrics.pendingDelegations > metrics.activeDelegations * 2;
  }

  /** Should we throttle? */
  shouldThrottle(metrics: LoadBalancerMetrics): boolean {
    return metrics.recommendation === 'throttle';
  }

  /** Should we reduce concurrency? */
  shouldReduce(metrics: LoadBalancerMetrics): boolean {
    return metrics.recommendation === 'reduce';
  }

  /** Should we proceed with caution? */
  shouldProceedWithCaution(metrics: LoadBalancerMetrics): boolean {
    return metrics.recommendation === 'caution';
  }

  /** Calculate safe concurrency level based on load */
  calculateSafeConcurrency(metrics: LoadBalancerMetrics, baseConcurrency: number): number {
    if (this.shouldThrottle(metrics)) return Math.max(1, Math.floor(baseConcurrency / 4));
    if (this.shouldReduce(metrics)) return Math.max(1, Math.floor(baseConcurrency / 2));
    if (this.shouldProceedWithCaution(metrics)) return Math.max(1, Math.floor(baseConcurrency * 0.75));
    return baseConcurrency;
  }

  /** Get all thresholds */
  getThresholds(): Required<LoadBalancerOptions> {
    return { ...this.options };
  }

  /** Update thresholds */
  setThresholds(options: Partial<LoadBalancerOptions>): void {
    if (options.cpuThreshold !== undefined) this.options.cpuThreshold = options.cpuThreshold;
    if (options.memoryThreshold !== undefined) this.options.memoryThreshold = options.memoryThreshold;
    if (options.providerThreshold !== undefined) this.options.providerThreshold = options.providerThreshold;
    if (options.queueThreshold !== undefined) this.options.queueThreshold = options.queueThreshold;
  }
}
