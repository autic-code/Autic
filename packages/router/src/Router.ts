/**
 * Router for dispatching tasks to the appropriate provider or handler.
 * Maps model requests to the correct provider based on configuration.
 *
 * Enhanced with:
 * - Provider selection strategies (priority, fallback, round-robin, lowest-latency, preferred)
 * - Fallback chain support
 * - Local/cloud selection hooks
 * - Multi-key routing support (via KeyManager)
 * - Rate-limit awareness (via RateLimiter)
 */

import type { ChatRequest, ChatResponse, ModelInfo, RoutingConfig, RoutingStrategy } from '@autic/shared';
import type { LLMProvider, ProviderRegistry, RateLimiter } from '@autic/providers';

export interface RoutingRule {
  pattern: string;
  providerId: string;
  priority: number;
}

export interface RoutingMetrics {
  providerId: string;
  latencyMs: number;
  successCount: number;
  failureCount: number;
  lastUsedAt: number;
}

export class Router {
  private providers: Map<string, LLMProvider> = new Map();
  private rules: RoutingRule[] = [];
  private metrics: Map<string, RoutingMetrics> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();

  private registry?: ProviderRegistry;
  private rateLimiter?: RateLimiter;

  private strategy: RoutingStrategy = 'priority';
  private defaultConfig: RoutingConfig = {
    strategy: 'priority',
    fallbackProviders: [],
    allowLocal: true,
    allowCloud: true,
    maxRetries: 2,
    timeoutMs: 60_000,
  };

  // === Integration Hooks ===

  setRegistry(registry: ProviderRegistry): void {
    this.registry = registry;
  }

  setRateLimiter(rateLimiter: RateLimiter): void {
    this.rateLimiter = rateLimiter;
  }

  setStrategy(strategy: RoutingStrategy): void {
    this.strategy = strategy;
  }

  setDefaultConfig(config: Partial<RoutingConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  // === Provider Management ===

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    this.metrics.set(provider.id, {
      providerId: provider.id,
      latencyMs: 0,
      successCount: 0,
      failureCount: 0,
      lastUsedAt: 0,
    });
  }

