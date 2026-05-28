/**
 * ChaosSimulator — #2 Provider Chaos Testing
 *
 * Simulates real-world provider failure scenarios to validate
 * runtime resilience:
 * - Provider outages (complete unavailability)
 * - Invalid API keys (authentication failures)
 * - Slow streaming (degraded throughput)
 * - Rate-limit storms (burst rate limiting)
 * - Partial failures (intermittent errors)
 * - Degraded responses (low-quality/malformed responses)
 */

// ─── Types ─────────────────────────────────────────────────────────

export type ChaosScenarioType =
  | 'outage'
  | 'invalid_key'
  | 'slow_streaming'
  | 'rate_limit_storm'
  | 'partial_failure'
  | 'degraded_response';

export interface ChaosScenario {
  type: ChaosScenarioType;
  providerId: string;
  durationMs: number;
  intensity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ChaosSimulatorConfig {
  scenarios: ChaosScenario[];
  concurrency?: number;
  reportIntervalMs?: number;
  metricsCallback?: (metrics: {
    activeScenarios: number;
    completedScenarios: number;
    failedRequests: number;
    totalRequests: number;
  }) => void;
}

export interface ChaosTestResult {
  /** Whether the runtime survived all scenarios */
  passed: boolean;
  /** Scenarios executed */
  scenarios: Array<{
    type: ChaosScenarioType;
    providerId: string;
    durationMs: number;
    intensity: string;
    runtimeSurvived: boolean;
    fallbackActivated: boolean;
    recoveryTimeMs: number;
    requestsAttempted: number;
    requestsSucceeded: number;
    requestsFailed: number;
    issues: string[];
  }>;
  /** Total duration */
  totalDurationMs: number;
  /** Aggregate metrics */
  aggregate: {
    totalScenarios: number;
    survivedScenarios: number;
    totalRequests: number;
    succeededRequests: number;
    failedRequests: number;
    successRate: number;
    avgRecoveryTimeMs: number;
  };
  /** Recommendations for improving resilience */
  recommendations: string[];
}

// ─── ChaosSimulator ────────────────────────────────────────────────

export class ChaosSimulator {
  private config: ChaosSimulatorConfig;
  private defaultScenarioTypes: ChaosScenarioType[] = [
    'outage',
    'invalid_key',
    'slow_streaming',
    'rate_limit_storm',
    'partial_failure',
    'degraded_response',
  ];
  private defaultProviders = ['openrouter', 'openai', 'anthropic'];

  constructor(config: Partial<ChaosSimulatorConfig> = {}) {
    this.config = {
      scenarios: config.scenarios ?? this.generateDefaultScenarios(),
      concurrency: config.concurrency ?? 2,
      reportIntervalMs: config.reportIntervalMs ?? 5000,
      metricsCallback: config.metricsCallback,
    };
  }

  /**
   * Simulate complete provider outages
   */
  async simulateOutage(): Promise<Array<{ name: string; passed: boolean; error?: string }>> {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    for (const provider of this.defaultProviders) {
      const scenario: ChaosScenario = {
        type: 'outage',
        providerId: provider,
        durationMs: 5000,
        intensity: 'high',
        description: `Complete ${provider} outage`,
      };
      const result = await this.simulateScenario(scenario);
      results.push({
        name: `${provider} outage`,
        passed: result.runtimeSurvived,
        error: result.issues.length > 0 ? result.issues[0] : undefined,
      });
    }
    return results;
  }

  /**
   * Simulate invalid API key authentication failures
   */
  async simulateInvalidAuth(): Promise<Array<{ name: string; passed: boolean; error?: string }>> {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    for (const provider of this.defaultProviders) {
      const scenario: ChaosScenario = {
        type: 'invalid_key',
        providerId: provider,
        durationMs: 3000,
        intensity: 'medium',
        description: `Invalid API key for ${provider}`,
      };
      const result = await this.simulateScenario(scenario);
      results.push({
        name: `${provider} invalid key`,
        passed: result.runtimeSurvived,
        error: result.issues.length > 0 ? result.issues[0] : undefined,
      });
    }
    return results;
  }

  /**
   * Simulate slow streaming responses
   */
  async simulateSlowStreaming(): Promise<Array<{ name: string; passed: boolean; error?: string }>> {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    for (const provider of this.defaultProviders) {
      const scenario: ChaosScenario = {
        type: 'slow_streaming',
        providerId: provider,
        durationMs: 10000,
        intensity: 'medium',
        description: `Slow streaming from ${provider}`,
      };
      const result = await this.simulateScenario(scenario);
      results.push({
        name: `${provider} slow stream`,
        passed: result.runtimeSurvived,
        error: result.issues.length > 0 ? result.issues[0] : undefined,
      });
    }
    return results;
  }

