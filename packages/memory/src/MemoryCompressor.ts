/**
 * MemoryCompressor — Lightweight compression pipeline for memory optimization.
 *
 * Summarizes old tasks, removes redundant context, and prevents
 * context explosion over time. Runs on-demand and on a schedule.
 */

export interface CompressionStats {
  originalEntries: number;
  compressedEntries: number;
  removedCount: number;
  estimatedTokensSaved: number;
}

export class MemoryCompressor {
  /**
   * Compress an array of items by removing duplicates and merging similar entries.
   * Returns the compressed array and stats.
   */
  compress<T extends { id: string; description?: string; startedAt?: number }>(
    items: T[],
    options: {
      maxEntries?: number;
      mergeThresholdMs?: number;
      deduplicate?: boolean;
    } = {},
  ): { items: T[]; stats: CompressionStats } {
    const maxEntries = options.maxEntries || 100;
    const mergeThresholdMs = options.mergeThresholdMs || 5 * 60 * 1000; // 5 minutes
    const deduplicate = options.deduplicate ?? true;

    let compressed = [...items];
    const originalCount = compressed.length;

    // Step 1: Deduplicate by id
    if (deduplicate) {
      const seen = new Set<string>();
      compressed = compressed.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }

    // Step 2: Merge entries that have the same description within mergeThresholdMs
    if (compressed.length > 0 && compressed[0].description) {
      const merged: T[] = [];
      const sorted = [...compressed].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));

      for (const item of sorted) {
        const last = merged[merged.length - 1];
        if (
          last &&
          item.description === last.description &&
          last.startedAt &&
          item.startedAt &&
          item.startedAt - last.startedAt < mergeThresholdMs
        ) {
          // Merge: keep the later one (more up to date)
          merged[merged.length - 1] = item;
        } else {
          merged.push(item);
        }
      }

      compressed = merged;
    }

    // Step 3: Enforce max entries (keep the most recent)
    if (compressed.length > maxEntries) {
      compressed = compressed
        .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
        .slice(0, maxEntries);
    }

    const removedCount = originalCount - compressed.length;
    // Rough estimate: ~50 tokens per entry
    const estimatedTokensSaved = removedCount * 50;

    return {
      items: compressed,
      stats: {
        originalEntries: originalCount,
        compressedEntries: compressed.length,
        removedCount,
        estimatedTokensSaved,
      },
    };
  }

  /**
   * Estimate token count for a string (rough approximation).
   */
  estimateTokens(text: string): number {
    // Approximate: 1 token ≈ 4 characters for code, ~1.3 for English
    // Use 3 as a middle ground for mixed content
    return Math.ceil(text.length / 3);
  }

  /**
   * Estimate the token cost of a memory file.
   */
  estimateMemoryTokens(data: unknown): number {
    const json = JSON.stringify(data);
    return this.estimateTokens(json);
  }

  /**
   * Suggest which entries to remove when over budget.
   * Returns IDs of entries to remove to meet the target token budget.
   */
  suggestRemovals<T extends { id: string; startedAt?: number }>(
    items: T[],
    targetTokenBudget: number,
    getTokenCost: (item: T) => number,
  ): string[] {
    const totalTokens = items.reduce((sum, item) => sum + getTokenCost(item), 0);
    if (totalTokens <= targetTokenBudget) return [];

    // Sort by oldest first, remove until under budget
    const sorted = [...items].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
    const toRemove: string[] = [];
    let currentTokens = totalTokens;

    for (const item of sorted) {
      if (currentTokens <= targetTokenBudget) break;
      const cost = getTokenCost(item);
      // Don't remove if it would put us way under budget
      if (currentTokens - cost < targetTokenBudget * 0.8) continue;
      toRemove.push(item.id);
      currentTokens -= cost;
    }

    return toRemove;
  }
}
