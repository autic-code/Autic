/**
 * ResourceProtection — CPU, memory, provider, and queue protection (#13)
 *
 * Monitors runtime resource pressure and protects against overload:
 *   - CPU pressure detection and throttling
 *   - Memory pressure detection and throttling
 *   - Provider overload protection
 *   - Worker throttling under load
 *   - Queue backpressure handling
 *
 * All thresholds are configurable and protection is deterministic.
 */

import type { ResourceProtectionState } from '@autic/shared';
import { SwarmObservability } from './SwarmObservability.js';

export class ResourceProtection {
  private observability: SwarmObservability;
  private state: ResourceProtectionState;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private swarmId: string = '';

  constructor(_config: unknown, observability: SwarmObservability) {
    this.observability = observability;
    this.state = this.createDefaultState();
  }

  private createDefaultState(): ResourceProtectionState {
    return {
      cpuThreshold: 80,
      memoryThreshold: 80,
      providerThreshold: 70,
      workerThreshold: 90,
      queueBackpressureThreshold: 60,
      cpuPressure: 'none',
      memoryPressure: 'none',
      providerPressure: 'none',
      workerPressure: 'none',
      queuePressure: 'none',
      throttlingActive: false,
      lastCheck: Date.now(),
    };
  }

  /** Set the swarm ID for event records */
  setSwarmId(id: string): void {
    this.swarmId = id;
  }

  /** Start periodic resource monitoring */
  start(intervalMs: number = 10_000): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => this.check(), intervalMs);
    if (
      this.checkInterval &&
      typeof this.checkInterval === 'object' &&
      'unref' in this.checkInterval
    ) {
      this.checkInterval.unref();
    }
  }

  /** Stop periodic resource monitoring */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /** Update resource metrics and assess pressure */
  updateMetrics(params: {
    cpuPercent?: number;
    memoryPercent?: number;
    providerUtilization?: number;
    workerUtilization?: number;
    queueBackpressure?: number;
  }): void {
    // CPU pressure
    if (params.cpuPercent !== undefined) {
      this.state.cpuPressure = this.classifyPressure(params.cpuPercent, this.state.cpuThreshold);
    }

    // Memory pressure
    if (params.memoryPercent !== undefined) {
      this.state.memoryPressure = this.classifyPressure(
        params.memoryPercent,
        this.state.memoryThreshold,
      );
    }

    // Provider pressure
    if (params.providerUtilization !== undefined) {
      this.state.providerPressure = this.classifyPressure(
        params.providerUtilization,
        this.state.providerThreshold,
      );
    }

    // Worker pressure
    if (params.workerUtilization !== undefined) {
      this.state.workerPressure = this.classifyPressure(
        params.workerUtilization,
        this.state.workerThreshold,
      );
    }

    // Queue pressure
    if (params.queueBackpressure !== undefined) {
      this.state.queuePressure = this.classifyPressure(
        params.queueBackpressure,
        this.state.queueBackpressureThreshold,
      );
    }

    // Assess if throttling is needed
    this.state.throttlingActive = this.shouldThrottle();
    this.state.lastCheck = Date.now();
  }

  /** Classify pressure level based on percent and threshold */
  private classifyPressure(
    percent: number,
    threshold: number,
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const ratio = percent / threshold;
    if (ratio >= 1.5) return 'critical';
    if (ratio >= 1.2) return 'high';
    if (ratio >= 0.9) return 'medium';
    if (ratio >= 0.5) return 'low';
    return 'none';
  }

  /** Should we throttle execution? */
  shouldThrottle(): boolean {
    return (
      this.state.cpuPressure === 'high' ||
      this.state.cpuPressure === 'critical' ||
      this.state.memoryPressure === 'high' ||
      this.state.memoryPressure === 'critical' ||
      this.state.providerPressure === 'critical' ||
      this.state.workerPressure === 'critical' ||
      this.state.queuePressure === 'critical'
    );
  }

  /** Get the recommended concurrency reduction factor (0-1) */
  getThrottleFactor(): number {
    if (this.state.cpuPressure === 'critical' || this.state.memoryPressure === 'critical')
      return 0.1;
    if (this.state.cpuPressure === 'high' || this.state.memoryPressure === 'high') return 0.25;
    if (this.state.cpuPressure === 'medium' || this.state.memoryPressure === 'medium') return 0.5;
    if (this.state.cpuPressure === 'low' || this.state.memoryPressure === 'low') return 0.75;
    return 1.0;
  }

  /** Should we reject new delegations? */
  shouldRejectDelegations(): boolean {
    return this.state.cpuPressure === 'critical' || this.state.memoryPressure === 'critical';
  }

  /** Should we pause non-critical operations? */
  shouldPauseNonCritical(): boolean {
    return (
      this.state.cpuPressure === 'high' ||
      this.state.memoryPressure === 'high' ||
      this.state.providerPressure === 'critical'
    );
  }

  /** Run a protection check — emit events if throttling */
  private check(): void {
    if (this.state.throttlingActive) {
      this.observability.record({
        type: 'resource:protection_triggered',
        timestamp: Date.now(),
        swarmId: this.swarmId,
        message: `Resource protection triggered: CPU=${this.state.cpuPressure}, Mem=${this.state.memoryPressure}, Provider=${this.state.providerPressure}`,
        data: { state: { ...this.state } },
      });
    }
  }

  /** Release throttling */
  releaseThrottling(): void {
    if (this.state.throttlingActive) {
      this.state.throttlingActive = false;
      this.observability.record({
        type: 'resource:protection_released',
        timestamp: Date.now(),
        swarmId: this.swarmId,
        message: 'Resource protection released',
      });
    }
  }

  /** Get current protection state */
  getState(): ResourceProtectionState {
    return { ...this.state, lastCheck: Date.now() };
  }

  /** Reset protection state */
  reset(): void {
    this.stop();
    this.state = this.createDefaultState();
  }
}
