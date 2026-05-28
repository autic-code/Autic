/**
 * ContextEngineeringCore — Centralized context engineering runtime (#1)
 *
 * Orchestrates the full context assembly pipeline:
 *   1. Receive context assembly request
 *   2. Check cache (budget-aware)
 *   3. Rank and select files via SelectiveFileRetrieval
 *   4. Compress selected files via ContextCompressionEngine
 *   5. Retrieve relevant memory via MultiLayerMemoryRetrieval
 *   6. Apply token budget via TokenBudgetEngine
 *   7. Assemble final context
 *   8. Log to ContextObservability
 *
 * Modular pipeline — each stage is independently replaceable.
 * Deterministic, bounded, and inspectable.
 */

import { generateId, timestamp } from '@autic/shared';
import type {
  ContextAssemblyRequest,
  ContextAssemblyResult,
  FileContext,
  TokenBudget,
} from '@autic/shared';
import { SelectiveFileRetrieval } from './SelectiveFileRetrieval.js';
import { ContextCompressionEngine } from './ContextCompressionEngine.js';
import { MultiLayerMemoryRetrieval } from './MultiLayerMemoryRetrieval.js';
import { TokenBudgetEngine } from './TokenBudgetEngine.js';
import { ContextCachingSystem } from './ContextCachingSystem.js';
import { ContextObservability } from './ContextObservability.js';
import { ContextSafetySystem } from './ContextSafetySystem.js';

export interface ContextEngineeringConfig {
  maxFilesPerAssembly?: number;
  maxTokensPerAssembly?: number;
  enableCaching?: boolean;
  enableSafety?: boolean;
  defaultProvider?: string;
  defaultModel?: string;
}

export class ContextEngineeringCore {
  private config: Required<ContextEngineeringConfig>;
  private fileRetrieval: SelectiveFileRetrieval;
  private compression: ContextCompressionEngine;
  private memoryRetrieval: MultiLayerMemoryRetrieval;
  private tokenBudget: TokenBudgetEngine;
  private cache: ContextCachingSystem;
  private observability: ContextObservability;
  private safety: ContextSafetySystem;
  private running = false;

  constructor(rootDir?: string, config: ContextEngineeringConfig = {}) {
    this.config = {
      maxFilesPerAssembly: config.maxFilesPerAssembly || 15,
      maxTokensPerAssembly: config.maxTokensPerAssembly || 48_000,
      enableCaching: config.enableCaching ?? true,
      enableSafety: config.enableSafety ?? true,
      defaultProvider: config.defaultProvider || 'openrouter',
      defaultModel: config.defaultModel || 'auto',
    };
    this.fileRetrieval = new SelectiveFileRetrieval(rootDir);
    this.compression = new ContextCompressionEngine();
    this.memoryRetrieval = new MultiLayerMemoryRetrieval();
    this.tokenBudget = new TokenBudgetEngine();
    this.cache = new ContextCachingSystem();
    this.observability = new ContextObservability();
    this.safety = new ContextSafetySystem();
  }

  /**
   * Start the context engineering core.
   */
  start(): void {
    this.running = true;
    this.cache.startCleanup();
    this.observability.log({
      type: 'context:assembled',
      timestamp: timestamp(),
      message: 'Context engineering core started',
    });
  }

  /**
   * Stop the context engineering core.
   */
  stop(): void {
    this.running = false;
    this.cache.stopCleanup();
  }

  /**
   * Assemble context for a given request.
   * This is the main pipeline entry point.
   */
  async assemble(request: ContextAssemblyRequest): Promise<ContextAssemblyResult> {
    const startTime = Date.now();
    const maxTokens = request.maxTokens || this.config.maxTokensPerAssembly;
    const maxFiles = this.config.maxFilesPerAssembly;

    // 1. Safety check
    if (this.config.enableSafety) {
      const safetyResult = this.safety.checkRequest(request);
      if (!safetyResult.safe) {
        this.observability.log({
          type: 'context:safety_triggered',
          timestamp: timestamp(),
          message: `Safety blocked: ${safetyResult.violation?.message}`,
          warning: safetyResult.violation?.message,
        });
        return this.createEmptyResult(
          startTime,
          safetyResult.violation?.message || 'Safety check failed',
        );
      }
    }

    // 2. Check cache
    if (this.config.enableCaching) {
      const cacheKey = this.buildCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.observability.log({
          type: 'context:cache_hit',
          timestamp: timestamp(),
          requestId: cacheKey,
          message: 'Cache hit for assembly request',
          cacheHits: cached.hits,
          durationMs: Date.now() - startTime,
        });
        return cached.result;
      }
      this.observability.log({
        type: 'context:cache_miss',
        timestamp: timestamp(),
        requestId: cacheKey,
        message: 'Cache miss, assembling fresh context',
      });
    }

