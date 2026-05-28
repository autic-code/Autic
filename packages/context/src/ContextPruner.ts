/**
 * ContextPruner — Summarization and compression hooks for memory optimization.
 *
 * Prevents context explosion by:
 * - Summarizing old task histories
 * - Removing redundant context
 * - Running a lightweight compression pipeline
 * - Providing cleanup hooks for timed expiry
 */

import { timestamp } from '@autic/shared';
import { MemoryCompressor } from '@autic/memory';

export interface PruneResult {
  entriesRemoved: number;
  tokensReclaimed: number;
  summaryText?: string;
}

export interface PruneOptions {
  maxAgeMs?: number;
  maxEntries?: number;
  summarizeThreshold?: number;
}

export class ContextPruner {
  private compressor: MemoryCompressor;
  private prunedCount = 0;
  private totalTokensReclaimed = 0;

  constructor() {
    this.compressor = new MemoryCompressor();
  }

  /**
   * Prune old entries beyond max age.
   */
  pruneByAge<T extends { startedAt?: number }>(
    items: T[],
    options: PruneOptions = {},
  ): { items: T[]; result: PruneResult } {
    const maxAgeMs = options.maxAgeMs || 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = timestamp();
    const threshold = now - maxAgeMs;

    const before = items.length;
    const kept = items.filter((item) => !item.startedAt || item.startedAt >= threshold);
    const removed = before - kept.length;

    this.prunedCount += removed;
    this.totalTokensReclaimed += removed * 50; // estimate

    return {
      items: kept,
      result: {
        entriesRemoved: removed,
        tokensReclaimed: removed * 50,
      },
    };
  }

  /**
   * Prune entries to stay within max count (keep most recent).
   */
  pruneByCount<T extends { startedAt?: number }>(
    items: T[],
    options: PruneOptions = {},
  ): { items: T[]; result: PruneResult } {
    const maxEntries = options.maxEntries || 200;

    if (items.length <= maxEntries) {
      return {
        items,
        result: { entriesRemoved: 0, tokensReclaimed: 0 },
      };
    }

    const sorted = [...items].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    const kept = sorted.slice(0, maxEntries);
    const removed = sorted.length - kept.length;

    this.prunedCount += removed;
    this.totalTokensReclaimed += removed * 50;

    return {
      items: kept,
      result: {
        entriesRemoved: removed,
        tokensReclaimed: removed * 50,
      },
    };
  }

  /**
   * Summarize a group of entries into a compact text summary.
   * Used for old task histories that are kept as summaries.
   */
  summarizeEntries<T extends { description?: string; type?: string; status?: string }>(
    entries: T[],
    type: string,
  ): string {
    if (entries.length === 0) return '';

    const count = entries.length;
    const completed = entries.filter((e) => e.status === 'completed' || e.status === 'success').length;
    const failed = entries.filter((e) => e.status === 'failed').length;
    const types = new Set(entries.map((e) => e.type).filter(Boolean));

    const summary = [
      `${type}: ${count} total`,
      completed > 0 ? `${completed} completed` : '',
      failed > 0 ? `${failed} failed` : '',
      types.size > 0 ? `types: ${Array.from(types).slice(0, 5).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' — ');

    return summary;
  }

  /**
   * Run a full compression pipeline on a set of entries.
   * Combines age pruning, count limiting, and compression.
   */
  runPipeline<T extends { id: string; description?: string; startedAt?: number }>(
    items: T[],
    options: PruneOptions & { type?: string } = {},
  ): { items: T[]; results: PruneResult[] } {
    const results: PruneResult[] = [];

    // Step 1: Prune by age
    const agePruned = this.pruneByAge(items, options);
    if (agePruned.result.entriesRemoved > 0) {
      results.push(agePruned.result);
    }

    // Step 2: Prune by count
    const countPruned = this.pruneByCount(agePruned.items, options);
    if (countPruned.result.entriesRemoved > 0) {
      results.push(countPruned.result);
    }

    // Step 3: Compress (deduplicate + merge)
    const compressed = this.compressor.compress(countPruned.items, {
      maxEntries: options.maxEntries,
    });
    if (compressed.stats.removedCount > 0) {
      results.push({
        entriesRemoved: compressed.stats.removedCount,
        tokensReclaimed: compressed.stats.estimatedTokensSaved,
      });
    }

    // Step 4: Summarize if enough data
    let summaryText: string | undefined;
    if (options.type && compressed.items.length > 10) {
      summaryText = this.summarizeEntries(compressed.items, options.type);
    }

    return {
      items: compressed.items,
      results: results.length > 0 ? results.map((r) => ({ ...r, summaryText })) : [],
    };
  }

  /**
   * Get cumulative stats for this pruner instance.
   */
  getStats(): { totalPruned: number; totalTokensReclaimed: number } {
    return {
      totalPruned: this.prunedCount,
      totalTokensReclaimed: this.totalTokensReclaimed,
    };
  }

  /**
   * Generate a compact summary of workspace intelligence for context injection.
   * This is the "what should the LLM know" summary.
   */
  generateWorkspaceSummary(memory: {
    architecture?: { projectName?: string; framework?: string; language?: string; keyFiles?: string[] };
    repoSummary?: { totalFiles?: number; languages?: string[]; frameworks?: string[] };
    recentFixes?: Array<{ issue: string; success: boolean }>;
    activeGoals?: string[];
  }): string {
    const parts: string[] = [];

    if (memory.architecture?.projectName) {
      parts.push(`Project: ${memory.architecture.projectName}`);
    }

    const langFramework = [
      memory.architecture?.language,
      memory.architecture?.framework,
      ...(memory.repoSummary?.frameworks || []),
    ].filter(Boolean);

    if (langFramework.length > 0) {
      parts.push(`Stack: ${langFramework.join(' + ')}`);
    }

    if (memory.repoSummary?.totalFiles) {
      parts.push(`Files: ${memory.repoSummary.totalFiles}`);
    }

    if (memory.activeGoals && memory.activeGoals.length > 0) {
      parts.push(`Goals: ${memory.activeGoals.slice(0, 3).join(', ')}`);
    }

    return parts.join(' · ');
  }
}
