/**
 * Observability Enhancer — provides professional engineering-grade
 * transparency into orchestration, queue, provider, context,
 * learning, and runtime health indicators.
 *
 * Accepts optional data source references for real subsystem integration.
 */

import { timestamp } from '@autic/shared';

/**
 * Optional data sources for real subsystem observability
 */
export interface ObservabilityDataSources {
  /** Session manager for session/context stats */
  sessionManager?: {
    listSessions(): Array<{ state: string; totalTokensUsed?: number }>;
  };
  /** Queue for queue stats */
  queue?: {
    getDepth(): number;
    getProcessed(): number;
    getWaiting(): number;
    getInProgress(): number;
    getFailed(): number;
    getAvgWaitTime(): number;
    getAvgProcessingTime(): number;
    getThroughput(): number;
    getTopErrors(): Array<{ error: string; count: number }>;
  };
  /** Provider registry for provider stats */
  providerRegistry?: {
    getAllProviderStates(): Array<{
      providerId: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      totalRequests?: number;
      successfulRequests?: number;
      failedRequests?: number;
      avgLatencyMs?: number;
      modelCount?: number;
    }>;
  };
  /** Learning system for learning stats */
  learningSystem?: {
    getPatternCount(): number;
    getFixCount(): number;
    getExperienceCount(): number;
    getAccuracy(): number;
    getLastLearningTime(): number | null;
  };
  /** Orchestration system for pipeline stats */
  orchestrationSystem?: {
    getActivePipelineCount(): number;
    getCompletedPipelineCount(): number;
    getFailedPipelineCount(): number;
    getStageDistribution(): Record<string, number>;
    getAgentUtilization(): Record<string, number>;
    getAvgDurationMs(): number;
    getThroughput(): number;
  };
}

/**
 * Observable metric
 */
export interface ObservableMetric {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Unit label */
  unit: string;
  /** Timestamp */
  timestamp: number;
  /** Optional labels */
  labels?: Record<string, string>;
}

/**
 * Observable event
 */
export interface ObservableEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Event message */
  message: string;
  /** Event source */
  source: string;
  /** Timestamp */
  timestamp: number;
  /** Event details */
  details?: Record<string, unknown>;
}

/**
 * Orchestration observability snapshot
 */
export interface OrchestrationSnapshot {
  /** Active pipeline count */
  activePipelines: number;
  /** Completed pipeline count */
  completedPipelines: number;
  /** Failed pipeline count */
  failedPipelines: number;
  /** Current stage distribution */
  stageDistribution: Record<string, number>;
  /** Agent utilization */
  agentUtilization: Record<string, number>;
  /** Average pipeline duration */
  avgPipelineDurationMs: number;
  /** Pipeline throughput (per minute) */
  pipelineThroughput: number;
}

/**
 * Queue observability snapshot
 */
export interface QueueSnapshot {
  /** Current queue depth */
  queueDepth: number;
  /** Tasks processed */
  tasksProcessed: number;
  /** Tasks waiting */
  tasksWaiting: number;
  /** Tasks in progress */
  tasksInProgress: number;
  /** Tasks failed */
  tasksFailed: number;
  /** Average wait time */
  avgWaitTimeMs: number;
  /** Average processing time */
  avgProcessingTimeMs: number;
  /** Queue throughput (per minute) */
  queueThroughput: number;
  /** Top errors */
  topErrors: Array<{ error: string; count: number }>;
}

/**
 * Provider observability snapshot
 */
export interface ProviderSnapshot {
  /** Provider ID */
  providerId: string;
  /** Provider status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average latency */
  avgLatencyMs: number;
  /** Error rate */
  errorRate: number;
  /** Models available */
  modelsAvailable: number;
  /** Rate limit remaining */
  rateLimitRemaining?: number;
}

/**
 * Context observability snapshot
 */
export interface ContextSnapshot {
  /** Active sessions */
  activeSessions: number;
  /** Total tokens managed */
  totalTokensManaged: number;
  /** Average tokens per session */
  avgTokensPerSession: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Compression ratio */
  compressionRatio: number;
  /** Retrieval operations */
  retrievalOperations: number;
  /** Context prunes */
  contextPrunes: number;
}

