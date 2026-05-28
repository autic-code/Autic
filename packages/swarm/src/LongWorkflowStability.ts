/**
 * LongWorkflowStability — Long-workflow stability controls (#14)
 *
 * Supports multi-hour autonomous workflows safely:
 *   - Orchestration cooldowns after high activity
 *   - Concurrency adaptation based on workload
 *   - Idle worker cleanup after timeout
 *   - Background coordination cleanup
 *
 * All controls are bounded and deterministic.
 */

import type { SwarmConfig, LongWorkflowStabilityState } from '@autic/shared';
import type { SwarmObservability } from './SwarmObservability.js';

export class LongWorkflowStability {
  private config: Required<SwarmConfig>;
  private observability: SwarmObservability;
  private state: LongWorkflowStabilityState;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private adaptationTimer: ReturnType<typeof setInterval> | null = null;
  private swarmId: string = '';
  private consecutiveDelegations = 0;
  private cooldownHistory: Array<{ startedAt: number; durationMs: number; reason: string }> = [];
  private maxCooldownHistory = 20;

  constructor(config: Required<SwarmConfig>, observability: SwarmObservability) {
    this.config = config;
    this.observability = observability;
    this.state = {
      cooldownActive: false,
      cooldownUntil: 0,
      adaptationLevel: 'normal',
      consecutiveDelegations: 0,
      idleWorkers: 0,
      lastCooldownAt: 0,
      totalCooldownDurationMs: 0,
    };
  }

  /** Set the swarm ID for event records */
  setSwarmId(id: string): void {
    this.swarmId = id;
  }

  /** Start periodic stability checks */
  start(): void {
    this.cleanupTimer = setInterval(() => this.runCleanup(), 60_000);
    this.adaptationTimer = setInterval(() => this.runAdaptation(), 30_000);

    if (
      this.cleanupTimer &&
      typeof this.cleanupTimer === 'object' &&
      'unref' in this.cleanupTimer
    ) {
      this.cleanupTimer.unref();
    }
    if (
      this.adaptationTimer &&
      typeof this.adaptationTimer === 'object' &&
      'unref' in this.adaptationTimer
    ) {
      this.adaptationTimer.unref();
    }
  }

