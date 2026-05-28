/**
 * VerifiedFixMemory — Only persists verified successful fixes.
 *
 * Critical safety guarantees:
 *   - Only stores fixes that passed ALL verification checks
 *   - Tracks usage count and confidence over time
 *   - Never stores unverified or hallucinated outputs
 *   - Bounded to prevent memory bloat
 */

import { timestamp, generateId } from '@autic/shared';
import type { VerifiedFix, VerificationCheck } from '@autic/shared';

export interface VerifiedFixMemoryOptions {
  maxFixes?: number;
}

interface FixRecord {
  fix: VerifiedFix;
  verificationResults: Array<{ passed: boolean }>;
}

export class VerifiedFixMemory {
  private fixes: Map<string, FixRecord> = new Map();
  private maxFixes: number;

  constructor(options: VerifiedFixMemoryOptions = {}) {
    this.maxFixes = options.maxFixes ?? 200;
  }

  /**
   * Record a verified fix. Only stores if ALL verification checks passed.
   * If any check failed, the fix is NOT stored.
   */
  record(params: {
    issue: string;
    fix: string;
    framework?: string;
    dependency?: string;
    errorType: string;
    filesChanged: string[];
    verificationChecks: Array<{ passed: boolean }>;
  }): VerifiedFix | null {
    // ONLY store verified fixes — reject if any check failed
    const allPassed = params.verificationChecks.every((c) => c.passed);
    if (!allPassed) return null;

    // Check for exact duplicate
    const existing = Array.from(this.fixes.values()).find(
      (r) => r.fix.issue === params.issue && r.fix.fix === params.fix,
    );
    if (existing) {
      existing.fix.usageCount += 1;
      existing.fix.lastUsed = timestamp();
      existing.fix.confidence = Math.min(1.0, existing.fix.confidence + 0.05);
      return existing.fix;
    }

    // Enforce max limit — remove oldest if full
    if (this.fixes.size >= this.maxFixes) {
      const oldest = Array.from(this.fixes.entries()).sort(
        ([, a], [, b]) => a.fix.verifiedAt - b.fix.verifiedAt,
      )[0];
      if (oldest) this.fixes.delete(oldest[0]);
    }

    const now = timestamp();
    const fix: VerifiedFix = {
      id: generateId(),
      issue: params.issue,
      fix: params.fix,
      framework: params.framework,
      dependency: params.dependency,
      errorType: params.errorType,
      filesChanged: params.filesChanged,
      verificationChecks: params.verificationChecks as VerificationCheck[],
      verifiedAt: now,
      confidence: 0.85,
      usageCount: 1,
      lastUsed: now,
    };

    this.fixes.set(fix.id, { fix, verificationResults: params.verificationChecks });
    return fix;
  }

  /**
   * Find fixes matching a framework, dependency, or error type.
   */
  find(params: {
    framework?: string;
    dependency?: string;
    errorType?: string;
    minConfidence?: number;
    maxResults?: number;
  }): VerifiedFix[] {
    let results = Array.from(this.fixes.values()).map((r) => r.fix);

    if (params.framework) results = results.filter((f) => f.framework === params.framework);
    if (params.dependency) results = results.filter((f) => f.dependency === params.dependency);
    if (params.errorType) results = results.filter((f) => f.errorType === params.errorType);
    if (params.minConfidence)
      results = results.filter((f) => f.confidence >= params.minConfidence!);

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, params.maxResults ?? 20);
  }

  /**
   * Get recent fixes, optionally filtered by framework.
   */
  getRecent(framework?: string, limit = 10): VerifiedFix[] {
    let results = Array.from(this.fixes.values()).map((r) => r.fix);
    if (framework) results = results.filter((f) => f.framework === framework);
    results.sort((a, b) => b.verifiedAt - a.verifiedAt);
    return results.slice(0, limit);
  }

  /**
   * Compress the fix memory — remove low-confidence, low-usage fixes.
   */
  compress(): void {
    const now = timestamp();
    const sixtyDays = 60 * 24 * 60 * 60_000;

    for (const [id, record] of this.fixes) {
      // Remove very old, unused fixes with low confidence
      if (
        record.fix.confidence < 0.5 &&
        record.fix.usageCount <= 1 &&
        now - record.fix.verifiedAt > sixtyDays
      ) {
        this.fixes.delete(id);
      }
    }
  }

  /**
   * Get total count of stored fixes.
   */
  count(): number {
    return this.fixes.size;
  }

  /**
   * Clear all fixes.
   */
  clear(): void {
    this.fixes.clear();
  }
}