/**
 * Learning observability snapshot
 */
export interface LearningSnapshot {
  /** Patterns learned */
  patternsLearned: number;
  /** Fixes memorized */
  fixesMemorized: number;
  /** Experience entries */
  experienceEntries: number;
  /** Learning accuracy */
  learningAccuracy: number;
  /** Last learning timestamp */
  lastLearningAt: number | null;
}

/**
 * Runtime health indicators
 */
export interface RuntimeHealthIndicators {
  /** Overall health status */
  overall: 'healthy' | 'degraded' | 'unhealthy';
  /** Memory health */
  memory: 'healthy' | 'warning' | 'critical';
  /** CPU load */
  cpuLoad: number;
  /** Uptime */
  uptimeMs: number;
  /** Active workers */
  activeWorkers: number;
  /** Error rate (last 5 min) */
  errorRate5m: number;
  /** Last health check timestamp */
  lastCheck: number;
}

/**
 * Observability Enhancer — aggregates and provides system observability.
 * Connects to real subsystems when data sources are provided.
 */
export class ObservabilityEnhancer {
  private metrics: ObservableMetric[] = [];
  private events: ObservableEvent[] = [];
  private maxHistory: number = 1000;
  private dataSources?: ObservabilityDataSources;

  /**
   * @param dataSources Optional subsystem references for real observability data
   */
  constructor(dataSources?: ObservabilityDataSources) {
    this.dataSources = dataSources;
  }

  /**
   * Record a metric
   */
  recordMetric(metric: Omit<ObservableMetric, 'timestamp'>): void {
    this.metrics.push({ ...metric, timestamp: timestamp() });
    if (this.metrics.length > this.maxHistory) {
      this.metrics = this.metrics.slice(-this.maxHistory);
    }
  }

  /**
   * Record an event
   */
  recordEvent(event: Omit<ObservableEvent, 'id' | 'timestamp'>): void {
    this.events.push({
      ...event,
      id: `evt-${timestamp()}`,
      timestamp: timestamp(),
    });
    if (this.events.length > this.maxHistory) {
      this.events = this.events.slice(-this.maxHistory);
    }
  }

  /**
   * Get orchestration observability snapshot
   * Uses orchestration system data source if available
   */
  getOrchestrationSnapshot(): OrchestrationSnapshot {
    const orch = this.dataSources?.orchestrationSystem;
    if (orch) {
      return {
        activePipelines: orch.getActivePipelineCount(),
        completedPipelines: orch.getCompletedPipelineCount(),
        failedPipelines: orch.getFailedPipelineCount(),
        stageDistribution: orch.getStageDistribution(),
        agentUtilization: orch.getAgentUtilization(),
        avgPipelineDurationMs: orch.getAvgDurationMs(),
        pipelineThroughput: orch.getThroughput(),
      };
    }
    return {
      activePipelines: 0,
      completedPipelines: 0,
      failedPipelines: 0,
      stageDistribution: {},
      agentUtilization: {},
      avgPipelineDurationMs: 0,
      pipelineThroughput: 0,
    };
  }

  /**
   * Get queue observability snapshot
   * Uses queue data source if available
   */
  getQueueSnapshot(): QueueSnapshot {
    const q = this.dataSources?.queue;
    if (q) {
      return {
        queueDepth: q.getDepth(),
        tasksProcessed: q.getProcessed(),
        tasksWaiting: q.getWaiting(),
        tasksInProgress: q.getInProgress(),
        tasksFailed: q.getFailed(),
        avgWaitTimeMs: q.getAvgWaitTime(),
        avgProcessingTimeMs: q.getAvgProcessingTime(),
        queueThroughput: q.getThroughput(),
        topErrors: q.getTopErrors(),
      };
    }
    return {
      queueDepth: 0,
      tasksProcessed: 0,
      tasksWaiting: 0,
      tasksInProgress: 0,
      tasksFailed: 0,
      avgWaitTimeMs: 0,
      avgProcessingTimeMs: 0,
      queueThroughput: 0,
      topErrors: [],
    };
  }