  unregisterProvider(id: string): void {
    this.providers.delete(id);
    this.metrics.delete(id);
    this.roundRobinIndex.delete(id);
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  listProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  // === Routing Rules ===

  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(pattern: string): void {
    this.rules = this.rules.filter((r) => r.pattern !== pattern);
  }

  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  // === Routing ===

  /**
   * Route a model ID to the appropriate provider.
   * Uses the configured strategy to select among available providers.
   */
  route(modelId: string, config?: Partial<RoutingConfig>): LLMProvider | undefined {
    const routingConfig = { ...this.defaultConfig, ...config };

    // For fallback strategy, collect all matching providers
    if (routingConfig.strategy === 'fallback' || this.strategy === 'fallback') {
      return this.routeWithFallback(modelId, routingConfig);
    }

    // For round-robin strategy
    if (routingConfig.strategy === 'round_robin' || this.strategy === 'round_robin') {
      return this.routeRoundRobin(modelId, routingConfig);
    }

    // For lowest-latency strategy
    if (routingConfig.strategy === 'lowest_latency' || this.strategy === 'lowest_latency') {
      return this.routeLowestLatency(modelId, routingConfig);
    }

    // For preferred provider strategy
    if (routingConfig.strategy === 'preferred' || this.strategy === 'preferred') {
      return this.routePreferred(modelId, routingConfig);
    }

    // Default: priority-based routing (original behavior)
    return this.routePriority(modelId);
  }

  /**
   * Get all providers that can handle a model, in priority order.
   */
  getAvailableProviders(modelId: string): Array<{ provider: LLMProvider; score: number }> {
    const candidates: Array<{ provider: LLMProvider; score: number }> = [];

    for (const [id, provider] of this.providers) {
      let score = 0;

      // Direct model match = highest score
      const direct = this.rules.find((r) => r.providerId === id && (modelId.startsWith(r.pattern) || modelId.includes(r.pattern)));
      if (direct) {
        score = direct.priority;
      }

      // Health check via registry
      if (this.registry) {
        const status = this.registry.getStatus(id);
        if (status?.status === 'healthy') score += 50;
        if (status?.connected) score += 30;
        if (status?.status === 'rate_limited') score -= 100;
      }

      // Rate-limit awareness
      if (this.rateLimiter) {
        if (this.rateLimiter.canMakeRequest(id)) {
          score += 10;
        } else {
          score -= 50;
        }
      }

      candidates.push({ provider, score });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  // === Chat Execution ===

  async chat(request: ChatRequest, config?: Partial<RoutingConfig>): Promise<ChatResponse> {
    const provider = this.route(request.model, config);
    if (!provider) {
      throw new Error(`No provider found for model: ${request.model}`);
    }

    // Rate-limit check if limiter is configured
    if (this.rateLimiter) {
      if (!this.rateLimiter.canMakeRequest(provider.id)) {
        // Try fallback if available
        const fallback = this.findFallback(request.model, provider.id);
        if (fallback) {
          return this.executeWithTracking(fallback, request);
        }
      }

      this.rateLimiter.recordRequest(provider.id);
    }

    return this.executeWithTracking(provider, request);
  }

  /**
   * Chat with automatic fallback on failure.
   */
  async chatWithFallback(request: ChatRequest, config?: Partial<RoutingConfig>): Promise<ChatResponse> {
    const routingConfig = { ...this.defaultConfig, ...config };
    const maxRetries = routingConfig.maxRetries || 2;

    let lastError: Error | undefined;

    // Try providers in priority order
    const providerChain = this.buildFallbackChain(request.model, routingConfig);

    for (let i = 0; i < providerChain.length && i <= maxRetries; i++) {
      const provider = providerChain[i];
      if (!provider) continue;

      try {
        // Rate-limit check
        if (this.rateLimiter && !this.rateLimiter.canMakeRequest(provider.id)) {
          continue; // Skip rate-limited providers
        }

        this.rateLimiter?.recordRequest(provider.id);
        return await this.executeWithTracking(provider, request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(provider.id);

        // Mark as rate-limited if applicable
        if (this.rateLimiter) {
          this.rateLimiter.markRateLimited(provider.id);
        }
      }
    }

    throw lastError || new Error(`All providers failed for model: ${request.model}`);
  }

  // === Model Listing ===

  async listAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels();
        allModels.push(...models);
      } catch {
        // Skip providers that fail to list models
      }
    }
    return allModels;
  }

  async listProviderModels(providerId: string): Promise<ModelInfo[]> {
    const provider = this.providers.get(providerId);
    if (!provider) return [];
    try {
      return await provider.listModels();
    } catch {
      return [];
    }
  }

  // === Health Checks ===

  async healthCheckAll(): Promise<
    Array<{ providerId: string; status: string; error?: string }>
  > {
    const results: Array<{ providerId: string; status: string; error?: string }> = [];
    for (const provider of this.providers.values()) {
      try {
        const health = await provider.healthCheck();
        results.push({
          providerId: provider.id,
          status: health.status,
        });
      } catch (error) {
        results.push({
          providerId: provider.id,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return results;
  }

  // === Metrics ===

  getMetrics(providerId: string): RoutingMetrics | undefined {
    return this.metrics.get(providerId);
  }

  getAllMetrics(): RoutingMetrics[] {
    return Array.from(this.metrics.values());
  }

  // ---- Private Implementation ----

  private executeWithTracking(provider: LLMProvider, request: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    return provider.chat(request).then((response) => {
      const latency = Date.now() - start;
      this.recordSuccess(provider.id, latency);
      return response;
    }).catch((error) => {
      this.recordFailure(provider.id);
      throw error;
    });
  }

  private recordSuccess(providerId: string, latencyMs: number): void {
    const m = this.metrics.get(providerId);
    if (m) {
      m.successCount++;
      m.latencyMs = m.latencyMs === 0 ? latencyMs : Math.round((m.latencyMs + latencyMs) / 2);
      m.lastUsedAt = Date.now();
    }
  }

  private recordFailure(providerId: string): void {
    const m = this.metrics.get(providerId);
    if (m) {
      m.failureCount++;
      m.lastUsedAt = Date.now();
    }
  }

  // ---- Routing Strategies ----

  private routePriority(modelId: string): LLMProvider | undefined {
    // Direct provider match
    const directProvider = this.providers.get(modelId);
    if (directProvider) return directProvider;

    // Pattern-based routing
    for (const rule of this.rules) {
      if (modelId.startsWith(rule.pattern) || modelId.includes(rule.pattern)) {
        const provider = this.providers.get(rule.providerId);
        if (provider) return provider;
      }
    }

    // Default: first available provider
    return this.providers.values().next().value;
  }

  private routeWithFallback(modelId: string, config: RoutingConfig): LLMProvider | undefined {
    const chain = this.buildFallbackChain(modelId, config);
    return chain[0];
  }

  private routeRoundRobin(modelId: string, config: RoutingConfig): LLMProvider | undefined {
    const chain = this.buildFallbackChain(modelId, config);
    if (chain.length === 0) return undefined;

    const idx = (this.roundRobinIndex.get(modelId) || 0) % chain.length;
    this.roundRobinIndex.set(modelId, idx + 1);
    return chain[idx];
  }

  private routeLowestLatency(modelId: string, config: RoutingConfig): LLMProvider | undefined {
    const chain = this.buildFallbackChain(modelId, config);
    if (chain.length === 0) return undefined;

    // Find provider with lowest average latency
    let best = chain[0];
    let bestLatency = this.metrics.get(best.id)?.latencyMs ?? Infinity;

    for (const provider of chain) {
      const latency = this.metrics.get(provider.id)?.latencyMs ?? Infinity;
      if (latency < bestLatency) {
        bestLatency = latency;
        best = provider;
      }
    }

    return best;
  }

  private routePreferred(modelId: string, config: RoutingConfig): LLMProvider | undefined {
    // Try preferred provider first
    if (config.preferredProvider) {
      const preferred = this.providers.get(config.preferredProvider);
      if (preferred) return preferred;
    }

    // Fall back to priority
    return this.routePriority(modelId);
  }

  private findFallback(modelId: string, currentProviderId: string): LLMProvider | undefined {
    const candidates = this.getAvailableProviders(modelId);
    return candidates.find((c) => c.provider.id !== currentProviderId)?.provider;
  }

  private buildFallbackChain(modelId: string, config: RoutingConfig): LLMProvider[] {
    const chain: LLMProvider[] = [];

    // Add primary match
    const primary = this.routePriority(modelId);
    if (primary) chain.push(primary);

    // Add explicitly configured fallbacks
    for (const fallbackId of config.fallbackProviders) {
      if (!chain.some((p) => p.id === fallbackId)) {
        const provider = this.providers.get(fallbackId);
        if (provider) chain.push(provider);
      }
    }

    // Add all remaining healthy providers
    for (const [id, provider] of this.providers) {
      if (!chain.some((p) => p.id === id)) {
        chain.push(provider);
      }
    }

    return chain;
  }
}

export function createDefaultRouter(): Router {
  const router = new Router();
  router.setDefaultConfig({
    strategy: 'fallback',
    fallbackProviders: [],
    allowLocal: true,
    allowCloud: true,
    maxRetries: 2,
    timeoutMs: 60_000,
  });
  return router;
}
