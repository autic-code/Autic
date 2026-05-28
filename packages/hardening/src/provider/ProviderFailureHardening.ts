/**
 * ProviderFailureHardener — #3 Provider Failure Hardening
 *
 * Extends provider reliability with:
 * - Outage recovery
 * - Cascading-failure prevention
 * - Degraded-mode execution
 * - Provider isolation
 * - Safe fallback handling
 */

import { EventEmitter } from 'node:events';
import type { ProviderHardeningState, CascadingFailureState } from '@autic/shared';

export interface ProviderHardeningOptions {
  maxConsecutiveFailures?: number;
  cooldownMs?: number;
  isolationPeriodMs?: number;
  fallbackTimeoutMs?: number;
  healthCheckIntervalMs?: number;
}

export interface ProviderHardeningEvents {
  providerDegraded: (state: ProviderHardeningState) => void;
  providerIsolated: (state: ProviderHardeningState) => void;
  providerRecovered: (state: ProviderHardeningState) => void;
  cascadingFailureDetected: (state: CascadingFailureState) => void;
  cascadingFailureContained: (state: CascadingFailureState) => void;
  fallbackActivated: (primaryId: string, fallbackId: string) => void;
}

export class ProviderFailureHardener extends EventEmitter {
  private options: Required<ProviderHardeningOptions>;
  private providerStates: Map<string, ProviderHardeningState> = new Map();
  private cascadingState: CascadingFailureState | null = null;

  constructor(options: ProviderHardeningOptions = {}) {
    super();
    this.options = {
      maxConsecutiveFailures: options.maxConsecutiveFailures || 3,
      cooldownMs: options.cooldownMs || 30_000,
      isolationPeriodMs: options.isolationPeriodMs || 120_000,
      fallbackTimeoutMs: options.fallbackTimeoutMs || 10_000,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 15_000,
    };
  }

  registerProvider(providerId: string): void {
    if (!this.providerStates.has(providerId)) {
      this.providerStates.set(providerId, {
        providerId,
        status: 'healthy',
        consecutiveFailures: 0,
        cooldownUntil: 0,
        fallbackActive: false,
        fallbackProvider: undefined,
        degradedModeAt: undefined,
        isolationUntil: undefined,
        lastOutageAt: undefined,
        recoveryAttempts: 0,
        history: [],
      });
    }
  }

  recordFailure(providerId: string, error: string): void {
    const state = this.providerStates.get(providerId);
    if (!state) return;

    state.consecutiveFailures++;
    state.history.push({
      timestamp: Date.now(),
      event: 'failure',
      detail: error.slice(0, 200),
    });

    if (state.consecutiveFailures >= this.options.maxConsecutiveFailures) {
      state.status = 'degraded';
      state.cooldownUntil = Date.now() + this.options.cooldownMs;
      this.emit('providerDegraded', { ...state });

      if (state.consecutiveFailures >= this.options.maxConsecutiveFailures * 2) {
        state.status = 'isolated';
        state.isolationUntil = Date.now() + this.options.isolationPeriodMs;
        state.fallbackActive = true;
        this.emit('providerIsolated', { ...state });
        this.checkCascadingFailure(providerId);
      }
    }
  }

  recordSuccess(providerId: string): void {
    const state = this.providerStates.get(providerId);
    if (!state) return;

    const wasDegraded = state.status === 'degraded' || state.status === 'isolated';
    state.consecutiveFailures = 0;

    if (wasDegraded) {
      state.status = 'healthy';
      state.fallbackActive = false;
      state.cooldownUntil = 0;
      state.isolationUntil = 0;
      state.history.push({
        timestamp: Date.now(),
        event: 'recovery',
        detail: 'Provider recovered after consecutive successes',
      });
      this.emit('providerRecovered', { ...state });
    }
  }

  isProviderAvailable(providerId: string): boolean {
    const state = this.providerStates.get(providerId);
    if (!state) return true;
    if (state.status === 'isolated' && state.isolationUntil && Date.now() < state.isolationUntil) return false;
    if (state.status === 'degraded' && state.cooldownUntil && Date.now() < state.cooldownUntil) return false;
    return true;
  }

  getProviderState(providerId: string): ProviderHardeningState | undefined {
    const state = this.providerStates.get(providerId);
    if (!state) return undefined;
    return { ...state };
  }

  getAllProviderStates(): ProviderHardeningState[] {
    return Array.from(this.providerStates.values()).map(s => ({ ...s }));
  }

  getCascadingFailureState(): CascadingFailureState | null {
    return this.cascadingState ? { ...this.cascadingState } : null;
  }

  resetProvider(providerId: string): void {
    const state = this.providerStates.get(providerId);
    if (state) {
      state.status = 'healthy';
      state.consecutiveFailures = 0;
      state.cooldownUntil = 0;
      state.isolationUntil = 0;
      state.fallbackActive = false;
      state.fallbackProvider = undefined;
    }
  }

  private checkCascadingFailure(rootProvider: string): void {
    const affectedProviders: string[] = [];
    for (const [id, state] of this.providerStates) {
      if (id !== rootProvider && (state.status === 'isolated' || state.status === 'degraded')) {
        affectedProviders.push(id);
      }
    }

    if (affectedProviders.length >= 2) {
      this.cascadingState = {
        detected: true,
        rootProvider,
        affectedProviders,
        affectedWorkflows: [],
        timestamp: Date.now(),
        mitigationAction: 'Isolated affected providers, activating fallback chain',
        contained: true,
      };
      this.emit('cascadingFailureDetected', { ...this.cascadingState });
    }
  }

  activateFallback(primaryId: string, fallbackId: string): void {
    const state = this.providerStates.get(primaryId);
    if (state) {
      state.fallbackActive = true;
      state.fallbackProvider = fallbackId;
    }
    this.emit('fallbackActivated', primaryId, fallbackId);
  }

  getRecommendedFallback(providerId: string, availableProviders: string[]): string | undefined {
    const state = this.providerStates.get(providerId);
    if (!state || state.status === 'healthy') return undefined;

    // Pick the healthiest available provider
    const candidates = availableProviders.filter(id => {
      if (id === providerId) return false;
      const s = this.providerStates.get(id);
      return !s || (s.status === 'healthy' && !s.fallbackActive);
    });

    return candidates.length > 0 ? candidates[0] : undefined;
  }

  getDegradedModeConfig(providerId: string): { reduceConcurrency: boolean; increaseTimeout: boolean; enableRetries: boolean } {
    const state = this.providerStates.get(providerId);
    if (!state || state.status === 'healthy') {
      return { reduceConcurrency: false, increaseTimeout: false, enableRetries: false };
    }
    return {
      reduceConcurrency: state.status === 'degraded' || state.status === 'isolated',
      increaseTimeout: state.status === 'degraded',
      enableRetries: state.status === 'degraded',
    };
  }
}
