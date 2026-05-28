/**
 * EngineeringExperienceDB — Framework intelligence, dependency resolution memory, and provider optimization memory.
 *
 * Builds reusable operational intelligence by tracking:
 *   - Framework-specific patterns and known issues
 *   - Dependency conflict resolutions
 *   - Runtime recovery patterns
 *   - Provider optimization strategies
 *
 * All data is structured, bounded, and locally-stored.
 */

import { timestamp, generateId } from '@autic/shared';
import type { FrameworkIntelligence } from '@autic/shared';

interface DependencyResolution {
  id: string;
  package: string;
  conflict: string;
  resolution: string;
  framework?: string;
  resolvedAt: number;
  successCount: number;
}

interface RuntimeRecoveryPattern {
  id: string;
  errorType: string;
  recoveryAction: string;
  successRate: number;
  successCount: number;
  failureCount: number;
  lastUsed: number;
}

interface ProviderOptimization {
  id: string;
  provider: string;
  strategy: string;
  successRate: number;
  avgLatencyMs?: number;
  usageCount: number;
}

export class EngineeringExperienceDB {
  private frameworks: Map<string, FrameworkIntelligence> = new Map();
  private dependencyResolutions: DependencyResolution[] = [];
  private recoveryPatterns: RuntimeRecoveryPattern[] = [];
  private providerOptimizations: ProviderOptimization[] = [];

  private maxEntries = 100;

  // ── Framework Intelligence ──

  getFramework(framework: string): FrameworkIntelligence | undefined {
    return this.frameworks.get(framework.toLowerCase());
  }

  updateFramework(params: {
    framework: string;
    version?: string;
    commonPattern?: string;
    knownIssue?: { issue: string; fix: string };
    dependencyConflict?: { package: string; conflict: string; resolution: string };
    buildTip?: string;
  }): void {
    const key = params.framework.toLowerCase();
    let fw = this.frameworks.get(key);

    if (!fw) {
      fw = {
        framework: params.framework,
        version: params.version,
        commonPatterns: [],
        knownIssues: [],
        dependencyConflicts: [],
        buildConfigTips: [],
        updatedAt: timestamp(),
      };
      this.frameworks.set(key, fw);
    }

    if (params.version) fw.version = params.version;
    if (params.commonPattern && !fw.commonPatterns.includes(params.commonPattern)) {
      fw.commonPatterns.push(params.commonPattern);
    }
    if (params.knownIssue) {
      const existing = fw.knownIssues.find((i) => i.issue === params.knownIssue!.issue);
      if (existing) {
        existing.frequency += 1;
      } else {
        fw.knownIssues.push({ ...params.knownIssue, frequency: 1 });
      }
    }
    if (
      params.dependencyConflict &&
      !fw.dependencyConflicts.some((d) => d.conflict === params.dependencyConflict!.conflict)
    ) {
      fw.dependencyConflicts.push({ ...params.dependencyConflict });
    }
    if (params.buildTip && !fw.buildConfigTips.includes(params.buildTip)) {
      fw.buildConfigTips.push(params.buildTip);
    }

    fw.updatedAt = timestamp();
  }

  getFrameworkKnownIssues(
    framework: string,
    limit = 10,
  ): Array<{ issue: string; fix: string; frequency: number }> {
    const fw = this.frameworks.get(framework.toLowerCase());
    if (!fw) return [];
    return [...fw.knownIssues].sort((a, b) => b.frequency - a.frequency).slice(0, limit);
  }

  getFrameworkBuildTips(framework: string): string[] {
    const fw = this.frameworks.get(framework.toLowerCase());
    return fw?.buildConfigTips ?? [];
  }

  // ── Dependency Resolutions ──