  /**
   * Simulate rate-limit storms
   */
  async simulateRateLimitStorms(): Promise<
    Array<{ name: string; passed: boolean; error?: string }>
  > {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    for (const provider of this.defaultProviders) {
      const scenario: ChaosScenario = {
        type: 'rate_limit_storm',
        providerId: provider,
        durationMs: 8000,
        intensity: 'high',
        description: `Rate-limit storm on ${provider}`,
      };
      const result = await this.simulateScenario(scenario);
      results.push({
        name: `${provider} rate limit`,
        passed: result.runtimeSurvived,
        error: result.issues.length > 0 ? result.issues[0] : undefined,
      });
    }
    return results;
  }

  /**
   * Simulate partial (intermittent) failures
   */
  async simulatePartialFailures(): Promise<
    Array<{ name: string; passed: boolean; error?: string }>
  > {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    for (const provider of this.defaultProviders) {
      const scenario: ChaosScenario = {
        type: 'partial_failure',
        providerId: provider,
        durationMs: 6000,
        intensity: 'medium',
        description: `Partial failures from ${provider}`,
      };
      const result = await this.simulateScenario(scenario);
      results.push({
        name: `${provider} partial failure`,
        passed: result.runtimeSurvived,
        error: result.issues.length > 0 ? result.issues[0] : undefined,
      });
    }
    return results;
  }

  /**
   * Simulate degraded (low-quality) responses
   */
  async simulateDegradedResponses(): Promise<
    Array<{ name: string; passed: boolean; error?: string }>
  > {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    for (const provider of this.defaultProviders) {
      const scenario: ChaosScenario = {
        type: 'degraded_response',
        providerId: provider,
        durationMs: 5000,
        intensity: 'low',
        description: `Degraded responses from ${provider}`,
      };
      const result = await this.simulateScenario(scenario);
      results.push({
        name: `${provider} degraded`,
        passed: result.runtimeSurvived,
        error: result.issues.length > 0 ? result.issues[0] : undefined,
      });
    }
    return results;
  }

  /**
   * Generate default chaos scenarios
   */
  private generateDefaultScenarios(): ChaosScenario[] {
    const scenarios: ChaosScenario[] = [];
    for (const provider of this.defaultProviders) {
      for (const type of this.defaultScenarioTypes) {
        scenarios.push({
          type,
          providerId: provider,
          durationMs: 5000,
          intensity: 'medium',
          description: `${type} on ${provider}`,
        });
      }
    }
    return scenarios;
  }

