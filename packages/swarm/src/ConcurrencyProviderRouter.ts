/**
 * ConcurrencyProviderRouter — Concurrency-aware provider routing (#9)
 *
 * Integrates swarm orchestration with provider runtime:
 *   - Provider load awareness for routing decisions
 *   - Rate-limit-aware delegation routing
 *   - Queue-aware provider selection
 *   - Fallback-aware coordination
 *
 * Prevents provider overload during parallel execution.
 */

import type { ConcurrencyRouteDecision } from '@autic/shared';

export interface ProviderInfo {
  id: string;
  name: string;
  load: number;        // 0-100: current utilization
  queueDepth: number;   // How many requests queued
  rateLimited: boolean;
  cooldownUntil: number;
  avgLatencyMs: number;
  healthy: boolean;
}

export class ConcurrencyProviderRouter {
  private providers: Map<string, ProviderInfo> = new Map();

  constructor(_config: unknown) {
    // config reserved for future provider-aware routing
  }

  /** Register or update a provider's status */
  updateProvider(info: ProviderInfo): void {
    this.providers.set(info.id, info);
  }

  /** Remove a provider from routing */
  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  /** Get a provider's current info */
  getProvider(providerId: string): ProviderInfo | undefined {
    return this.providers.get(providerId);
  }

  /** List all registered providers */
  listProviders(): ProviderInfo[] {
    return Array.from(this.providers.values());
  }

  /** Select the best provider for a given model/request based on load */
  selectProvider(params: {
    preferredProviders?: string[];
    modelId?: string;
    minHealth?: boolean;
  }): ConcurrencyRouteDecision | null {
    const now = Date.now();
    const candidates = Array.from(this.providers.values())
      .filter((p) => {
        if (p.rateLimited && p.cooldownUntil > now) return false;
        if (params.minHealth && !p.healthy) return false;
        return true;
      });

    if (candidates.length === 0) return null;

    // Prefer preferred providers first
    if (params.preferredProviders && params.preferredProviders.length > 0) {
      for (const preferredId of params.preferredProviders) {
        const preferred = candidates.find((p) => p.id === preferredId);
        if (preferred) {
          return {
            providerId: preferred.id,
            modelId: params.modelId || '',
            reason: 'preferred provider available',
            loadScore: preferred.load,
            estimatedLatencyMs: preferred.avgLatencyMs,
          };
        }
      }
    }

    // Sort by load (ascending) and pick the least loaded
    candidates.sort((a, b) => a.load - b.load);
    const best = candidates[0];

    return {
      providerId: best.id,
      modelId: params.modelId || '',
      reason: `lowest load (${best.load}%)`,
      loadScore: best.load,
      estimatedLatencyMs: best.avgLatencyMs,
    };
  }

  /** Check if we should route to a fallback provider */
  shouldUseFallback(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return true;
    return provider.load > 80 || provider.rateLimited || !provider.healthy;
  }

  /** Get a ranked list of fallback providers */
  getFallbackProviders(excludeProviderId: string): ProviderInfo[] {
    const now = Date.now();
    return Array.from(this.providers.values())
      .filter((p) => p.id !== excludeProviderId && !p.rateLimited && p.cooldownUntil <= now && p.healthy)
      .sort((a, b) => a.load - b.load);
  }

  /** Increment a provider's load estimate */
  incrementLoad(providerId: string, amount: number = 5): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.load = Math.min(100, provider.load + amount);
    }
  }

  /** Decrement a provider's load estimate (after completion) */
  decrementLoad(providerId: string, amount: number = 5): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.load = Math.max(0, provider.load - amount);
    }
  }

  /** Mark a provider as rate-limited */
  markRateLimited(providerId: string, cooldownMs: number): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.rateLimited = true;
      provider.cooldownUntil = Date.now() + cooldownMs;
      provider.load = 100;
    }
  }

  /** Get aggregated provider health metrics */
  getMetrics(): {
    totalProviders: number;
    healthyProviders: number;
    rateLimitedProviders: number;
    avgLoad: number;
    avgLatencyMs: number;
  } {
    const all = Array.from(this.providers.values());
    if (all.length === 0) {
      return { totalProviders: 0, healthyProviders: 0, rateLimitedProviders: 0, avgLoad: 0, avgLatencyMs: 0 };
    }

    return {
      totalProviders: all.length,
      healthyProviders: all.filter((p) => p.healthy).length,
      rateLimitedProviders: all.filter((p) => p.rateLimited).length,
      avgLoad: Math.round(all.reduce((s, p) => s + p.load, 0) / all.length),
      avgLatencyMs: Math.round(all.reduce((s, p) => s + p.avgLatencyMs, 0) / all.length),
    };
  }

  /** Reset all provider state */
  reset(): void {
    this.providers.clear();
  }
}
