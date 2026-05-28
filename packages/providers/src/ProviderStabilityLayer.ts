/**
 * ProviderStabilityLayer — Provider reliability and stability enhancements.
 *
 * Features:
 * - Cooldown recovery: automatic recovery after rate-limit cooldowns
 * - Retry backoff: exponential backoff with jitter for transient failures
 * - Provider health caching: caches health status to reduce health check calls
 * - Transient failure handling: detects and retries transient errors
 * - Degraded-mode execution hooks: fallback strategies when providers are degraded
 * - Consecutive failure tracking: escalates repeated failures
 */

import type { ProviderHealthCache, ProviderError } from '@autic/shared';
import { EvictableMap } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface ProviderStabilityLayerOptions {
  healthCacheTTLMs?: number;
  maxConsecutiveFailures?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  cooldownBaseMs?: number;
  degradedModeThreshold?: number;
  enableDegradedMode?: boolean;
}

export interface ProviderStabilityEvents {
  healthCached: (entry: ProviderHealthCache) => void;
  healthCacheHit: (providerId: string) => void;
  transientFailure: (providerId: string, error: string, retryCount: number) => void;
  consecutiveFailureEscalated: (providerId: string, count: number) => void;
  degradedModeActivated: (providerId: string) => void;
  degradedModeDeactivated: (providerId: string) => void;
  cooldownStarted: (providerId: string, durationMs: number) => void;
  cooldownEnded: (providerId: string) => void;
}

interface ProviderState {
  consecutiveFailures: number;
  inDegradedMode: boolean;
  inCooldown: boolean;
  cooldownUntil: number;
  lastError: string;
  totalFailures: number;
  totalSuccesses: number;
}

export class ProviderStabilityLayer extends EventEmitter {
  private options: Required<ProviderStabilityLayerOptions>;
  private healthCache: EvictableMap<string, ProviderHealthCache> = new EvictableMap<string, ProviderHealthCache>(200);
  private providerStates: Map<string, ProviderState> = new Map();

  constructor(options: ProviderStabilityLayerOptions = {}) {
    super();
    this.options = {
      healthCacheTTLMs: options.healthCacheTTLMs || 60_000,
      maxConsecutiveFailures: options.maxConsecutiveFailures || 5,
      baseRetryDelayMs: options.baseRetryDelayMs || 1000,
      maxRetryDelayMs: options.maxRetryDelayMs || 60_000,
      cooldownBaseMs: options.cooldownBaseMs || 30_000,
      degradedModeThreshold: options.degradedModeThreshold || 3,
      enableDegradedMode: options.enableDegradedMode ?? true,
    };
  }

  // --- Health Cache ---

  getCachedHealth(providerId: string): ProviderHealthCache | undefined {
    const cached = this.healthCache.get(providerId);
    if (!cached) return undefined;

    // Check TTL
    if (Date.now() - cached.lastChecked > this.options.healthCacheTTLMs) {
      this.healthCache.delete(providerId);
      return undefined;
    }

    this.emit('healthCacheHit', providerId);
    return cached;
  }

  updateHealthCache(
    providerId: string,
    healthy: boolean,
    latencyMs: number,
    error?: string,
  ): ProviderHealthCache {
    const existing = this.healthCache.get(providerId);
    const consecutiveFailures = healthy ? 0 : (existing?.consecutiveFailures || 0) + 1;

    const entry: ProviderHealthCache = {
      providerId,
      healthy,
      lastChecked: Date.now(),
      latencyMs,
      consecutiveFailures,
      cooldownUntil: 0,
      degraded: consecutiveFailures >= this.options.degradedModeThreshold,
      lastError: error,
    };

    this.healthCache.set(providerId, entry);
    this.emit('healthCached', entry);

    return entry;
  }

  invalidateHealthCache(providerId: string): void {
    this.healthCache.delete(providerId);
  }

  // --- Retry Backoff ---

  /**
   * Calculate retry delay with exponential backoff and jitter.
   */
  getRetryDelay(providerId: string, retryCount: number): number {
    // Check cooldown
    const state = this.getOrCreateState(providerId);
    if (state.inCooldown) {
      const remaining = state.cooldownUntil - Date.now();
      if (remaining > 0) return remaining;
      state.inCooldown = false;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.options.baseRetryDelayMs * Math.pow(2, retryCount),
      this.options.maxRetryDelayMs,
    );

    // Add jitter: ±20%
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(100, Math.round(delay + jitter));
  }

  // --- Transient Failure Handling ---

  /**
   * Classify an error as transient or permanent.
   */
  isTransientError(error: ProviderError): boolean {
    const transientCodes = [
      'timeout',
      'rate_limited',
      'network_error',
      'provider_offline',
      'internal_error',
    ];

    if (transientCodes.includes(error.code)) return true;

    // Network-level errors are often transient
    if (error.originalError?.includes('ECONNRESET') ||
        error.originalError?.includes('ETIMEDOUT') ||
        error.originalError?.includes('ECONNREFUSED')) {
      return true;
    }

    return false;
  }

