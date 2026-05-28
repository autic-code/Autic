/**
 * FailureClassifier — Structured runtime failure classification.
 *
 * Classifies errors into actionable categories for the repair loop,
 * providing retry metadata and suggestions for each failure type.
 */

import type { FailureClassification, FailureCategory } from '@autic/shared';

export class FailureClassifier {
  private customPatterns: Array<{ pattern: RegExp; category: FailureCategory }> = [];

  /**
   * Add a custom failure pattern for detection.
   */
  addPattern(pattern: RegExp, category: FailureCategory): void {
    this.customPatterns.push({ pattern, category });
  }

  /**
   * Classify a failure based on error message, step type, and context.
   */
  classify(params: {
    error: string;
    stepType?: string;
    toolName?: string;
    exitCode?: number;
    durationMs?: number;
  }): FailureClassification {
    const { error, stepType, toolName, exitCode, durationMs } = params;
    const lower = error.toLowerCase();

    // Check custom patterns first
    for (const cp of this.customPatterns) {
      if (cp.pattern.test(error)) {
        return this.createClassification(cp.category, error);
      }
    }

    // Provider errors
    if (this.matchesAny(lower, ['provider', 'api key', 'openrouter', 'ollama', 'model not found', 'rate limit', 'insufficient quota'])) {
      if (this.matchesAny(lower, ['timeout', 'timed out'])) {
        return this.createClassification('timeout', 'Provider request timed out — consider retrying with a different model', true, 'backoff');
      }
      if (this.matchesAny(lower, ['rate limit', 'too many requests'])) {
        return this.createClassification('provider_error', 'Rate limited by provider — backing off before retry', true, 'backoff');
      }
      if (this.matchesAny(lower, ['auth', 'unauthorized', 'invalid key', 'api key'])) {
        return this.createClassification('provider_error', 'Authentication failed — check provider API key', false, 'abort');
      }
      if (this.matchesAny(lower, ['quota', 'credit', 'billing', 'insufficient'])) {
        return this.createClassification('provider_error', 'Insufficient provider credits — top up account or switch models', false, 'abort');
      }
      return this.createClassification('provider_error', 'Provider error occurred — check provider health', true, 'backoff');
    }

    // Compilation / type errors
    if (this.matchesAny(lower, ['compilation', 'compile error', 'ts2304', 'ts2322', 'ts6133', 'ts2352', 'ts6196'])) {
      return this.createClassification('compilation_error', 'TypeScript compilation error — check types and imports', false, 'skip_step');
    }
    if (this.matchesAny(lower, ['type error', 'typeerror', 'is not assignable', 'is declared but'])) {
      return this.createClassification('type_error', 'Type error — fix type annotations', false, 'skip_step');
    }
    if (this.matchesAny(lower, ['cannot find module', 'module not found', 'import resolution'])) {
      return this.createClassification('dependency', 'Missing module import — check package dependencies', false, 'skip_step');
    }

    // Dependency errors
    if (this.matchesAny(lower, ['enoent', 'not found', 'no such file', 'does not exist'])) {
      return this.createClassification('dependency', 'File or resource not found — check path', false, 'skip_step');
    }
    if (this.matchesAny(lower, ['npm error', 'pnpm error', 'yarn error', 'install failed', 'peer dependency', 'version mismatch'])) {
      return this.createClassification('dependency', 'Package dependency error — check package.json', false, 'skip_step');
    }
    if (this.matchesAny(lower, ['cannot find package', 'package not found'])) {
      return this.createClassification('dependency', 'Missing package dependency — install required packages', false, 'skip_step');
    }

    // Timeout errors
    if (this.matchesAny(lower, ['timeout', 'timed out', 'etimedout', 'econnrefused'])) {
      return this.createClassification('timeout', 'Operation timed out', true, 'backoff');
    }
    if (durationMs && durationMs > 60_000) {
      return this.createClassification('timeout', 'Operation exceeded maximum duration', false, 'skip_step');
    }

    // Permission errors
    if (this.matchesAny(lower, ['permission denied', 'eacces', 'eprem', 'not allowed', 'forbidden', 'unauthorized access'])) {
      return this.createClassification('permission_denied', 'Permission denied — operation requires elevated permissions', false, 'abort');
    }

    // Verification failures
    if (stepType === 'verify' || this.matchesAny(lower, ['verification failed', 'test failed', 'build failed', 'lint error'])) {
      return this.createClassification('verification_failed', 'Verification check did not pass', false, 'skip_step');
    }

    // Exit code based classification
    if (exitCode !== undefined && exitCode !== 0) {
      if (this.matchesAny(lower, ['test', 'spec', 'jest', 'vitest'])) {
        return this.createClassification('verification_failed', `Test exited with code ${exitCode}`, false, 'skip_step');
      }
      if (this.matchesAny(lower, ['build', 'tsc', 'compile'])) {
        return this.createClassification('compilation_error', `Build exited with code ${exitCode}`, false, 'skip_step');
      }
    }

    // Tool errors
    if (toolName) {
      return this.createClassification('tool_error', `Tool "${toolName}" failed: ${error.slice(0, 100)}`, true, 'immediate');
    }

    // Runtime crash
    if (this.matchesAny(lower, ['crash', 'segfault', 'segmentation fault', 'abort', 'panic', 'out of memory'])) {
      return this.createClassification('runtime_crash', 'Runtime crash detected — this may indicate a system issue', false, 'abort');
    }

    // Default: unknown
    return this.createClassification('unknown', error.slice(0, 200), true, 'backoff');
  }

  /**
   * Get retry delay in ms based on strategy and retry count.
   */
  getRetryDelay(strategy: 'immediate' | 'backoff' | 'skip_step' | 'abort', retryCount: number): number {
    switch (strategy) {
      case 'immediate':
        return 100;
      case 'backoff':
        return Math.min(1000 * Math.pow(2, retryCount), 30_000);
      case 'skip_step':
      case 'abort':
        return 0;
    }
  }

  /**
   * Determine if a failure category is recoverable.
   */
  isRecoverable(category: FailureCategory): boolean {
    return ['timeout', 'provider_error', 'tool_error', 'unknown'].includes(category);
  }

  private createClassification(
    category: FailureCategory,
    description: string,
    retryable = false,
    retryStrategy: 'immediate' | 'backoff' | 'skip_step' | 'abort' = 'abort',
  ): FailureClassification {
    const severity = retryable
      ? 'medium'
      : category === 'runtime_crash' || category === 'permission_denied'
        ? 'high'
        : 'low';

    return {
      category,
      severity,
      retryable,
      retryStrategy,
      description,
    };
  }

  private matchesAny(text: string, patterns: string[]): boolean {
    return patterns.some((p) => text.includes(p));
  }
}
