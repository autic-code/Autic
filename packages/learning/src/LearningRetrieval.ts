/**
 * LearningRetrieval — Context-aware retrieval from the learning system.
 *
 * Supports:
 *   - Framework-aware retrieval
 *   - Repository-aware retrieval
 *   - Dependency-aware retrieval
 *   - Execution-stage-aware retrieval
 *
 * All retrieval is lightweight and bounded — no giant memory injection.
 */

import { timestamp, EvictableMap } from '@autic/shared';
import type { LearningRetrievalQuery, LearningRetrievalResult } from '@autic/shared';

import { LearningEngine } from './LearningEngine.js';
import { OperationalOptimizationMemory } from './OperationalOptimizationMemory.js';

export class LearningRetrieval {
  private engine: LearningEngine;
  private optimizationMemory: OperationalOptimizationMemory;
  private hitCache: EvictableMap<string, number> = new EvictableMap<string, number>(500);

  constructor(engine: LearningEngine, optimizationMemory: OperationalOptimizationMemory) {
    this.engine = engine;
    this.optimizationMemory = optimizationMemory;
  }

  /**
   * Execute a context-aware retrieval query.
   */
  query(query: LearningRetrievalQuery): LearningRetrievalResult {
    const startTime = timestamp();

    // Query learning entries
    const entries = this.engine.query({
      framework: query.framework,
      tags: query.framework ? [query.framework] : undefined,
      minConfidence: query.minConfidence ?? 0.3,
      maxResults: query.maxResults ?? 20,
    });

    // Query verified fixes
    const fixes = this.engine.getVerifiedFixes(query.framework);
    const filteredFixes = query.dependency
      ? fixes.filter((f) => f.dependency === query.dependency)
      : fixes;

    // Query optimizations
    const optimizations = query.framework
      ? this.optimizationMemory.findByFramework(query.framework, 5)
      : this.optimizationMemory.getAll(5);

    // Track retrieval hit for observability
    const cacheKey = `${query.framework ?? ''}:${query.dependency ?? ''}:${query.executionStage ?? ''}`;
    this.hitCache.set(cacheKey, (this.hitCache.get(cacheKey) ?? 0) + 1);
    this.hitCache.touch(cacheKey);

    const retrievalTimeMs = timestamp() - startTime;

    return {
      entries: entries.slice(0, query.maxResults ?? 20),
      verifiedFixes: filteredFixes.slice(0, 10),
      optimizations: optimizations.slice(0, 5),
      totalCount: entries.length + filteredFixes.length + optimizations.length,
      retrievalTimeMs,
    };
  }

  /**
   * Quick retrieval for pre-execution context loading.
   * Returns the most relevant entries for the given framework + dependency context.
   */
  quickLoad(framework: string, dependency?: string, maxResults = 10): LearningRetrievalResult {
    return this.query({
      framework,
      dependency,
      maxResults,
      minConfidence: 0.5,
    });
  }

  /**
   * Get retrieval hit statistics.
   */
  getHitStats(): { totalHits: number; topQueries: Array<{ query: string; count: number }> } {
    const entries = Array.from(this.hitCache.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const totalHits = Array.from(this.hitCache.values()).reduce((sum, c) => sum + c, 0);
    return { totalHits, topQueries: entries };
  }

  clear(): void {
    this.hitCache.clear();
  }
}
