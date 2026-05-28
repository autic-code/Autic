/**
 * RateLimiter — Provider rate-limit management.
 *
 * Tracks requests-per-minute (RPM) and tokens-per-minute (TPM),
 * manages cooldowns, controls concurrency, and provides adaptive throttling.
 */

import { timestamp } from '@autic/shared';
import type { RateLimitState } from '@autic/shared';

export interface RateLimiterOptions {
  /** Max requests per minute (default: 60) */
  maxRequestsPerMinute?: number;
  /** Max tokens per minute (default: 100000) */
  maxTokensPerMinute?: number;
  /** Max concurrent requests (default: 5) */
  maxConcurrency?: number;
  /** Cooldown duration in ms after hitting rate limit (default: 30s) */
  cooldownMs?: number;
  /** Window size in ms for rate tracking (default: 60_000) */
  windowMs?: number;
}

export class RateLimiter {
  private state: Map<string, RateLimitState> = new Map();
  private queues: Map<string, Array<() => void>> = new Map();
  private defaults: {
    maxRequestsPerMinute: number;
    maxTokensPerMinute: number;
    maxConcurrency: number;
    cooldownMs: number;
    windowMs: number;
  };

  constructor(options: RateLimiterOptions = {}) {
    this.defaults = {
      maxRequestsPerMinute: options.maxRequestsPerMinute || 60,
      maxTokensPerMinute: options.maxTokensPerMinute || 100_000,
      maxConcurrency: options.maxConcurrency || 5,
      cooldownMs: options.cooldownMs || 30_000,
      windowMs: options.windowMs || 60_000,
    };
  }

  /**
   * Get the current rate-limit state for a provider.
   */
  getState(providerId: string): RateLimitState {
    let state = this.state.get(providerId);
    if (!state) {
      state = this.createFreshState(providerId);
      this.state.set(providerId, state);
    }

    // Reset window if it's expired
    const now = timestamp();
    if (now - state.lastResetAt >= this.defaults.windowMs) {
      state.requestsThisMinute = 0;
      state.tokensThisMinute = 0;
      state.lastResetAt = now;
    }

    return state;
  }

  /**
   * Check if a request is allowed for a provider.
   * Returns true if allowed, false if rate-limited.
   */
  canMakeRequest(providerId: string, estimatedTokens = 0): boolean {
    const state = this.getState(providerId);

    // Check cooldown
    if (state.cooldownUntil && timestamp() < state.cooldownUntil) {
      return false;
    }

    // Check concurrency
    if (state.activeRequests >= state.maxConcurrency) {
      return false;
    }

    // Check RPM
    if (state.requestsThisMinute >= state.maxRequestsPerMinute) {
      return false;
    }

    // Check TPM
    if (estimatedTokens > 0 && state.tokensThisMinute + estimatedTokens > state.maxTokensPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Record a request being made (increments counters).
   */
  recordRequest(providerId: string, tokensUsed = 0): void {
    const state = this.getState(providerId);
    state.requestsThisMinute++;
    state.tokensThisMinute += tokensUsed;
    state.activeRequests++;
  }

  /**
   * Record a request completing (decrements active count).
   */
  recordCompletion(providerId: string): void {
    const state = this.state.get(providerId);
    if (state) {
      state.activeRequests = Math.max(0, state.activeRequests - 1);
    }

    // Process queued requests
    this.processQueue(providerId);
  }

  /**
   * Mark a provider as rate-limited (enters cooldown).
   */
  markRateLimited(providerId: string, retryAfterMs?: number): void {
    const state = this.getState(providerId);
    const cooldown = retryAfterMs || this.defaults.cooldownMs;
    state.cooldownUntil = timestamp() + cooldown;
  }

  /**
   * Clear rate-limit state for a provider (e.g., after key rotation).
   */
  clearState(providerId: string): void {
    this.state.delete(providerId);
  }

  /**
   * Wait until a request can be made for a provider.
   * Returns a promise that resolves when the request is allowed.
   */
  async waitForSlot(providerId: string, estimatedTokens = 0, timeoutMs = 60_000): Promise<boolean> {
    if (this.canMakeRequest(providerId, estimatedTokens)) {
      return true;
    }

    // Queue the request
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);

      const queue = this.queues.get(providerId) || [];
      queue.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
      this.queues.set(providerId, queue);
    });
  }

  /**
   * Get rate-limit utilization as a percentage (0-100).
   */
  getUtilization(providerId: string): { rpmUtilization: number; tpmUtilization: number; concurrencyUtilization: number } {
    const state = this.getState(providerId);

    return {
      rpmUtilization: (state.requestsThisMinute / state.maxRequestsPerMinute) * 100,
      tpmUtilization: (state.tokensThisMinute / state.maxTokensPerMinute) * 100,
      concurrencyUtilization: (state.activeRequests / state.maxConcurrency) * 100,
    };
  }

  /**
   * Check if a provider is currently in cooldown.
   */
  isInCooldown(providerId: string): boolean {
    const state = this.state.get(providerId);
    if (!state?.cooldownUntil) return false;
    return timestamp() < state.cooldownUntil;
  }

  /**
   * Get the remaining cooldown time in ms.
   */
  getCooldownRemaining(providerId: string): number {
    const state = this.state.get(providerId);
    if (!state?.cooldownUntil) return 0;
    const remaining = state.cooldownUntil - timestamp();
    return Math.max(0, remaining);
  }

  // ---- Private helpers ----

  private createFreshState(_providerId: string): RateLimitState {
    return {
      requestsThisMinute: 0,
      maxRequestsPerMinute: this.defaults.maxRequestsPerMinute,
      tokensThisMinute: 0,
      maxTokensPerMinute: this.defaults.maxTokensPerMinute,
      lastResetAt: timestamp(),
      activeRequests: 0,
      maxConcurrency: this.defaults.maxConcurrency,
    };
  }

  private processQueue(providerId: string): void {
    const queue = this.queues.get(providerId);
    if (!queue || queue.length === 0) return;

    while (queue.length > 0 && this.canMakeRequest(providerId)) {
      const next = queue.shift();
      if (next) next();
    }
  }
}
