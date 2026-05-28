/**
 * PreBuildIntelligence — Workflow pre-analysis system.
 *
 * Before execution:
 *   - Loads relevant patterns from the learning engine
 *   - Detects known framework risks and dependency conflicts
 *   - Retrieves verified fixes for known error patterns
 *   - Loads optimization strategies for the current context
 *
 * Goal: Prevent repeated failures by applying learned knowledge
 * before execution begins.
 */

import { timestamp } from '@autic/shared';
import type { PreBuildContext, LearningEntry } from '@autic/shared';

import { LearningEngine } from './LearningEngine.js';
import { OperationalOptimizationMemory } from './OperationalOptimizationMemory.js';

export interface PreBuildIntelligenceOptions {
  maxPatterns?: number;
}

export class PreBuildIntelligence {
  private learningEngine: LearningEngine;
  private optimizationMemory: OperationalOptimizationMemory;
  private options: Required<PreBuildIntelligenceOptions>;
  private cache: Map<string, PreBuildContext> = new Map();
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(
    learningEngine: LearningEngine,
    optimizationMemory: OperationalOptimizationMemory,
    options: PreBuildIntelligenceOptions = {},
  ) {
    this.learningEngine = learningEngine;
    this.optimizationMemory = optimizationMemory;
    this.options = {
      maxPatterns: options.maxPatterns ?? 20,
    };
  }

  /**
   * Load pre-build intelligence for a given framework/dependency context.
   * Results are cached for 5 minutes.
   */
  load(params: { framework: string; dependencies: string[] }): PreBuildContext {
    const cacheKey = `${params.framework}:${params.dependencies.sort().join(',')}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && timestamp() - cached.loadedAt < this.cacheTtlMs) {
      return cached;
    }

    // Load relevant patterns from learning engine
    const patterns = this.learningEngine.query({
      framework: params.framework,
      minConfidence: 0.5,
      maxResults: this.options.maxPatterns,
    });

    // Load verified fixes for this framework
    const verifiedFixes = this.learningEngine.getVerifiedFixes(params.framework);

    // Load optimization tips
    const optimizations = this.optimizationMemory.findByFramework(params.framework, 5);

    // Detect known risks from dependencies
    const knownRisks = this.detectKnownRisks(params.framework, params.dependencies, patterns);

    const context: PreBuildContext = {
      framework: params.framework,
      dependencies: params.dependencies,
      knownRisks,
      relevantPatterns: patterns,
      verifiedFixes,
      optimizationTips: optimizations.map((o) => o.description),
      loadedAt: timestamp(),
    };

    // Cache
    this.cache.set(cacheKey, context);

    return context;
  }

  /**
   * Load pre-build intelligence for a specific dependency.
   */
  loadForDependency(dependency: string): PreBuildContext {
    const fixes = this.learningEngine.getVerifiedFixes();
    const relevantFixes = fixes.filter((f) => f.dependency === dependency);

    const patterns = this.learningEngine.query({
      dependency,
      minConfidence: 0.5,
      maxResults: this.options.maxPatterns,
    });

    const optimizations = this.optimizationMemory.findByType('provider_selection', 5);

    return {
      framework: '',
      dependencies: [dependency],
      knownRisks: patterns.map((p) => `Known pattern: ${p.title}`),
      relevantPatterns: patterns,
      verifiedFixes: relevantFixes,
      optimizationTips: optimizations.map((o) => o.description),
      loadedAt: timestamp(),
    };
  }

  /**
   * Clear the context cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ── Private ──

  private detectKnownRisks(
    framework: string,
    dependencies: string[],
    patterns: LearningEntry[],
  ): string[] {
    const risks: string[] = [];

    // Check for known patterns that indicate risks
    for (const pattern of patterns) {
      if (pattern.confidence >= 0.8) {
        risks.push(`High-confidence pattern: ${pattern.title}`);
      }
    }

    // Check for common dependency issues
    if (framework === 'Next.js' && dependencies.includes('react')) {
      risks.push('Next.js + React — ensure compatible versions');
    }
    if (framework === 'TypeScript' && dependencies.includes('eslint')) {
      risks.push('TypeScript + ESLint — check tsconfig and eslint config alignment');
    }
    if (framework === 'Prisma' && !dependencies.some((d) => d.includes('prisma'))) {
      risks.push('Prisma detected but @prisma/client not in dependencies');
    }

    return [...new Set(risks)];
  }
}