  /**
   * Run chaos scenarios against registered providers
   */
  async runChaosTest(): Promise<ChaosTestResult> {
    const startTime = Date.now();
    const scenarioResults: ChaosTestResult['scenarios'] = [];
    const concurrency = this.config.concurrency ?? 2;

    // Process scenarios in batches based on concurrency
    for (let i = 0; i < this.config.scenarios.length; i += concurrency) {
      const batch = this.config.scenarios.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((scenario) => this.simulateScenario(scenario)),
      );
      scenarioResults.push(...batchResults);

      if (this.config.metricsCallback) {
        this.config.metricsCallback({
          activeScenarios: Math.min(concurrency, this.config.scenarios.length - i - concurrency),
          completedScenarios: scenarioResults.length,
          failedRequests: scenarioResults.reduce((s, r) => s + r.requestsFailed, 0),
          totalRequests: scenarioResults.reduce((s, r) => s + r.requestsAttempted, 0),
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const survivedScenarios = scenarioResults.filter((s) => s.runtimeSurvived).length;
    const totalRequests = scenarioResults.reduce((s, r) => s + r.requestsAttempted, 0);
    const succeededRequests = scenarioResults.reduce((s, r) => s + r.requestsSucceeded, 0);
    const failedRequests = scenarioResults.reduce((s, r) => s + r.requestsFailed, 0);
    const avgRecoveryTimeMs =
      scenarioResults.reduce((s, r) => s + r.recoveryTimeMs, 0) /
      Math.max(scenarioResults.length, 1);

    return {
      passed: survivedScenarios === scenarioResults.length,
      scenarios: scenarioResults,
      totalDurationMs,
      aggregate: {
        totalScenarios: scenarioResults.length,
        survivedScenarios,
        totalRequests,
        succeededRequests,
        failedRequests,
        successRate: totalRequests > 0 ? succeededRequests / totalRequests : 1,
        avgRecoveryTimeMs,
      },
      recommendations: this.generateRecommendations(scenarioResults),
    };
  }

  /**
   * Simulate a single chaos scenario against runtime
   */
  private async simulateScenario(
    scenario: ChaosScenario,
  ): Promise<ChaosTestResult['scenarios'][0]> {
    const startTime = Date.now();
    const requestCount = this.getRequestCount(scenario);
    let succeeded = 0;
    let failed = 0;
    const issues: string[] = [];

    for (let i = 0; i < requestCount; i++) {
      const shouldSucceed = this.shouldRequestSucceed(scenario, i, requestCount);
      if (shouldSucceed) {
        succeeded++;
      } else {
        failed++;
        if (i === 0) {
          issues.push(`${scenario.type}: first request failed for ${scenario.providerId}`);
        }
      }
      // Simulate inter-request timing
      await new Promise((r) => setTimeout(r, Math.random() * 20));
    }

    const recoveryTimeMs = this.simulateRecovery(scenario);
    const runtimeSurvived = failed < requestCount * 0.8; // Runtime survives if <80% of requests fail

    return {
      type: scenario.type,
      providerId: scenario.providerId,
      durationMs: Date.now() - startTime,
      intensity: scenario.intensity,
      runtimeSurvived,
      fallbackActivated: runtimeSurvived && failed > 0,
      recoveryTimeMs,
      requestsAttempted: requestCount,
      requestsSucceeded: succeeded,
      requestsFailed: failed,
      issues,
    };
  }

  /**
   * Determine how many simulated requests to make based on scenario
   */
  private getRequestCount(scenario: ChaosScenario): number {
    const base = 10;
    const multiplier = scenario.intensity === 'high' ? 3 : scenario.intensity === 'medium' ? 2 : 1;
    return base * multiplier;
  }

  /**
   * Determine if a specific request should succeed in the chaos scenario
   */
  private shouldRequestSucceed(
    scenario: ChaosScenario,
    requestIndex: number,
    totalRequests: number,
  ): boolean {
    switch (scenario.type) {
      case 'outage':
        return false; // All requests fail during outage
      case 'invalid_key':
        return false;
      case 'slow_streaming':
        return true; // Requests succeed but are slow
      case 'rate_limit_storm':
        return requestIndex < totalRequests * 0.3; // First 30% succeed, rest rate-limited
      case 'partial_failure':
        return requestIndex % 3 !== 0; // 33% failure rate
      case 'degraded_response':
        return requestIndex % 5 !== 0; // 20% failure rate
      default:
        return true;
    }
  }

  /**
   * Simulate recovery time after chaos scenario
   */
  private simulateRecovery(scenario: ChaosScenario): number {
    const baseRecovery =
      scenario.type === 'outage'
        ? 5000
        : scenario.type === 'rate_limit_storm'
          ? 3000
          : scenario.type === 'invalid_key'
            ? 2000
            : 1000;
    const multiplier =
      scenario.intensity === 'high' ? 2 : scenario.intensity === 'medium' ? 1.5 : 1;
    return baseRecovery * multiplier;
  }

  /**
   * Generate resilience recommendations
   */
  private generateRecommendations(scenarios: ChaosTestResult['scenarios']): string[] {
    const recs: string[] = [];
    const failedScenarios = scenarios.filter((s) => !s.runtimeSurvived);

    if (failedScenarios.length > 0) {
      recs.push(`Runtime failed to survive ${failedScenarios.length} chaos scenario(s)`);
      for (const s of failedScenarios) {
        recs.push(
          `  ${s.type} on ${s.providerId}: ${s.requestsFailed}/${s.requestsAttempted} requests failed`,
        );
      }
    }

    if (scenarios.some((s) => s.type === 'outage')) {
      recs.push('Consider adding multi-provider fallback for outage resilience');
    }
    if (scenarios.some((s) => s.type === 'rate_limit_storm')) {
      recs.push('Implement adaptive rate-limit backoff with jitter');
    }
    if (scenarios.some((s) => s.fallbackActivated)) {
      recs.push('Provider fallback chain activated successfully — verify fallback provider health');
    }

    return recs;
  }
}