  /**
   * Handle a transient failure. Returns retry info.
   */
  handleTransientFailure(
    providerId: string,
    error: string,
    retryCount: number,
  ): { shouldRetry: boolean; delayMs: number } {
    const state = this.getOrCreateState(providerId);
    state.consecutiveFailures++;
    state.totalFailures++;
    state.lastError = error;

    this.emit('transientFailure', providerId, error, retryCount);

    // Check if we need to escalate
    if (state.consecutiveFailures >= this.options.maxConsecutiveFailures) {
      this.escalateConsecutiveFailures(providerId, state);
      return { shouldRetry: false, delayMs: 0 };
    }

    const delayMs = this.getRetryDelay(providerId, retryCount);
    return { shouldRetry: true, delayMs };
  }

  /**
   * Record a successful call.
   */
  recordSuccess(providerId: string): void {
    const state = this.getOrCreateState(providerId);
    state.consecutiveFailures = 0;
    state.totalSuccesses++;

    // Check if we can exit degraded mode
    if (state.inDegradedMode && state.consecutiveFailures === 0 && state.totalSuccesses >= 3) {
      state.inDegradedMode = false;
      this.emit('degradedModeDeactivated', providerId);
    }
  }

  // --- Cooldown Management ---

  /**
   * Start a cooldown period for a provider.
   */
  startCooldown(providerId: string, durationMs?: number): void {
    const state = this.getOrCreateState(providerId);
    const cooldownDuration = durationMs || this.options.cooldownBaseMs * Math.pow(2, state.consecutiveFailures);
    state.inCooldown = true;
    state.cooldownUntil = Date.now() + cooldownDuration;

    this.emit('cooldownStarted', providerId, cooldownDuration);
  }

  /**
   * Check if a provider is in cooldown.
   */
  isInCooldown(providerId: string): boolean {
    const state = this.providerStates.get(providerId);
    if (!state?.inCooldown) return false;

    if (Date.now() >= state.cooldownUntil) {
      state.inCooldown = false;
      this.emit('cooldownEnded', providerId);
      return false;
    }

    return true;
  }

  /**
   * Get remaining cooldown time.
   */
  getCooldownRemaining(providerId: string): number {
    const state = this.providerStates.get(providerId);
    if (!state?.inCooldown) return 0;
    return Math.max(0, state.cooldownUntil - Date.now());
  }

  /**
   * Cooldown-aware wrapper that coordinates with RateLimiter.
   * Use this instead of directly calling startCooldown/isInCooldown
   * when a RateLimiter is also managing the same provider.
   */
  synchronizeCooldown(rateLimiter: {
    markRateLimited: (providerId: string, retryAfterMs?: number) => void;
    isInCooldown: (providerId: string) => boolean;
    getCooldownRemaining: (providerId: string) => number;
  }, providerId: string, _durationMs?: number): void {
    // Sync cooldown from this layer to the rate limiter
    if (this.isInCooldown(providerId)) {
      const remaining = this.getCooldownRemaining(providerId);
      rateLimiter.markRateLimited(providerId, remaining);
    } else if (rateLimiter.isInCooldown(providerId)) {
      // Reverse sync: rate limiter has a cooldown this layer doesn't know about
      this.startCooldown(providerId, rateLimiter.getCooldownRemaining(providerId));
    }
  }

  // --- Degraded Mode ---

  isDegraded(providerId: string): boolean {
    const state = this.providerStates.get(providerId);
    return state?.inDegradedMode || false;
  }

  /**
   * Get fallback provider recommendations when degraded.
   */
  getDegradedFallbackStrategy(providerId: string): {
    useFallback: boolean;
    fallbackPriority: string[];
    timeoutMultiplier: number;
  } {
    const state = this.providerStates.get(providerId);
    if (!state?.inDegradedMode) {
      return { useFallback: false, fallbackPriority: [], timeoutMultiplier: 1 };
    }

    return {
      useFallback: true,
      fallbackPriority: ['openrouter', 'openai', 'anthropic'],
      timeoutMultiplier: 1.5,
    };
  }

  // --- Provider State ---

  getProviderState(providerId: string): {
    consecutiveFailures: number;
    inDegradedMode: boolean;
    inCooldown: boolean;
    totalFailures: number;
    totalSuccesses: number;
    lastError: string;
  } | undefined {
    const state = this.providerStates.get(providerId);
    if (!state) return undefined;
    return { ...state };
  }

  resetProviderState(providerId: string): void {
    this.providerStates.delete(providerId);
    this.healthCache.delete(providerId);
  }

  // --- Private ---

  private getOrCreateState(providerId: string): ProviderState {
    let state = this.providerStates.get(providerId);
    if (!state) {
      state = {
        consecutiveFailures: 0,
        inDegradedMode: false,
        inCooldown: false,
        cooldownUntil: 0,
        lastError: '',
        totalFailures: 0,
        totalSuccesses: 0,
      };
      this.providerStates.set(providerId, state);
    }
    return state;
  }

  private escalateConsecutiveFailures(providerId: string, state: ProviderState): void {
    this.emit('consecutiveFailureEscalated', providerId, state.consecutiveFailures);

    if (this.options.enableDegradedMode && !state.inDegradedMode) {
      state.inDegradedMode = true;
      this.emit('degradedModeActivated', providerId);
    }

    this.startCooldown(providerId);
  }
}
