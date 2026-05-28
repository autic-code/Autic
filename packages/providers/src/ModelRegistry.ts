/**
 * ModelRegistry — Centralized model management.
 *
 * Manages a catalog of models from all providers, tracks capabilities,
 * context windows, and local/cloud status.
 */

import { timestamp } from '@autic/shared';
import type { ModelInfo, ModelRegistryEntry, ModelCapability } from '@autic/shared';

export interface ModelRegistryOptions {
  /** Max age in ms before a model entry is considered stale (default: 5 min) */
  staleThresholdMs?: number;
}

export class ModelRegistry {
  private models: Map<string, ModelRegistryEntry> = new Map();
  private providerModels: Map<string, string[]> = new Map(); // providerId -> modelIds

  constructor() {}

  /**
   * Register a model from a provider.
   */
  registerModel(model: ModelInfo, providerId: string, isLocal: boolean): string {
    const modelId = `${providerId}:${model.id}`;

    const entry: ModelRegistryEntry = {
      model,
      providerId,
      detectedAt: timestamp(),
      lastVerifiedAt: timestamp(),
      verified: true,
      contextWindow: model.contextLength,
      isLocal,
      isInstalled: isLocal,
    };

    this.models.set(modelId, entry);

    // Track by provider
    const existing = this.providerModels.get(providerId) || [];
    if (!existing.includes(modelId)) {
      existing.push(modelId);
      this.providerModels.set(providerId, existing);
    }

    return modelId;
  }

  /**
   * Batch register models from a provider.
   */
  registerModels(models: ModelInfo[], providerId: string, isLocal: boolean): string[] {
    return models.map((m) => this.registerModel(m, providerId, isLocal));
  }

  /**
   * Unregister a model by ID.
   */
  unregisterModel(modelId: string): boolean {
    const entry = this.models.get(modelId);
    if (!entry) return false;

    this.models.delete(modelId);

    // Remove from provider tracking
    const providerIds = this.providerModels.get(entry.providerId);
    if (providerIds) {
      const idx = providerIds.indexOf(modelId);
      if (idx >= 0) providerIds.splice(idx, 1);
    }

    return true;
  }

  /**
   * Get a model entry by its registry ID (provider:model format).
   */
  getModel(modelId: string): ModelRegistryEntry | undefined {
    return this.models.get(modelId);
  }

  /**
   * Look up a model by its original model ID (without provider prefix).
   * Searches across all providers.
   */
  findModel(modelId: string): ModelRegistryEntry | undefined {
    // Direct lookup
    const direct = this.models.get(modelId);
    if (direct) return direct;

    // Search all entries by model.id
    for (const entry of this.models.values()) {
      if (entry.model.id === modelId) {
        return entry;
      }
    }

    return undefined;
  }

  /**
   * Get all models from a specific provider.
   */
  getProviderModels(providerId: string): ModelRegistryEntry[] {
    const modelIds = this.providerModels.get(providerId) || [];
    return modelIds
      .map((id) => this.models.get(id))
      .filter((m): m is ModelRegistryEntry => m !== undefined);
  }

  /**
   * Get all registered models.
   */
  getAllModels(): ModelRegistryEntry[] {
    return Array.from(this.models.values());
  }

  /**
   * Get all models matching a capability.
   */
  getModelsWithCapability(capability: ModelCapability['type']): ModelRegistryEntry[] {
    return Array.from(this.models.values()).filter((entry) =>
      entry.model.capabilities.some((c) => c.type === capability),
    );
  }

  /**
   * Get all local models.
   */
  getLocalModels(): ModelRegistryEntry[] {
    return Array.from(this.models.values()).filter((e) => e.isLocal);
  }

  /**
   * Get all cloud models.
   */
  getCloudModels(): ModelRegistryEntry[] {
    return Array.from(this.models.values()).filter((e) => !e.isLocal);
  }

  /**
   * Search models by name or ID.
   */
  searchModels(query: string): ModelRegistryEntry[] {
    const lower = query.toLowerCase();
    return Array.from(this.models.values()).filter(
      (entry) =>
        entry.model.id.toLowerCase().includes(lower) ||
        entry.model.name.toLowerCase().includes(lower) ||
        entry.providerId.toLowerCase().includes(lower),
    );
  }

  /**
   * Refresh models from a provider (register new, keep existing).
   */
  async refreshFromProvider(
    providerId: string,
    fetcher: () => Promise<ModelInfo[]>,
    isLocal: boolean,
  ): Promise<number> {
    try {
      const models = await fetcher();
      const existing = this.providerModels.get(providerId) || [];

      // Clear old models for this provider
      for (const modelId of existing) {
        this.models.delete(modelId);
      }
      this.providerModels.set(providerId, []);

      // Register fresh models
      const ids = this.registerModels(models, providerId, isLocal);

      // Mark previously installed local models
      if (isLocal) {
        for (const id of ids) {
          const entry = this.models.get(id);
          if (entry) {
            entry.isInstalled = true;
          }
        }
      }

      return ids.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get aggregate model statistics.
   */
  getStats(): {
    totalModels: number;
    localModels: number;
    cloudModels: number;
    providersWithModels: number;
    capabilities: Record<string, number>;
  } {
    const all = this.getAllModels();
    const caps: Record<string, number> = {};

    for (const entry of all) {
      for (const cap of entry.model.capabilities) {
        caps[cap.type] = (caps[cap.type] || 0) + 1;
      }
    }

    return {
      totalModels: all.length,
      localModels: all.filter((e) => e.isLocal).length,
      cloudModels: all.filter((e) => !e.isLocal).length,
      providersWithModels: this.providerModels.size,
      capabilities: caps,
    };
  }

  /**
   * Get recommended models for common tasks.
   */
  getRecommendedModels(): {
    fast: ModelRegistryEntry[];
    capable: ModelRegistryEntry[];
    local: ModelRegistryEntry[];
  } {
    const all = this.getAllModels();

    return {
      fast: all
        .filter(
          (e) =>
            e.model.id.includes('mini') ||
            e.model.id.includes('haiku') ||
            e.model.id.includes('flash'),
        )
        .slice(0, 3),
      capable: all
        .filter(
          (e) =>
            e.model.id.includes('gpt-4o') ||
            e.model.id.includes('sonnet') ||
            e.model.id.includes('opus') ||
            e.model.id.includes('claude-3.5'),
        )
        .slice(0, 3),
      local: all.filter((e) => e.isLocal).slice(0, 3),
    };
  }

  /**
   * Clear all models.
   */
  clear(): void {
    this.models.clear();
    this.providerModels.clear();
  }
}
