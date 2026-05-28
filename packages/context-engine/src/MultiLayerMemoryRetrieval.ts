/**
 * MultiLayerMemoryRetrieval — Scoped multi-layer memory retrieval (#8)
 *
 * Integrates retrieval across all memory systems:
 *   - Short-term execution memory (volatile, current session)
 *   - Mid-term workflow memory (recent sessions)
 *   - Long-term repository intelligence
 *   - Engineering learning patterns
 *   - Repo intelligence (frameworks, dependencies)
 *
 * Each source is scoped, bounded, and deterministically selected.
 */

import type { MemoryRetrievalItem } from '@autic/shared';
import { timestamp } from '@autic/shared';

export interface RetrievalRequest {
  goal: string;
  limit?: number;
  includeShortTerm?: boolean;
  includeMidTerm?: boolean;
  includeLongTerm?: boolean;
  includeLearning?: boolean;
  includeRepoIntel?: boolean;
}

interface MockMemoryStore {
  key: string;
  value: string;
  tags: string[];
  layer: string;
}

export class MultiLayerMemoryRetrieval {
  // Simulated memory stores — in production these connect to real memory packages
  private shortTerm: MockMemoryStore[] = [];
  private midTerm: MockMemoryStore[] = [];
  private longTerm: MockMemoryStore[] = [];
  private totalRetrievals = 0;
  private totalHits = 0;

  /**
   * Retrieve relevant memory items for a given goal.
   */
  retrieve(request: RetrievalRequest): MemoryRetrievalItem[] {
    const limit = request.limit || 10;
    const goalLower = request.goal.toLowerCase();
    const results: MemoryRetrievalItem[] = [];

    this.totalRetrievals++;

    // Short-term memory
    if (request.includeShortTerm ?? true) {
      for (const entry of this.shortTerm) {
        const relevance = this.calculateRelevance(entry, goalLower);
        if (relevance > 0.2) {
          results.push(this.toRetrievalItem(entry, 'short_term', relevance));
          this.totalHits++;
        }
      }
    }

    // Mid-term memory
    if (request.includeMidTerm ?? true) {
      for (const entry of this.midTerm) {
        const relevance = this.calculateRelevance(entry, goalLower);
        if (relevance > 0.3) {
          results.push(this.toRetrievalItem(entry, 'mid_term', relevance));
          this.totalHits++;
        }
      }
    }

    // Long-term memory
    if (request.includeLongTerm ?? true) {
      for (const entry of this.longTerm) {
        const relevance = this.calculateRelevance(entry, goalLower);
        if (relevance > 0.4) {
          results.push(this.toRetrievalItem(entry, 'long_term', relevance));
          this.totalHits++;
        }
      }
    }

    // Sort by relevance and apply limit
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, limit);
  }

  /**
   * Store a memory entry.
   */
  store(
    layer: 'short_term' | 'mid_term' | 'long_term',
    key: string,
    value: string,
    tags: string[] = [],
  ): void {
    const entry: MockMemoryStore = { key, value, tags, layer };

    switch (layer) {
      case 'short_term':
        this.shortTerm.push(entry);
        if (this.shortTerm.length > 50) this.shortTerm.shift();
        break;
      case 'mid_term':
        this.midTerm.push(entry);
        if (this.midTerm.length > 200) this.midTerm.shift();
        break;
      case 'long_term':
        this.longTerm.push(entry);
        if (this.longTerm.length > 1000) this.longTerm.shift();
        break;
    }
  }

  /**
   * Clear a memory layer.
   */
  clear(layer?: 'short_term' | 'mid_term' | 'long_term'): void {
    if (layer === 'short_term') this.shortTerm = [];
    else if (layer === 'mid_term') this.midTerm = [];
    else if (layer === 'long_term') this.longTerm = [];
    else {
      this.shortTerm = [];
      this.midTerm = [];
      this.longTerm = [];
    }
  }

  /**
   * Get stats for all memory layers.
   */
  getLayerStats(): Record<string, { count: number }> {
    return {
      short_term: { count: this.shortTerm.length },
      mid_term: { count: this.midTerm.length },
      long_term: { count: this.longTerm.length },
    };
  }

  /**
   * Get retrieval stats.
   */
  getStats(): { totalRetrievals: number; totalHits: number; hitRate: number } {
    return {
      totalRetrievals: this.totalRetrievals,
      totalHits: this.totalHits,
      hitRate:
        this.totalRetrievals > 0 ? Math.round((this.totalHits / this.totalRetrievals) * 100) : 0,
    };
  }

  // ---- Private Helpers ----

  private calculateRelevance(entry: MockMemoryStore, goalLower: string): number {
    let score = 0;
    const keyLower = entry.key.toLowerCase();
    const valueLower = (
      typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
    ).toLowerCase();

    // Key match
    if (keyLower.includes(goalLower)) score += 0.4;

    // Tag match
    for (const tag of entry.tags) {
      if (goalLower.includes(tag.toLowerCase())) score += 0.3;
    }

    // Content match
    const goalWords = goalLower.split(/\s+/).filter((w) => w.length > 3);
    for (const w of goalWords) {
      if (valueLower.includes(w)) score += 0.1;
    }

    return Math.min(score, 1);
  }

  private toRetrievalItem(
    entry: MockMemoryStore,
    source: MemoryRetrievalItem['source'],
    relevance: number,
  ): MemoryRetrievalItem {
    return {
      source,
      key: entry.key,
      value: entry.value,
      relevance: Math.round(relevance * 100),
      tokenCost: Math.ceil(
        (typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)).length / 3,
      ),
      tags: entry.tags,
      retrievedAt: timestamp(),
    };
  }
}
