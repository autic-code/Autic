/**
 * TokenBudgetEngine — Provider-aware token budgeting system (#2)
 *
 * Allocates token budgets across context categories with hard safety limits.
 * Provider-aware: adjusts budgets based on model context windows.
 * Workflow-aware: different budgets for different execution stages.
 * Overflow prevention: hard caps with safety margins.
 */

import type { TokenBudget, TokenBudgetBreakdown } from '@autic/shared';

export interface BudgetAllocation {
  totalBudget: number;
  fileTokens: number;
  memoryTokens: number;
  systemPromptTokens: number;
  remainingTokens: number;
  warnings: string[];
}

// Provider context windows (tokens)
const PROVIDER_CONTEXT_WINDOWS: Record<string, number> = {
  'openrouter:auto': 128_000,
  'openrouter:gpt-4o': 128_000,
  'openrouter:claude-3.5-sonnet': 200_000,
  'openrouter:gemini-2.0': 1_000_000,
  'ollama:auto': 32_000,
  'ollama:llama3': 8_000,
  'ollama:codellama': 16_000,
};

// Safety margin percentages per provider type
const SAFETY_MARGINS: Record<string, number> = {
  openrouter: 0.8,  // Use 80% of context window
  ollama: 0.7,      // Use 70% for local models
  openai: 0.8,
  anthropic: 0.85,
  custom: 0.75,
};

export class TokenBudgetEngine {
  /**
   * Allocate a token budget across context categories.
   */
  allocateBudget(params: {
    totalBudget: number;
    fileTokens: number;
    memoryTokens: number;
    systemPromptTokens?: number;
    provider?: string;
    model?: string;
  }): BudgetAllocation {
    const providerKey = `${params.provider || 'openrouter'}:${params.model || 'auto'}`;
    const maxContext = PROVIDER_CONTEXT_WINDOWS[providerKey] || 128_000;
    const safetyMargin = SAFETY_MARGINS[params.provider || 'openrouter'] || 0.8;
    const effectiveMax = Math.min(params.totalBudget, maxContext * safetyMargin);

    const systemPrompt = params.systemPromptTokens ?? Math.round(effectiveMax * 0.08);
    const fileTokens = Math.min(params.fileTokens, effectiveMax - systemPrompt);
    const memoryTokens = Math.min(params.memoryTokens, effectiveMax * 0.1);
    const totalUsed = fileTokens + memoryTokens + systemPrompt;
    const remaining = effectiveMax - totalUsed;

    const warnings: string[] = [];

    if (params.fileTokens > effectiveMax * 0.7) {
      warnings.push('File tokens exceed 70% of budget — compression recommended');
    }
    if (totalUsed > effectiveMax) {
      warnings.push(`Context overflow: ${totalUsed} > ${effectiveMax} — trimming needed`);
    }
    if (params.memoryTokens > effectiveMax * 0.15) {
      warnings.push('Memory tokens exceed 15% of budget — reduce memory context');
    }

    return {
      totalBudget: effectiveMax,
      fileTokens,
      memoryTokens,
      systemPromptTokens: systemPrompt,
      remainingTokens: remaining,
      warnings,
    };
  }

  /**
   * Estimate a token budget without full assembly.
   */
  async estimateBudget(
    maxTokens: number,
    _goal: string,
  ): Promise<TokenBudget> {
    const safetyMargin = 0.8;
    const totalTokens = Math.min(maxTokens, 128_000 * safetyMargin);

    const breakdown: TokenBudgetBreakdown[] = [
      { category: 'system_prompt', tokens: Math.round(totalTokens * 0.08), percentage: 8, maxTokens: Math.round(totalTokens * 0.1) },
      { category: 'files', tokens: Math.round(totalTokens * 0.5), percentage: 50, maxTokens: Math.round(totalTokens * 0.65) },
      { category: 'conversation_history', tokens: Math.round(totalTokens * 0.15), percentage: 15, maxTokens: Math.round(totalTokens * 0.2) },
      { category: 'learning_memory', tokens: Math.round(totalTokens * 0.07), percentage: 7, maxTokens: Math.round(totalTokens * 0.1) },
      { category: 'execution_context', tokens: Math.round(totalTokens * 0.05), percentage: 5, maxTokens: Math.round(totalTokens * 0.08) },
      { category: 'available', tokens: Math.round(totalTokens * 0.15), percentage: 15, maxTokens: Math.round(totalTokens * 1) },
    ];

    const usedTokens = breakdown
      .filter(b => b.category !== 'available')
      .reduce((s, b) => s + b.tokens, 0);

    return {
      totalTokens,
      usedTokens,
      remainingTokens: totalTokens - usedTokens,
      providerTokens: totalTokens,
      modelTokens: totalTokens,
      safetyMargin: Math.round(totalTokens * (1 - safetyMargin)),
      breakdown,
    };
  }

  /**
   * Get provider-aware context window for a model.
   */
  getContextWindow(provider: string, model: string): number {
    const key = `${provider}:${model}`;
    return PROVIDER_CONTEXT_WINDOWS[key] || 128_000;
  }

  /**
   * Get safety-adjusted max tokens for a provider.
   */
  getSafeMaxTokens(provider: string, totalBudget: number): number {
    const margin = SAFETY_MARGINS[provider] || 0.8;
    return Math.min(totalBudget * margin, 128_000);
  }
}
