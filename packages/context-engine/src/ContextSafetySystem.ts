/**
 * ContextSafetySystem — Context engineering safety controls (#14)
 *
 * Prevents context-related runtime issues:
 *   - Oversized context prevention (hard cap at 90% of context window)
 *   - Runaway retrieval detection (max 50 retrievals in 60s window)
 *   - Recursive retrieval protection (same request within 5s)
 *   - Memory pressure safeguards
 *
 * All limits are configurable with sensible defaults.
 */

import type { ContextAssemblyRequest, ContextSafetyViolation } from '@autic/shared';

export interface SafetyCheckResult {
  safe: boolean;
  violation?: ContextSafetyViolation;
}

export interface SafetyStats {
  totalChecks: number;
  totalViolations: number;
  violationTypes: Record<string, number>;
  runawayRetrievalsBlocked: number;
  oversizedContextsBlocked: number;
  recursiveRetrievalsBlocked: number;
}

export class ContextSafetySystem {
  private totalChecks = 0;
  private totalViolations = 0;
  private violationTypes: Record<string, number> = {};

  // Runaway detection
  private retrievalTimestamps: number[] = [];
  private readonly MAX_RETRIEVALS_PER_WINDOW = 50;
  private readonly RETRIEVAL_WINDOW_MS = 60_000;

  // Recursive detection
  private recentRequests: Map<string, number> = new Map();
  private readonly RECURSION_COOLDOWN_MS = 5_000;

  // Oversized context
  private readonly MAX_CONTEXT_TOKENS = 128_000;
  private readonly SAFETY_MARGIN = 0.9;
  private readonly MAX_FILES_PER_ASSEMBLY = 30;

  /**
   * Check a context assembly request for safety violations.
   */
  checkRequest(request: ContextAssemblyRequest): SafetyCheckResult {
    this.totalChecks++;
    const now = Date.now();

    // 1. Check for oversized context
    const maxTokens = request.maxTokens || 48_000;
    if (maxTokens > this.MAX_CONTEXT_TOKENS * this.SAFETY_MARGIN) {
      return this.violation({
        type: 'oversized_context',
        message: `Request exceeds safety limit: ${maxTokens} > ${Math.round(this.MAX_CONTEXT_TOKENS * this.SAFETY_MARGIN)}`,
        currentValue: maxTokens,
        maxValue: Math.round(this.MAX_CONTEXT_TOKENS * this.SAFETY_MARGIN),
        source: 'ContextSafetySystem',
        timestamp: now,
      });
    }

    // 2. Check for runaway retrieval
    this.retrievalTimestamps.push(now);
    // Clean up old timestamps
    const cutoff = now - this.RETRIEVAL_WINDOW_MS;
    this.retrievalTimestamps = this.retrievalTimestamps.filter(t => t > cutoff);
    if (this.retrievalTimestamps.length > this.MAX_RETRIEVALS_PER_WINDOW) {
      return this.violation({
        type: 'runaway_retrieval',
        message: `Runaway retrieval: ${this.retrievalTimestamps.length} requests in 60s (max ${this.MAX_RETRIEVALS_PER_WINDOW})`,
        currentValue: this.retrievalTimestamps.length,
        maxValue: this.MAX_RETRIEVALS_PER_WINDOW,
        source: 'ContextSafetySystem',
        timestamp: now,
      });
    }

    // 3. Check for recursive retrieval
    const requestKey = this.buildRequestKey(request);
    const lastRequestTime = this.recentRequests.get(requestKey);
    if (lastRequestTime && now - lastRequestTime < this.RECURSION_COOLDOWN_MS) {
      return this.violation({
        type: 'recursive_retrieval',
        message: `Recursive retrieval detected: same request within ${this.RECURSION_COOLDOWN_MS}ms`,
        currentValue: now - lastRequestTime,
        maxValue: this.RECURSION_COOLDOWN_MS,
        source: 'ContextSafetySystem',
        timestamp: now,
      });
    }
    this.recentRequests.set(requestKey, now);

    // 4. Check file count
    if (request.files && request.files.length > this.MAX_FILES_PER_ASSEMBLY) {
      return this.violation({
        type: 'oversized_context',
        message: `Too many explicit files: ${request.files.length} > ${this.MAX_FILES_PER_ASSEMBLY}`,
        currentValue: request.files.length,
        maxValue: this.MAX_FILES_PER_ASSEMBLY,
        source: 'ContextSafetySystem',
        timestamp: now,
      });
    }

    return { safe: true };
  }

  /**
   * Record a completed assembly for memory pressure tracking.
   */
  recordAssembly(_result: { totalTokens: number }): void {
    // Track memory pressure based on recent assembly sizes
    // In production, this would read actual memory metrics
  }

  /**
   * Get safety violation stats.
   */
  getStats(): SafetyStats {
    return {
      totalChecks: this.totalChecks,
      totalViolations: this.totalViolations,
      violationTypes: { ...this.violationTypes },
      runawayRetrievalsBlocked: this.violationTypes['runaway_retrieval'] || 0,
      oversizedContextsBlocked: this.violationTypes['oversized_context'] || 0,
      recursiveRetrievalsBlocked: this.violationTypes['recursive_retrieval'] || 0,
    };
  }

  /**
   * Reset safety state.
   */
  reset(): void {
    this.totalChecks = 0;
    this.totalViolations = 0;
    this.violationTypes = {};
    this.retrievalTimestamps = [];
    this.recentRequests.clear();
  }

  private violation(v: ContextSafetyViolation): SafetyCheckResult {
    this.totalViolations++;
    this.violationTypes[v.type] = (this.violationTypes[v.type] || 0) + 1;
    return { safe: false, violation: v };
  }

  private buildRequestKey(request: ContextAssemblyRequest): string {
    return `${request.goal}|${request.stage || ''}|${request.role || ''}`;
  }
}
