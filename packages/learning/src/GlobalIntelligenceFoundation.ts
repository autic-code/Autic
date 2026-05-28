/**
 * GlobalIntelligenceFoundation — OPTIONAL anonymized sync architecture.
 *
 * CRITICAL DESIGN RULES:
 *   - Does NOT upload automatically
 *   - Does NOT store secrets, source code, repositories, credentials, or raw prompts
 *   - Only handles abstract, anonymized engineering patterns
 *   - Requires explicit opt-in to enable
 *   - All sync data is sanitized through LearningSanitizer first
 *
 * This is a FOUNDATION — no actual network sync is implemented.
 * The architecture is ready for future optional sync once the user opts in.
 */

import { timestamp, generateId } from '@autic/shared';
import type { GlobalIntelligenceEntry, SanitizedLearningEntry } from '@autic/shared';

export interface GlobalIntelligenceFoundationOptions {
  enabled?: boolean;
  maxEntries?: number;
  minConfidenceForSync?: number;
}

export class GlobalIntelligenceFoundation {
  private entries: Map<string, GlobalIntelligenceEntry> = new Map();
  private syncEnabled = false;
  private lastSyncAt = 0;
  private syncCount = 0;
  private options: Required<GlobalIntelligenceFoundationOptions>;

  constructor(options: GlobalIntelligenceFoundationOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      maxEntries: options.maxEntries ?? 500,
      minConfidenceForSync: options.minConfidenceForSync ?? 0.7,
    };
  }

  // ── Sync Controls ──

  get enabled(): boolean {
    return this.syncEnabled;
  }

  enable(): void {
    this.syncEnabled = true;
  }

  disable(): void {
    this.syncEnabled = false;
  }

  // ── Entry Management ──

  addEntry(entry: SanitizedLearningEntry): GlobalIntelligenceEntry | null {
    if (!this.syncEnabled) return null;

    // Require minimum confidence
    if (entry.confidence < this.options.minConfidenceForSync) return null;

    // Check for duplicate
    const existing = Array.from(this.entries.values()).find(
      (e) => e.abstractPattern === entry.abstractPattern,
    );
    if (existing) {
      existing.occurrences += entry.occurrences;
      existing.confidence = Math.max(existing.confidence, entry.confidence);
      existing.lastVerified = timestamp();
      return existing;
    }

    // Enforce max
    if (this.entries.size >= this.options.maxEntries) {
      const oldest = Array.from(this.entries.entries())
        .sort(([, a], [, b]) => a.createdAt - b.createdAt)[0];
      if (oldest) this.entries.delete(oldest[0]);
    }

    const newEntry: GlobalIntelligenceEntry = {
      id: generateId(),
      type: entry.type as GlobalIntelligenceEntry['type'],
      abstractPattern: entry.abstractPattern,
      frameworks: entry.frameworks,
      confidence: entry.confidence,
      occurrences: entry.occurrences,
      lastVerified: timestamp(),
      createdAt: timestamp(),
    };

    this.entries.set(newEntry.id, newEntry);
    return newEntry;
  }

  // ── Query ──

  findByFramework(framework: string, limit = 10): GlobalIntelligenceEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => e.frameworks.some((f) => f.toLowerCase().includes(framework.toLowerCase())))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  findByConfidence(minConfidence: number, limit = 20): GlobalIntelligenceEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => e.confidence >= minConfidence)
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  getAll(limit = 50): GlobalIntelligenceEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  // ── Sync Simulation ──

  /**
   * Simulate preparing entries for sync.
   * No actual network request is made — this is a foundation.
   */
  prepareSyncBatch(maxBatch = 20): GlobalIntelligenceEntry[] {
    if (!this.syncEnabled) return [];

    const batch = Array.from(this.entries.values())
      .filter((e) => e.confidence >= this.options.minConfidenceForSync)
      .sort((a, b) => b.lastVerified - a.lastVerified)
      .slice(0, maxBatch);

    this.syncCount += batch.length;
    this.lastSyncAt = timestamp();
    return batch;
  }

  // ── Stats ──

  getStats(): {
    totalEntries: number;
    syncEnabled: boolean;
    lastSyncAt: number;
    totalSyncs: number;
  } {
    return {
      totalEntries: this.entries.size,
      syncEnabled: this.syncEnabled,
      lastSyncAt: this.lastSyncAt,
      totalSyncs: this.syncCount,
    };
  }

  clear(): void {
    this.entries.clear();
    this.syncCount = 0;
    this.lastSyncAt = 0;
  }
}