    // 3. Select and rank files
    const retrievalStart = Date.now();
    const selectedFiles = await this.fileRetrieval.retrieveFiles(
      request.goal,
      request.stage,
      request.files,
      { maxFiles, maxTokens },
    );
    const retrievalTimeMs = Date.now() - retrievalStart;

    // 4. Compress files
    const compressedFiles = this.compression.compressFiles(selectedFiles, {
      maxTokens,
    });

    // 5. Retrieve memory context
    let memoryTokens = 0;
    if (request.includeMemory ?? true) {
      const memoryItems = this.memoryRetrieval.retrieve({
        goal: request.goal,
        limit: 5,
      });
      memoryTokens = memoryItems.reduce((sum, item) => sum + item.tokenCost, 0);
    }

    // 6. Apply token budget
    const budget = this.tokenBudget.allocateBudget({
      totalBudget: maxTokens,
      fileTokens: compressedFiles.reduce((s, f) => s + f.tokenCount, 0),
      memoryTokens,
    });

    // 7. Enforce budget — trim files if needed
    let finalFiles = compressedFiles;
    if (budget.remainingTokens < 0) {
      // Trim lowest-ranked files until under budget
      finalFiles = this.enforceBudget(finalFiles, budget);
    }

    // 8. Assemble result
    const fileTokens = finalFiles.reduce((s, f) => s + f.tokenCount, 0);
    const totalTokens = fileTokens + memoryTokens + budget.systemPromptTokens;
    const compressionRatio =
      selectedFiles.length > 0 ? 1 - finalFiles.length / selectedFiles.length : 0;

    const result: ContextAssemblyResult = {
      requestId: generateId(),
      selectedFiles: finalFiles,
      fileCount: finalFiles.length,
      fileTokens,
      totalTokens,
      budgetTokens: maxTokens,
      compressionRatio,
      retrievalTimeMs,
      cacheHits: 0,
      assemblyWarnings: budget.warnings,
    };

    // 9. Update safety metrics
    if (this.config.enableSafety) {
      this.safety.recordAssembly(result);
    }

    // 10. Cache result
    if (this.config.enableCaching) {
      const cacheKey = this.buildCacheKey(request);
      this.cache.set(
        cacheKey,
        result,
        finalFiles.map((f) => f.path),
      );
    }

    // 11. Log observability
    this.observability.log({
      type: 'context:assembled',
      timestamp: timestamp(),
      requestId: result.requestId,
      message: `Assembled context: ${result.fileCount} files, ${result.totalTokens} tokens`,
      tokensUsed: totalTokens,
      filesSelected: result.fileCount,
      compressionRatio,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Get token budget estimate for a request without assembling.
   */
  async estimateBudget(request: ContextAssemblyRequest): Promise<TokenBudget> {
    const maxTokens = request.maxTokens || this.config.maxTokensPerAssembly;
    return this.tokenBudget.estimateBudget(maxTokens, request.goal);
  }

  /**
   * Get observability stats.
   */
  getObservability() {
    return this.observability.getStats();
  }

  /**
   * Get cache stats.
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Get safety stats.
   */
  getSafetyStats() {
    return this.safety.getStats();
  }

  /**
   * Get component stats — observability, cache, safety.
   */
  getStats() {
    return {
      running: this.running,
      observability: this.observability.getStats(),
      cache: this.cache.getStats(),
      safety: this.safety.getStats(),
    };
  }

  // ---- Private Helpers ----

  private createEmptyResult(startTime: number, warning: string): ContextAssemblyResult {
    return {
      requestId: generateId(),
      selectedFiles: [],
      fileCount: 0,
      fileTokens: 0,
      totalTokens: 0,
      budgetTokens: this.config.maxTokensPerAssembly,
      compressionRatio: 0,
      retrievalTimeMs: Date.now() - startTime,
      cacheHits: 0,
      assemblyWarnings: [warning],
    };
  }

  private buildCacheKey(request: ContextAssemblyRequest): string {
    return `${request.goal}|${request.stage || ''}|${request.role || ''}|${request.maxTokens || this.config.maxTokensPerAssembly}`;
  }

  private enforceBudget(files: FileContext[], budget: { remainingTokens: number }): FileContext[] {
    if (budget.remainingTokens >= 0) return files;

    const sorted = [...files].sort((a, b) => b.relevanceScore - a.relevanceScore);
    const result: FileContext[] = [];
    let tokensUsed = 0;

    for (const file of sorted) {
      if (tokensUsed + file.tokenCount <= budget.remainingTokens) {
        result.push(file);
        tokensUsed += file.tokenCount;
      }
    }

    return result;
  }
}