  /**
   * Get provider observability snapshot
   * Uses provider registry data source if available
   */
  getProviderSnapshot(): ProviderSnapshot {
    const providers = this.dataSources?.providerRegistry;
    if (providers) {
      const states = providers.getAllProviderStates();
      if (states.length > 0) {
        const primary = states[0];
        return {
          providerId: primary.providerId,
          status: primary.status,
          totalRequests: primary.totalRequests ?? 0,
          successfulRequests: primary.successfulRequests ?? 0,
          failedRequests: primary.failedRequests ?? 0,
          avgLatencyMs: primary.avgLatencyMs ?? 0,
          errorRate:
            primary.totalRequests && primary.totalRequests > 0
              ? (primary.failedRequests ?? 0) / primary.totalRequests
              : 0,
          modelsAvailable: primary.modelCount ?? 0,
        };
      }
    }
    return {
      providerId: 'unknown',
      status: 'healthy',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatencyMs: 0,
      errorRate: 0,
      modelsAvailable: 0,
    };
  }

  /**
   * Get context observability snapshot
   * Uses session manager data source if available
   */
  getContextSnapshot(): ContextSnapshot {
    const sm = this.dataSources?.sessionManager;
    let activeSessions = 0;
    let totalTokens = 0;

    if (sm) {
      const sessions = sm.listSessions();
      activeSessions = sessions.filter((s) => s.state === 'active').length;
      totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokensUsed ?? 0), 0);
    }

    return {
      activeSessions,
      totalTokensManaged: totalTokens,
      avgTokensPerSession: activeSessions > 0 ? Math.round(totalTokens / activeSessions) : 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      retrievalOperations: 0,
      contextPrunes: 0,
    };
  }

  /**
   * Get learning observability snapshot
   * Uses learning system data source if available
   */
  getLearningSnapshot(): LearningSnapshot {
    const ls = this.dataSources?.learningSystem;
    if (ls) {
      return {
        patternsLearned: ls.getPatternCount(),
        fixesMemorized: ls.getFixCount(),
        experienceEntries: ls.getExperienceCount(),
        learningAccuracy: ls.getAccuracy(),
        lastLearningAt: ls.getLastLearningTime(),
      };
    }
    return {
      patternsLearned: 0,
      fixesMemorized: 0,
      experienceEntries: 0,
      learningAccuracy: 0,
      lastLearningAt: null,
    };
  }

  /**
   * Get runtime health indicators
   * Uses real process metrics (memory, uptime) plus optional orchestration data
   */
  getRuntimeHealth(): RuntimeHealthIndicators {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    const memoryHealth =
      heapUsedMB / heapTotalMB > 0.85
        ? ('critical' as const)
        : heapUsedMB / heapTotalMB > 0.7
          ? ('warning' as const)
          : ('healthy' as const);

    const healthyHeapRatio = heapUsedMB / heapTotalMB < 0.6;

    return {
      overall:
        memoryHealth === 'critical' ? 'unhealthy' : healthyHeapRatio ? 'healthy' : 'degraded',
      memory: memoryHealth,
      cpuLoad: 0,
      uptimeMs: process.uptime() * 1000,
      activeWorkers: this.dataSources?.orchestrationSystem?.getActivePipelineCount() ?? 0,
      errorRate5m: 0,
      lastCheck: timestamp(),
    };
  }

  /**
   * Get recent events (filtered by type and severity)
   */
  getRecentEvents(options?: {
    type?: string;
    severity?: ObservableEvent['severity'];
    limit?: number;
  }): ObservableEvent[] {
    let filtered = this.events;

    if (options?.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }
    if (options?.severity) {
      filtered = filtered.filter((e) => e.severity === options.severity);
    }

    const limit = options?.limit ?? 50;
    return filtered.slice(-limit);
  }

  /**
   * Get recent metrics (filtered by name)
   */
  getRecentMetrics(name?: string, limit: number = 100): ObservableMetric[] {
    if (name) {
      return this.metrics.filter((m) => m.name === name).slice(-limit);
    }
    return this.metrics.slice(-limit);
  }
}
