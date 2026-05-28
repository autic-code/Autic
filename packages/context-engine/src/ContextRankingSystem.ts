/**
 * ContextRankingSystem — Lightweight relevance ranking (#4)
 *
 * Ranks files, memory entries, learning patterns, and execution history
 * by relevance for context assembly. Uses simple scoring heuristics:
 *   - Keyword matching (goal → file/memory content)
 *   - Recency (more recent = higher score)
 *   - Frequency (commonly accessed = higher score)
 *   - Dependency score (imported by many files = higher score)
 *   - Role/type matching
 *
 * No ML, no vector embeddings — purely deterministic ranking.
 */

import type { ContextRankingScore } from '@autic/shared';

export interface RankableItem {
  id: string;
  type: 'file' | 'memory' | 'learning' | 'execution_record' | 'chunk';
  content: string;
  path?: string;
  tags?: string[];
  lastAccessed?: number;
  accessCount?: number;
  importedByCount?: number;
}

export interface RankingOptions {
  goal: string;
  maxResults?: number;
  recencyWeight?: number;
  frequencyWeight?: number;
  relevanceWeight?: number;
  dependencyWeight?: number;
  stage?: string;
  role?: string;
}

export class ContextRankingSystem {
  private accessHistory: Map<string, { count: number; lastAccess: number }> = new Map();

  /**
   * Rank items by relevance to a goal.
   */
  rank(items: RankableItem[], options: RankingOptions): ContextRankingScore[] {
    const goalLower = options.goal.toLowerCase();
    const goalWords = goalLower.split(/\s+/).filter(w => w.length > 3);
    const maxResults = options.maxResults || 20;

    const scores: ContextRankingScore[] = [];

    for (const item of items) {
      const accessInfo = this.accessHistory.get(item.id);

      // Relevance score: keyword matches in content
      let relevance = 0;
      const contentLower = item.content.toLowerCase();
      for (const kw of goalWords) {
        if (item.path?.toLowerCase().includes(kw)) relevance += 25;
        const matches = (contentLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        relevance += Math.min(matches * 3, 20);
      }

      // Recency score
      const now = Date.now();
      const lastAccess = accessInfo?.lastAccess || item.lastAccessed || 0;
      const recency = lastAccess > 0
        ? Math.max(0, 1 - (now - lastAccess) / (7 * 24 * 60 * 60 * 1000))
        : 0;

      // Frequency score
      const frequency = accessInfo ? Math.min(accessInfo.count / 50, 1) : 0;

      // Dependency score
      const dependencyScore = item.importedByCount
        ? Math.min(item.importedByCount / 10, 1)
        : 0;

      // Weights from options
      const wRelevance = options.relevanceWeight ?? 0.5;
      const wRecency = options.recencyWeight ?? 0.2;
      const wFrequency = options.frequencyWeight ?? 0.15;
      const wDependency = options.dependencyWeight ?? 0.15;

      const totalScore = (
        relevance * wRelevance +
        recency * 100 * wRecency +
        frequency * 100 * wFrequency +
        dependencyScore * 100 * wDependency
      );

      scores.push({
        itemId: item.id,
        itemType: item.type,
        relevance,
        recency: Math.round(recency * 100),
        frequency: Math.round(frequency * 100),
        dependencyScore: Math.round(dependencyScore * 100),
        totalScore: Math.round(totalScore),
        reason: this.generateReason(relevance, recency, frequency, dependencyScore),
      });
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    return scores.slice(0, maxResults);
  }

  /**
   * Record an access to track frequency and recency.
   */
  recordAccess(itemId: string): void {
    const existing = this.accessHistory.get(itemId);
    if (existing) {
      existing.count++;
      existing.lastAccess = Date.now();
    } else {
      this.accessHistory.set(itemId, { count: 1, lastAccess: Date.now() });
    }
  }

  /**
   * Get access stats for an item.
   */
  getAccessStats(itemId: string): { count: number; lastAccess: number } | undefined {
    return this.accessHistory.get(itemId);
  }

  /**
   * Build rankable items from files.
   */
  buildFromFiles(
    files: Array<{ path: string; content: string; tags?: string[] }>,
  ): RankableItem[] {
    return files.map(f => ({
      id: f.path,
      type: 'file' as const,
      content: f.content,
      path: f.path,
      tags: f.tags,
      lastAccessed: this.accessHistory.get(f.path)?.lastAccess,
      accessCount: this.accessHistory.get(f.path)?.count,
    }));
  }

  /**
   * Build rankable items from memory entries.
   */
  buildFromMemory(
    entries: Array<{ id: string; key: string; value: unknown; tags?: string[] }>,
  ): RankableItem[] {
    return entries.map(e => ({
      id: e.id,
      type: 'memory' as const,
      content: typeof e.value === 'string' ? e.value : JSON.stringify(e.value),
      tags: e.tags,
    }));
  }

  private generateReason(
    relevance: number,
    recency: number,
    frequency: number,
    dependencyScore: number,
  ): string {
    const parts: string[] = [];
    if (relevance > 30) parts.push('high relevance');
    else if (relevance > 15) parts.push('moderate relevance');
    if (recency > 0.5) parts.push('recently accessed');
    if (frequency > 0.5) parts.push('frequently accessed');
    if (dependencyScore > 0.5) parts.push('key dependency');
    return parts.length > 0 ? parts.join(', ') : 'default score';
  }
}
