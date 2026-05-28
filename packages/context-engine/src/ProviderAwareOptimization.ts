/**
 * ProviderAwareOptimization — Provider-specific context optimization (#10)
 *
 * Routes context to the most cost-effective provider based on:
 *   - Context size (large → cloud models, small → local models)
 *   - Provider context window limits
 *   - Cost per token
 *   - Model capability requirements
 *
 * Integrated with the provider routing system for optimal selection.
 */

import type { ProviderContextRecommendation } from '@autic/shared';

interface ProviderModelSpec {
  providerId: string;
  modelId: string;
  maxContextWindow: number;
  costPerMillionInput: number;
  costPerMillionOutput: number;
  isLocal: boolean;
}

const AVAILABLE_MODELS: ProviderModelSpec[] = [
  { providerId: 'openrouter', modelId: 'gpt-4o', maxContextWindow: 128_000, costPerMillionInput: 2.5, costPerMillionOutput: 10, isLocal: false },
  { providerId: 'openrouter', modelId: 'claude-3.5-sonnet', maxContextWindow: 200_000, costPerMillionInput: 3, costPerMillionOutput: 15, isLocal: false },
  { providerId: 'openrouter', modelId: 'gemini-2.0-flash', maxContextWindow: 1_000_000, costPerMillionInput: 0.15, costPerMillionOutput: 0.6, isLocal: false },
  { providerId: 'ollama', modelId: 'codellama', maxContextWindow: 16_000, costPerMillionInput: 0, costPerMillionOutput: 0, isLocal: true },
  { providerId: 'ollama', modelId: 'llama3', maxContextWindow: 8_000, costPerMillionInput: 0, costPerMillionOutput: 0, isLocal: true },
  { providerId: 'ollama', modelId: 'qwen2.5-coder', maxContextWindow: 32_000, costPerMillionInput: 0, costPerMillionOutput: 0, isLocal: true },
];

export class ProviderAwareOptimization {
  private models: ProviderModelSpec[] = [...AVAILABLE_MODELS];

  /**
   * Get provider recommendations for a given context size.
   */
  recommendProviders(contextTokens: number, options: {
    preferLocal?: boolean;
    preferLowCost?: boolean;
    requiredCapabilities?: string[];
  } = {}): ProviderContextRecommendation[] {
    const recommendations: ProviderContextRecommendation[] = [];

    const sorted = [...this.models];
    if (options.preferLocal) {
      sorted.sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0));
    } else if (options.preferLowCost) {
      sorted.sort((a, b) => a.costPerMillionInput - b.costPerMillionInput);
    }

    for (const model of sorted) {
      if (contextTokens > model.maxContextWindow * 0.9) continue;

      const fitRatio = contextTokens / model.maxContextWindow;
      const estimatedCost = (contextTokens / 1_000_000) * model.costPerMillionInput;

      let reason: ProviderContextRecommendation['reason'];
      if (contextTokens > 50_000) {
        reason = 'large_context';
      } else if (contextTokens < 4_000) {
        reason = 'small_context';
      } else if (fitRatio > 0.5) {
        reason = 'balanced';
      } else {
        reason = 'fallback';
      }

      recommendations.push({
        providerId: model.providerId,
        modelId: model.modelId,
        reason,
        contextTokens,
        maxContextWindow: model.maxContextWindow,
        fitRatio: Math.round(fitRatio * 100),
        estimatedCost: Math.round(estimatedCost * 1000) / 1000,
      });
    }

    return recommendations;
  }

  /**
   * Select the best provider for a given context size.
   */
  selectBestProvider(contextTokens: number, options: {
    preferLocal?: boolean;
    preferLowCost?: boolean;
  } = {}): ProviderContextRecommendation {
    const recommendations = this.recommendProviders(contextTokens, options);
    if (recommendations.length === 0) {
      return {
        providerId: 'openrouter',
        modelId: 'gpt-4o',
        reason: 'fallback',
        contextTokens,
        maxContextWindow: 128_000,
        fitRatio: Math.round((contextTokens / 128_000) * 100),
        estimatedCost: (contextTokens / 1_000_000) * 2.5,
      };
    }
    return recommendations[0];
  }

  /**
   * Estimate cost for a context assembly.
   */
  estimateCost(tokens: number, providerId: string): number {
    const model = this.models.find(m => m.providerId === providerId);
    if (!model) return 0;
    return (tokens / 1_000_000) * model.costPerMillionInput;
  }

  /**
   * Check if context fits in a provider's window.
   */
  fitsInWindow(contextTokens: number, providerId: string, modelId: string): boolean {
    const model = this.models.find(m => m.providerId === providerId && m.modelId === modelId);
    if (!model) return contextTokens <= 128_000;
    return contextTokens <= model.maxContextWindow * 0.9;
  }

  /**
   * Get available models for a provider.
   */
  getModelsForProvider(providerId: string): ProviderModelSpec[] {
    return this.models.filter(m => m.providerId === providerId);
  }

  /**
   * Register a custom model.
   */
  registerModel(model: ProviderModelSpec): void {
    const existing = this.models.findIndex(m => m.providerId === model.providerId && m.modelId === model.modelId);
    if (existing >= 0) {
      this.models[existing] = model;
    } else {
      this.models.push(model);
    }
  }

  /**
   * Get cost savings from using optimal provider vs. default.
   */
  getCostSavings(contextTokens: number, defaultProvider: string, optimalProvider: string): { defaultCost: number; optimalCost: number; savings: number; savingsPercent: string } {
    const defaultCost = this.estimateCost(contextTokens, defaultProvider);
    const optimalCost = this.estimateCost(contextTokens, optimalProvider);
    const savings = defaultCost - optimalCost;
    const savingsPercent = defaultCost > 0 ? `${Math.round((savings / defaultCost) * 100)}%` : '0%';
    return { defaultCost, optimalCost, savings: Math.max(0, savings), savingsPercent };
  }
}
