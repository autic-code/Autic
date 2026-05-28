/**
 * SafetyControls — Runtime safeguards for autonomous workflow execution.
 *
 * Implements bounded execution depth, recursion protection, workflow timeouts,
 * cancellation, and queue protection. Designed to prevent runaway workflows.
 */

import type { SafetyConfig, WorkflowState, WorkflowStep } from '@autic/shared';
import { timestamp } from '@autic/shared';

export interface SafetyContext {
  depth: number;
  consecutiveFailures: number;
  totalActions: number;
  startTime: number;
  paused: boolean;
  cancelled: boolean;
}

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxExecutionDepth: 50,
  maxWorkflowRetries: 5,
  maxStepRetries: 3,
  workflowTimeoutMs: 300_000, // 5 minutes
  stepTimeoutMs: 60_000,      // 1 minute
  allowDangerousActions: false,
  requirePermissionForHighRisk: true,
  maxConsecutiveFailures: 3,
};

export class SafetyControls {
  private config: SafetyConfig;
  private context: SafetyContext;

  constructor(config?: Partial<SafetyConfig>) {
    this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
    this.context = this.createContext();
  }

  /**
   * Update the safety configuration.
   */
  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current safety configuration.
   */
  getConfig(): SafetyConfig {
    return { ...this.config };
  }

  /**
   * Reset the safety context for a new workflow.
   */
  reset(): void {
    this.context = this.createContext();
  }

  /**
   * Get the current safety context snapshot.
   */
  getContext(): SafetyContext {
    return { ...this.context };
  }

  /**
   * Check if an action is safe to execute.
   * Returns an object with allowed flag and reason.
   */
  checkAction(params: {
    step: WorkflowStep;
    workflow: WorkflowState;
    isDangerous?: boolean;
  }): { allowed: boolean; reason?: string } {
    const { step, workflow: _wf, isDangerous } = params;

    // Check cancellation
    if (this.context.cancelled) {
      return { allowed: false, reason: 'Workflow has been cancelled' };
    }

    // Check pause
    if (this.context.paused) {
      return { allowed: false, reason: 'Workflow is paused' };
    }

    // Check workflow timeout
    if (timestamp() - this.context.startTime > this.config.workflowTimeoutMs) {
      return { allowed: false, reason: 'Workflow exceeded maximum duration' };
    }

    // Check execution depth
    if (this.context.depth >= this.config.maxExecutionDepth) {
      return { allowed: false, reason: `Maximum execution depth (${this.config.maxExecutionDepth}) reached` };
    }

    // Check total actions
    if (this.context.totalActions >= this.config.maxExecutionDepth * 2) {
      return { allowed: false, reason: 'Maximum number of actions exceeded' };
    }

    // Check consecutive failures
    if (this.context.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return { allowed: false, reason: `Too many consecutive failures (${this.context.consecutiveFailures})` };
    }

    // Check dangerous actions
    if (isDangerous && !this.config.allowDangerousActions) {
      return {
        allowed: false,
        reason: 'Dangerous actions are not allowed. Set allowDangerousActions=true to enable.',
      };
    }

    // Check step timeout (for long-running steps)
    if (step.durationMs && step.durationMs > this.config.stepTimeoutMs && step.status === 'running') {
      return { allowed: false, reason: `Step exceeded timeout (${this.config.stepTimeoutMs}ms)` };
    }

    return { allowed: true };
  }

  /**
   * Track execution depth. Call before and after each action.
   */
  incrementDepth(): void {
    this.context.depth++;
    this.context.totalActions++;
  }

  decrementDepth(): void {
    this.context.depth = Math.max(0, this.context.depth - 1);
  }

  /**
   * Record a failure for consecutive failure tracking.
   */
  recordFailure(): void {
    this.context.consecutiveFailures++;
  }

  /**
   * Record a success (resets consecutive failure counter).
   */
  recordSuccess(): void {
    this.context.consecutiveFailures = 0;
  }

  /**
   * Pause the workflow.
   */
  pause(): void {
    this.context.paused = true;
  }

  /**
   * Resume the workflow.
   */
  resume(): void {
    this.context.paused = false;
  }

  /**
   * Cancel the workflow.
   */
  cancel(): void {
    this.context.cancelled = true;
  }

  /**
   * Check if the workflow is cancelled.
   */
  isCancelled(): boolean {
    return this.context.cancelled;
  }

  /**
   * Check if the workflow is paused.
   */
  isPaused(): boolean {
    return this.context.paused;
  }

  /**
   * Get remaining time before workflow timeout.
   */
  getRemainingTime(): number {
    const elapsed = timestamp() - this.context.startTime;
    return Math.max(0, this.config.workflowTimeoutMs - elapsed);
  }

  private createContext(): SafetyContext {
    return {
      depth: 0,
      consecutiveFailures: 0,
      totalActions: 0,
      startTime: timestamp(),
      paused: false,
      cancelled: false,
    };
  }
}