  /** Stop periodic checks */
  stop(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.adaptationTimer) clearInterval(this.adaptationTimer);
    this.cleanupTimer = null;
    this.adaptationTimer = null;
  }

  /** Record a delegation for cooldown tracking */
  recordDelegation(): void {
    this.consecutiveDelegations++;
    this.state.consecutiveDelegations = this.consecutiveDelegations;

    // Check if cooldown is needed
    if (this.consecutiveDelegations >= 20 && !this.state.cooldownActive) {
      this.activateCooldown('High delegation volume');
    }
  }

  /** Record an idle worker */
  recordIdleWorker(count: number): void {
    this.state.idleWorkers = count;
  }

  /** Activate cooldown period */
  activateCooldown(reason: string): void {
    const cooldownMs = this.config.cooldownMs;
    this.state.cooldownActive = true;
    this.state.cooldownUntil = Date.now() + cooldownMs;
    this.state.adaptationLevel = 'reduced';
    this.state.lastCooldownAt = Date.now();
    this.state.totalCooldownDurationMs += cooldownMs;

    this.cooldownHistory.push({
      startedAt: Date.now(),
      durationMs: cooldownMs,
      reason,
    });

    if (this.cooldownHistory.length > this.maxCooldownHistory) {
      this.cooldownHistory = this.cooldownHistory.slice(-this.maxCooldownHistory);
    }
    this.observability.record({
      type: 'stability:cooldown',
      timestamp: Date.now(),
      swarmId: this.swarmId,
      message: `Cooldown activated: ${reason} (${cooldownMs}ms)`,
      data: { cooldownMs, reason },
    });
  }

  /** Deactivate cooldown */
  deactivateCooldown(): void {
    this.state.cooldownActive = false;
    this.state.cooldownUntil = 0;
    this.state.adaptationLevel = 'normal';
    this.consecutiveDelegations = 0;

    this.observability.record({
      type: 'stability:adaptation',
      timestamp: Date.now(),
      swarmId: this.swarmId,
      message: 'Cooldown deactivated, returning to normal operation',
    });
  }

  /** Check if cooldown is active */
  isCooldownActive(): boolean {
    if (!this.state.cooldownActive) return false;
    if (Date.now() >= this.state.cooldownUntil) {
      this.deactivateCooldown();
      return false;
    }
    return true;
  }

  /** Get the current adaptation level */
  getAdaptationLevel(): 'normal' | 'reduced' | 'minimal' | 'paused' {
    if (this.state.cooldownActive) {
      const remaining = this.state.cooldownUntil - Date.now();
      if (remaining > this.config.cooldownMs * 0.5) return 'minimal';
      return 'reduced';
    }
    return this.state.adaptationLevel;
  }

  /** Get recommended concurrency based on adaptation level */
  getRecommendedConcurrency(baseConcurrency: number): number {
    const level = this.getAdaptationLevel();
    switch (level) {
      case 'paused':
        return 0;
      case 'minimal':
        return Math.max(1, Math.floor(baseConcurrency * 0.25));
      case 'reduced':
        return Math.max(1, Math.floor(baseConcurrency * 0.5));
      case 'normal':
        return baseConcurrency;
    }
  }

  /** Run cleanup cycle */
  private runCleanup(): void {
    const now = Date.now();

    // Check for expired cooldowns
    if (this.state.cooldownActive && now >= this.state.cooldownUntil) {
      this.deactivateCooldown();
    }

    // Reset consecutive counter if enough time passed
    if (this.consecutiveDelegations > 0 && !this.state.cooldownActive) {
      this.consecutiveDelegations = Math.max(0, this.consecutiveDelegations - 5);
      this.state.consecutiveDelegations = this.consecutiveDelegations;
    }

    this.observability.record({
      type: 'stability:cleanup',
      timestamp: now,
      swarmId: this.swarmId,
      message: `Cleanup cycle: adaptation=${this.getAdaptationLevel()}, delegations=${this.consecutiveDelegations}`,
    });
  }

  /** Run adaptation assessment */
  private runAdaptation(): void {
    if (this.state.cooldownActive) return;

    const idleRatio =
      this.state.idleWorkers > 0
        ? this.state.idleWorkers / Math.max(1, this.state.idleWorkers + this.consecutiveDelegations)
        : 0;

    if (idleRatio > 0.8 && this.consecutiveDelegations < 5) {
      // Too many idle workers — nothing happening
      this.state.adaptationLevel = 'normal';
    } else if (this.consecutiveDelegations > 15) {
      // High activity — prepare for cooldown
      this.state.adaptationLevel = 'reduced';

      this.observability.record({
        type: 'stability:adaptation',
        timestamp: Date.now(),
        swarmId: this.swarmId,
        message: `Adaptation: reduced mode (${this.consecutiveDelegations} consecutive delegations)`,
      });
    }
  }

  /** Get current stability state */
  getState(): LongWorkflowStabilityState {
    return { ...this.state };
  }

  /** Get cooldown history */
  getCooldownHistory(): Array<{ startedAt: number; durationMs: number; reason: string }> {
    return [...this.cooldownHistory];
  }

  /** Get stability metrics */
  getMetrics(): {
    totalCooldowns: number;
    totalCooldownDurationMs: number;
    currentAdaptationLevel: string;
    isCooldownActive: boolean;
  } {
    return {
      totalCooldowns: this.cooldownHistory.length,
      totalCooldownDurationMs: this.state.totalCooldownDurationMs,
      currentAdaptationLevel: this.getAdaptationLevel(),
      isCooldownActive: this.state.cooldownActive,
    };
  }

  /** Reset stability state */
  reset(): void {
    this.stop();
    this.state = {
      cooldownActive: false,
      cooldownUntil: 0,
      adaptationLevel: 'normal',
      consecutiveDelegations: 0,
      idleWorkers: 0,
      lastCooldownAt: 0,
      totalCooldownDurationMs: 0,
    };
    this.consecutiveDelegations = 0;
    this.cooldownHistory = [];
  }
}
