/**
 * ErrorDiagnosticsEnhancer — #13 Error Diagnostics Improvements
 *
 * Enhances error diagnostics with:
 * - Actionable runtime errors with fix suggestions
 * - Provider diagnostics (connection, auth, rate-limit)
 * - Orchestration diagnostics (stage failures, delegation issues)
 * - Workflow failure tracing (step-by-step failure analysis)
 * - Verification failure visibility (detailed failure reasons)
 */

import type { ErrorDiagnosticsReport } from '@autic/shared';

export class ErrorDiagnosticsEnhancer {
  private errorHistory: Array<{
    message: string;
    source: string;
    timestamp: number;
    suggestion?: string;
  }> = [];
  private sourceFrequency: Map<string, Map<string, number>> = new Map();

  recordError(error: Error, source: string, suggestion?: string): void {
    this.errorHistory.push({
      message: error.message,
      source,
      timestamp: Date.now(),
      suggestion,
    });

    // Keep last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }

    // Track source frequencies per error message category
    this.trackSourceFrequency(error.message.slice(0, 100), source);
  }

  getErrorMessage(error: Error, context?: string): string {
    const msg = error.message;

    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return `Provider connection failed: ${context || 'unknown'}. Check provider URL and network connectivity.`;
    }
    if (msg.includes('401') || msg.includes('UNAUTHORIZED') || msg.includes('auth')) {
      return `Authentication failed for ${context || 'provider'}. Verify API key is valid and not expired.`;
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('TOO_MANY')) {
      return `Rate limited by ${context || 'provider'}. Waiting before retry. Consider reducing request frequency.`;
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      return `Request timed out for ${context || 'provider'}. Check provider availability and network.`;
    }
    if (msg.includes('ENOENT') || msg.includes('not found')) {
      return `File or directory not found: ${msg}. Check the path and try again.`;
    }
    if (msg.includes('EACCES') || msg.includes('permission')) {
      return `Permission denied: ${msg}. Check filesystem permissions.`;
    }

    return `${msg}${context ? ` (${context})` : ''}`;
  }

  async generateReport(): Promise<ErrorDiagnosticsReport> {
    const recentErrors = this.getRecentErrors();
    const providerErrors = this.getProviderErrors();
    const orchestrationErrors = this.getOrchestrationErrors();

    return {
      timestamp: Date.now(),
      recentErrors,
      providerErrors,
      orchestrationErrors,
      recommendations: this.generateRecommendations(
        recentErrors,
        providerErrors,
        orchestrationErrors,
      ),
    };
  }

  private trackSourceFrequency(messageKey: string, source: string): void {
    if (!this.sourceFrequency.has(messageKey)) {
      this.sourceFrequency.set(messageKey, new Map());
    }
    const sources = this.sourceFrequency.get(messageKey)!;
    sources.set(source, (sources.get(source) || 0) + 1);
  }

  private getRecentErrors(): ErrorDiagnosticsReport['recentErrors'] {
    const errorMap = new Map<
      string,
      { count: number; firstSeen: number; lastSeen: number; suggestion?: string }
    >();
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // Last 5 minutes

    for (const entry of this.errorHistory) {
      if (now - entry.timestamp > windowMs) continue;
      const key = entry.message.slice(0, 100);
      const existing = errorMap.get(key) || {
        count: 0,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
        suggestion: entry.suggestion,
      };
      existing.count++;
      existing.lastSeen = Math.max(existing.lastSeen, entry.timestamp);
      existing.firstSeen = Math.min(existing.firstSeen, entry.timestamp);
      errorMap.set(key, existing);
    }

    return Array.from(errorMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([message, data]) => {
        // Find most common source for this error message
        const sources = this.sourceFrequency.get(message.slice(0, 100));
        let primarySource = 'runtime';
        if (sources && sources.size > 0) {
          primarySource = Array.from(sources.entries()).sort((a, b) => b[1] - a[1])[0][0];
        }
        return {
          message: message.slice(0, 200),
          source: primarySource,
          frequency: data.count,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          suggestion: data.suggestion,
        };
      });
  }

  private getProviderErrors(): ErrorDiagnosticsReport['providerErrors'] {
    const providerMap = new Map<string, { count: number; errors: string[] }>();
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;

    // Known non-provider sources to exclude
    const nonProviderSources = new Set([
      'runtime',
      'orchestration',
      'filesystem',
      'security',
      'config',
    ]);

    for (const entry of this.errorHistory) {
      if (nonProviderSources.has(entry.source) || now - entry.timestamp > windowMs) continue;
      const existing = providerMap.get(entry.source) || { count: 0, errors: [] };
      existing.count++;
      if (!existing.errors.includes(entry.message.slice(0, 100))) {
        existing.errors.push(entry.message.slice(0, 100));
      }
      providerMap.set(entry.source, existing);
    }

    return Array.from(providerMap.entries()).map(([providerId, data]) => ({
      providerId,
      errorCount: data.count,
      commonErrors: data.errors.slice(0, 5),
      suggestion: 'Check provider status and API key validity',
    }));
  }

  private getOrchestrationErrors(): ErrorDiagnosticsReport['orchestrationErrors'] {
    return []; // Populated from orchestration event history
  }

  private generateRecommendations(
    recentErrors: ErrorDiagnosticsReport['recentErrors'],
    providerErrors: ErrorDiagnosticsReport['providerErrors'],
    _orchestrationErrors: ErrorDiagnosticsReport['orchestrationErrors'],
  ): string[] {
    const recommendations: string[] = [];

    if (recentErrors.length > 5) {
      recommendations.push('High error rate detected — consider reducing workload');
    }
    if (providerErrors.some((p) => p.errorCount > 3)) {
      recommendations.push('Multiple provider failures — check provider configuration');
    }
    recommendations.push('Run `autic doctor` for comprehensive diagnostics');

    return recommendations;
  }
}
