/**
 * LearningCompression — Duplicate consolidation, stale cleanup, and lightweight indexing.
 *
 * Prevents memory bloat over time by:
 *   - Removing duplicate entries
 *   - Summarizing old/low-confidence entries
 *   - Enforcing max entry limits
 *   - Cleaning stale/low-frequency patterns
 */

import { timestamp } from '@autic/shared';
import type { LearningEntry } from '@autic/shared';

export interface CompressionStats {
  originalEntries: number;
  compressedEntries: number;
  removedCount: number;
  duplicatesRemoved: number;
  staleRemoved: number;
  estimatedTokensSaved: number;
}

export class LearningCompression {
  /**
   * Compress learning entries by removing duplicates, stale data, and low-confidence entries.
   * Returns the compressed map and statistics.
   */
  compress(
    entries: Map<string, LearningEntry>,
    options: {
      maxEntries?: number;
      staleAgeMs?: number;
    } = {},
  ): { entries: Map<string, LearningEntry>; stats: CompressionStats } {
    const maxEntries = options.maxEntries ?? 1000;
    const staleAgeMs = options.staleAgeMs ?? 90 * 24 * 60 * 60_000; // 90 days

    const entryList = Array.from(entries.values());
    const originalCount = entryList.length;
    let duplicatesRemoved = 0;
    let staleRemoved = 0;

    // Step 1: Remove exact duplicates (same title + type + framework)
    const uniqueByKey = new Map<string, LearningEntry>();
    for (const entry of entryList) {
      const key = `${entry.type}:${entry.title}:${entry.framework ?? ''}`;
      const existing = uniqueByKey.get(key);
      if (existing) {
        // Keep the one with higher confidence
        if (entry.confidence > existing.confidence) {
          uniqueByKey.set(key, entry);
        }
        duplicatesRemoved++;
      } else {
        uniqueByKey.set(key, entry);
      }
    }

    // Step 2: Remove stale entries (expired or very old with low usage)
    const now = timestamp();
    const validEntries: LearningEntry[] = [];
    for (const entry of uniqueByKey.values()) {
      const isExpired = entry.expiresAt !== undefined && now > entry.expiresAt;
      const isStale =
        entry.confidence < 0.3 &&
        entry.updatedAt !== undefined &&
        now - entry.updatedAt > staleAgeMs / 2;

      if (isExpired || isStale) {
        staleRemoved++;
      } else {
        validEntries.push(entry);
      }
    }

    // Step 3: Enforce max entries (keep highest confidence)
    let finalEntries = validEntries;
    if (finalEntries.length > maxEntries) {
      finalEntries = finalEntries.sort((a, b) => b.confidence - a.confidence).slice(0, maxEntries);
    }

    // Build new map
    const compressed = new Map<string, LearningEntry>();
    for (const entry of finalEntries) {
      compressed.set(entry.id, entry);
    }

    const removedCount = originalCount - compressed.size;
    const estimatedTokensSaved = removedCount * 80; // ~80 tokens per entry

    return {
      entries: compressed,
      stats: {
        originalEntries: originalCount,
        compressedEntries: compressed.size,
        removedCount,
        duplicatesRemoved,
        staleRemoved,
        estimatedTokensSaved,
      },
    };
  }

  /**
   * Estimate token count for a string (rough approximation).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }

  /**
   * Suggest entries to remove when over budget.
   */
  suggestRemovals(entries: Map<string, LearningEntry>, targetCount: number): string[] {
    if (entries.size <= targetCount) return [];

    const sorted = Array.from(entries.values()).sort((a, b) => a.confidence - b.confidence);

    const toRemove: string[] = [];
    for (const entry of sorted) {
      if (entries.size - toRemove.length <= targetCount) break;
      toRemove.push(entry.id);
    }

    return toRemove;
  }
}
