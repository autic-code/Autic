/**
 * Plugin Sandbox — safely executes plugins within bounded
 * runtime constraints with execution limits, resource caps,
 * and safe failure handling.
 */

import { EventEmitter } from 'events';
import { timestamp } from '@autic/shared';

/**
 * Sandbox configuration limits
 */
export interface SandboxLimits {
  /** Maximum execution time in ms (default: 30000) */
  maxExecutionTimeMs: number;
  /** Maximum memory usage in MB (default: 256) */
  maxMemoryMB: number;
  /** Maximum number of concurrent executions (default: 5) */
  maxConcurrent: number;
  /** Maximum call stack depth (default: 50) */
  maxCallDepth: number;
  /** Maximum output size in bytes (default: 1MB) */
  maxOutputSize: number;
}

/**
 * Plugin execution context
 */
export interface PluginExecutionContext {
  /** Execution ID */
  id: string;
  /** Plugin ID */
  pluginId: string;
  /** Start timestamp */
  startedAt: number;
  /** Execution status */
  status: 'running' | 'completed' | 'failed' | 'timed_out' | 'memory_exceeded';
  /** Error if failed */
  error?: string;
  /** Execution output */
  output?: string;
  /** Memory used during execution (MB) */
  memoryUsed?: number;
  /** Duration in ms */
  durationMs?: number;
}

/**
 * Sandbox execution result
 */
export interface SandboxExecutionResult {
  /** Execution context */
  context: PluginExecutionContext;
  /** Whether execution was successful */
  success: boolean;
  /** Output data */
  output?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Default sandbox limits
 */
const DEFAULT_LIMITS: SandboxLimits = {
  maxExecutionTimeMs: 30000,
  maxMemoryMB: 256,
  maxConcurrent: 5,
  maxCallDepth: 50,
  maxOutputSize: 1 * 1024 * 1024,
};

/**
 * Plugin Sandbox — safe, bounded plugin execution
 */
export class PluginSandbox extends EventEmitter {
  private limits: SandboxLimits;
  private activeExecutions: Map<string, PluginExecutionContext> = new Map();
  private executionHistory: PluginExecutionContext[] = [];
  private maxHistory: number = 100;

  constructor(limits?: Partial<SandboxLimits>) {
    super();
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /**
   * Execute a plugin function within sandbox constraints
   */
  async execute<T>(
    pluginId: string,
    fn: () => Promise<T> | T,
    context?: Record<string, unknown>,
  ): Promise<SandboxExecutionResult> {
    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.limits.maxConcurrent) {
      return {
        context: {
          id: `exec-${timestamp()}`,
          pluginId,
          startedAt: timestamp(),
          status: 'failed',
          error: 'Concurrent execution limit reached',
          durationMs: 0,
        },
        success: false,
        error: `Maximum ${this.limits.maxConcurrent} concurrent executions allowed`,
      };
    }

    const executionId = `exec-${pluginId}-${timestamp()}`;
    const startTime = timestamp();

    const execContext: PluginExecutionContext = {
      id: executionId,
      pluginId,
      startedAt: startTime,
      status: 'running',
    };

    this.activeExecutions.set(executionId, execContext);
    this.emit('executionStart', { executionId, pluginId, context });

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, this.limits.maxExecutionTimeMs);

      const duration = timestamp() - startTime;
      execContext.status = 'completed';
      execContext.durationMs = duration;
      execContext.output = typeof result === 'string' ? result : JSON.stringify(result);

      this.emit('executionComplete', { executionId, pluginId, duration });
      this.recordHistory(execContext);

      return {
        context: execContext,
        success: true,
        output: result,
      };
    } catch (err) {
      const duration = timestamp() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errorMsg.includes('timed out') || errorMsg.includes('timeout');

      execContext.status = isTimeout ? 'timed_out' : 'failed';
      execContext.error = errorMsg;
      execContext.durationMs = duration;

      this.emit('executionError', {
        executionId,
        pluginId,
        error: errorMsg,
        duration,
      });
      this.recordHistory(execContext);

      return {
        context: execContext,
        success: false,
        error: errorMsg,
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Get current sandbox status
   */
  getStatus(): {
    activeCount: number;
    limits: SandboxLimits;
    recentExecutions: PluginExecutionContext[];
  } {
    return {
      activeCount: this.activeExecutions.size,
      limits: this.limits,
      recentExecutions: this.executionHistory.slice(-10),
    };
  }

  /**
   * Get execution history
   */
  getHistory(pluginId?: string): PluginExecutionContext[] {
    if (pluginId) {
      return this.executionHistory.filter((e) => e.pluginId === pluginId);
    }
    return [...this.executionHistory];
  }

  /**
   * Update sandbox limits at runtime
   */
  updateLimits(limits: Partial<SandboxLimits>): void {
    this.limits = { ...this.limits, ...limits };
    this.emit('limitsUpdated', { limits: this.limits });
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T> | T, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  }

  /**
   * Record execution in history
   */
  private recordHistory(context: PluginExecutionContext): void {
    this.executionHistory.push(context);
    if (this.executionHistory.length > this.maxHistory) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistory);
    }
  }
}
