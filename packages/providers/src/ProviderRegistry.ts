/**
 * ProviderRegistry — Centralized provider management.
 *
 * Handles provider registration, discovery, status tracking,
 * capability detection, and lifecycle management.
 */

import { timestamp } from '@autic/shared';
import type {
  ProviderConfig,
  ProviderStatus,
  ProviderEntry,
  ProviderCapability,
} from '@autic/shared';
import type { LLMProvider } from './types.js';

export interface RegistryOptions {
  healthCheckIntervalMs?: number;
  autoHealthCheck?: boolean;
}

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();
  private statuses: Map<string, ProviderStatus> = new Map();
  private capabilities: Map<string, ProviderCapability[]> = new Map();
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private options: RegistryOptions = {}) {
    if (options.autoHealthCheck !== false) {
      this.startHealthChecks();
    }
  }

  /**
   * Register a provider with its configuration.
   */
  register(provider: LLMProvider, config: ProviderConfig): void {
    this.providers.set(provider.id, provider);
    this.configs.set(provider.id, config);
    this.statuses.set(provider.id, {
      providerId: provider.id,
      providerName: provider.name,
      status: 'unknown',
      connected: false,
      modelCount: 0,
      lastChecked: timestamp(),
    });
    this.capabilities.set(provider.id, this.detectCapabilities(provider));
  }

  /**
   * Unregister a provider by ID.
   */
  unregister(providerId: string): void {
    this.providers.delete(providerId);
    this.configs.delete(providerId);
    this.statuses.delete(providerId);
    this.capabilities.delete(providerId);
  }

  /**
   * Get a registered provider by ID.
   */
  getProvider(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get the config for a registered provider.
   */
  getConfig(providerId: string): ProviderConfig | undefined {
    return this.configs.get(providerId);
  }

  /**
   * Get all registered providers.
   */
  listProviders(): Array<{
    provider: LLMProvider;
    config: ProviderConfig;
    status: ProviderStatus;
  }> {
    const result: Array<{ provider: LLMProvider; config: ProviderConfig; status: ProviderStatus }> =
      [];
    for (const [id, provider] of this.providers) {
      const config = this.configs.get(id);
      const status = this.statuses.get(id);
      if (config && status) {
        result.push({ provider, config, status });
      }
    }
    return result;
  }

  /**
   * Get the current status for a provider.
   */
  getStatus(providerId: string): ProviderStatus | undefined {
    return this.statuses.get(providerId);
  }

  /**
   * Get capabilities for a provider.
   */
  getCapabilities(providerId: string): ProviderCapability[] {
    return this.capabilities.get(providerId) || [];
  }

  /**
   * Get a full provider entry (config + status + keys + capabilities).
   */
  getEntry(providerId: string): ProviderEntry | undefined {
    const config = this.configs.get(providerId);
    const status = this.statuses.get(providerId);
    if (!config || !status) return undefined;

    return {
      config,
      status,
      keyIds: [],
      capabilities: this.capabilities.get(providerId) || [],
    };
  }

  /**
   * Connect to a provider and update status.
   */
  async connect(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    try {
      const connected = await provider.connect();
      this.updateStatus(providerId, connected ? 'healthy' : 'unhealthy', connected);
      return connected;
    } catch (error) {
      this.updateStatus(
        providerId,
        'unhealthy',
        false,
        error instanceof Error ? error.message : 'Connection failed',
      );
      return false;
    }
  }

  /**
   * Connect to all registered providers.
   */
  async connectAll(): Promise<number> {
    let connected = 0;
    for (const [id] of this.providers) {
      if (await this.connect(id)) {
        connected++;
      }
    }
    return connected;
  }

  /**
   * Disconnect a provider.
   */
  async disconnect(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) return;
    await provider.disconnect();
    this.updateStatus(providerId, 'unknown', false);
  }

  /**
   * Disconnect all providers.
   */
  async disconnectAll(): Promise<void> {
    for (const [id] of this.providers) {
      await this.disconnect(id);
    }
  }

  /**
   * Run a health check on a specific provider.
   */
  async healthCheck(providerId: string): Promise<ProviderStatus> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        providerId,
        providerName: providerId,
        status: 'unknown',
        connected: false,
        modelCount: 0,
        lastChecked: timestamp(),
        lastError: 'Provider not registered',
      };
    }

    try {
      const start = Date.now();
      const health = await provider.healthCheck();
      const latencyMs = Date.now() - start;

      // Count models
      let modelCount = 0;
      try {
        const models = await provider.listModels();
        modelCount = models.length;
      } catch {
        // Model listing optional for health check
      }

      const status: ProviderStatus = {
        providerId: provider.id,
        providerName: provider.name,
        status: health.status,
        connected: health.status === 'healthy',
        latencyMs,
        modelCount,
        lastChecked: timestamp(),
        lastError: health.error,
      };

      this.statuses.set(providerId, status);
      return status;
    } catch (error) {
      const status: ProviderStatus = {
        providerId,
        providerName: providerId,
        status: 'unhealthy',
        connected: false,
        modelCount: 0,
        lastChecked: timestamp(),
        lastError: error instanceof Error ? error.message : 'Health check failed',
      };
      this.statuses.set(providerId, status);
      return status;
    }
  }

  /**
   * Health check all registered providers in parallel.
   */
  async healthCheckAll(): Promise<ProviderStatus[]> {
    const checks = Array.from(this.providers.keys()).map((id) => this.healthCheck(id));
    return Promise.all(checks);
  }

  /**
   * Get the first healthy provider.
   */
  getFirstHealthy(): LLMProvider | undefined {
    for (const [id, provider] of this.providers) {
      const status = this.statuses.get(id);
      if (status?.status === 'healthy' && status.connected) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Get providers matching a specific capability.
   */
  getProvidersWithCapability(capability: ProviderCapability): LLMProvider[] {
    const result: LLMProvider[] = [];
    for (const [id, provider] of this.providers) {
      const caps = this.capabilities.get(id);
      if (caps?.includes(capability)) {
        result.push(provider);
      }
    }
    return result;
  }

  /**
   * Check if a provider is registered.
   */
  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Get count of registered providers.
   */
  get count(): number {
    return this.providers.size;
  }

  /**
   * Start periodic health checks.
   */
  startHealthChecks(intervalMs?: number): void {
    this.stopHealthChecks();
    const interval = intervalMs || this.options.healthCheckIntervalMs || 60_000;
    this.healthTimer = setInterval(() => {
      this.healthCheckAll().catch(() => {});
    }, interval);
    // Unref so it doesn't keep the process alive
    if (this.healthTimer && typeof this.healthTimer === 'object' && 'unref' in this.healthTimer) {
      (this.healthTimer as ReturnType<typeof setInterval>).unref();
    }
  }

  /**
   * Stop periodic health checks.
   */
  stopHealthChecks(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
   * Dispose of all resources.
   */
  async dispose(): Promise<void> {
    this.stopHealthChecks();
    await this.disconnectAll();
    this.providers.clear();
    this.configs.clear();
    this.statuses.clear();
    this.capabilities.clear();
  }

  // ---- Private helpers ----

  private updateStatus(
    providerId: string,
    status: ProviderStatus['status'],
    connected: boolean,
    lastError?: string,
  ): void {
    const current = this.statuses.get(providerId);
    if (current) {
      this.statuses.set(providerId, {
        ...current,
        status,
        connected,
        lastChecked: timestamp(),
        lastError,
      });
    }
  }

  private detectCapabilities(provider: LLMProvider): ProviderCapability[] {
    const caps: ProviderCapability[] = ['chat'];

    // Check if provider supports streaming by checking method existence
    if (
      'stream' in provider &&
      typeof (provider as unknown as Record<string, unknown>).stream === 'function'
    ) {
      caps.push('streaming');
    }

    // Provider-specific capabilities
    switch (provider.id) {
      case 'openrouter':
        caps.push('code', 'function_calling', 'vision');
        break;
      case 'openai':
        caps.push('code', 'function_calling', 'vision', 'embedding');
        break;
      case 'anthropic':
        caps.push('code', 'function_calling', 'vision');
        break;
      case 'ollama':
        caps.push('code');
        break;
    }

    return caps;
  }
}