  recordDependencyResolution(params: {
    package: string;
    conflict: string;
    resolution: string;
    framework?: string;
  }): void {
    const existing = this.dependencyResolutions.find(
      (d) => d.package === params.package && d.conflict === params.conflict,
    );
    if (existing) {
      existing.successCount += 1;
      return;
    }

    this.dependencyResolutions.push({
      id: generateId(),
      package: params.package,
      conflict: params.conflict,
      resolution: params.resolution,
      framework: params.framework,
      resolvedAt: timestamp(),
      successCount: 1,
    });

    // Enforce limit
    if (this.dependencyResolutions.length > this.maxEntries) {
      this.dependencyResolutions.shift();
    }
  }

  findDependencyResolution(packageName: string, conflict: string): string | undefined {
    const res = this.dependencyResolutions.find(
      (d) => d.package === packageName && d.conflict === conflict,
    );
    return res?.resolution;
  }

  findByFrameworkDependency(framework: string, limit = 10): DependencyResolution[] {
    return this.dependencyResolutions.filter((d) => d.framework === framework).slice(0, limit);
  }

  // ── Runtime Recovery Patterns ──

  recordRecoveryPattern(params: {
    errorType: string;
    recoveryAction: string;
    success: boolean;
  }): void {
    const existing = this.recoveryPatterns.find(
      (r) => r.errorType === params.errorType && r.recoveryAction === params.recoveryAction,
    );
    if (existing) {
      if (params.success) {
        existing.successCount += 1;
      } else {
        existing.failureCount += 1;
      }
      existing.successRate =
        existing.successCount / Math.max(1, existing.successCount + existing.failureCount);
      existing.lastUsed = timestamp();
      return;
    }

    this.recoveryPatterns.push({
      id: generateId(),
      errorType: params.errorType,
      recoveryAction: params.recoveryAction,
      successRate: params.success ? 1 : 0,
      successCount: params.success ? 1 : 0,
      failureCount: params.success ? 0 : 1,
      lastUsed: timestamp(),
    });

    if (this.recoveryPatterns.length > this.maxEntries) {
      this.recoveryPatterns.shift();
    }
  }

  getBestRecoveryFor(errorType: string): string | undefined {
    const patterns = this.recoveryPatterns
      .filter((r) => r.errorType === errorType && r.successCount > 0)
      .sort((a, b) => b.successRate - a.successRate);
    return patterns[0]?.recoveryAction;
  }

  // ── Provider Optimizations ──

  recordProviderOptimization(params: {
    provider: string;
    strategy: string;
    latencyMs?: number;
    success: boolean;
  }): void {
    const existing = this.providerOptimizations.find(
      (o) => o.provider === params.provider && o.strategy === params.strategy,
    );
    if (existing) {
      existing.usageCount += 1;
      if (params.latencyMs) {
        existing.avgLatencyMs = existing.avgLatencyMs
          ? Math.round((existing.avgLatencyMs + params.latencyMs) / 2)
          : params.latencyMs;
      }
      existing.successRate = params.success
        ? Math.min(1, existing.successRate + 0.05)
        : Math.max(0, existing.successRate - 0.1);
      return;
    }

    this.providerOptimizations.push({
      id: generateId(),
      provider: params.provider,
      strategy: params.strategy,
      successRate: params.success ? 0.8 : 0.2,
      avgLatencyMs: params.latencyMs,
      usageCount: 1,
    });

    if (this.providerOptimizations.length > this.maxEntries) {
      this.providerOptimizations.shift();
    }
  }

  getBestProviderStrategies(provider: string, limit = 5): ProviderOptimization[] {
    return this.providerOptimizations
      .filter((o) => o.provider === provider && o.successRate > 0.5)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }

  // ── Stats ──

  getStats(): {
    totalFrameworks: number;
    totalResolutions: number;
    totalRecoveryPatterns: number;
    totalProviderOptimizations: number;
  } {
    return {
      totalFrameworks: this.frameworks.size,
      totalResolutions: this.dependencyResolutions.length,
      totalRecoveryPatterns: this.recoveryPatterns.length,
      totalProviderOptimizations: this.providerOptimizations.length,
    };
  }

  clear(): void {
    this.frameworks.clear();
    this.dependencyResolutions = [];
    this.recoveryPatterns = [];
    this.providerOptimizations = [];
  }
}
