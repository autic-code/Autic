/**
 * ExecutionMemory — Integrates workflow execution with:
 *   - Session system (task tracking, tokens, state)
 *   - Memory system (workspace memory, engineering memory)
 *   - SessionHistory (execution timeline)
 *   - Context optimizer (token-efficient file selection)
 *
 * Persists structured workflow state for resumable execution.
 * All writes are lightweight and non-blocking.
 */

import { timestamp, formatDuration } from '@autic/shared';
import type { WorkflowStep, WorkflowState, WorkflowPlan, CompletedTask } from '@autic/shared';

export interface ExecutionMemoryOptions {
  persistSteps?: boolean;
  maxStoredSteps?: number;
}

interface StoredWorkflowData {
  planId: string;
  goal: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  steps: Array<{
    index: number;
    description: string;
    type: string;
    toolName?: string;
    status: string;
    durationMs?: number;
    error?: string;
  }>;
  totalRetries: number;
}

export class ExecutionMemory {
  private workflows: Map<string, StoredWorkflowData> = new Map();
  private stepRecords: Map<string, WorkflowStep[]> = new Map();
  private options: Required<ExecutionMemoryOptions>;

  constructor(options: ExecutionMemoryOptions = {}) {
    this.options = {
      persistSteps: options.persistSteps ?? true,
      maxStoredSteps: options.maxStoredSteps ?? 200,
    };
  }

  /**
   * Record a completed workflow step for persistence.
   */
  async recordStep(step: WorkflowStep, _index: number): Promise<void> {
    if (!this.options.persistSteps) return;

    const planId = this.getPlanIdForStep(step);
    if (!planId) return;

    const existing = this.stepRecords.get(planId) || [];
    existing.push({
      ...step,
      // Store a clean copy without circular refs
      dependencies: [...step.dependencies],
    });

    // Trim to max stored steps
    if (existing.length > this.options.maxStoredSteps) {
      this.stepRecords.set(planId, existing.slice(-this.options.maxStoredSteps));
    } else {
      this.stepRecords.set(planId, existing);
    }
  }

  /**
   * Get recorded steps for a plan.
   */
  getSteps(planId: string): WorkflowStep[] {
    return this.stepRecords.get(planId) || [];
  }

  /**
   * Store a CompletedTask record matching the workflow memory schema.
   */
  async storeCompletedTask(
    plan: WorkflowPlan,
    state: WorkflowState,
  ): Promise<CompletedTask> {
    const task: CompletedTask = {
      taskId: plan.id,
      type: 'workflow',
      description: plan.goal.slice(0, 200),
      completedAt: timestamp(),
      durationMs: state.completedAt
        ? state.completedAt - state.startedAt
        : timestamp() - state.startedAt,
      steps: state.steps.length,
      result: state.status === 'completed' ? 'success' : 'failure',
    };

    // Store in memory
    const planId = plan.id;
    const stored: StoredWorkflowData = {
      planId,
      goal: plan.goal,
      status: state.status,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      steps: state.steps.map((s, i) => ({
        index: i,
        description: s.description,
        type: s.type,
        toolName: s.toolName,
        status: s.status,
        durationMs: s.durationMs,
        error: s.error,
      })),
      totalRetries: state.totalRetries,
    };

    this.workflows.set(planId, stored);

    return task;
  }

  /**
   * Get a summary of all stored workflows.
   */
  getWorkflowSummary(limit = 10): Array<{
    planId: string;
    goal: string;
    status: string;
    duration: string;
    stepCount: number;
  }> {
    return Array.from(this.workflows.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
      .map((w) => ({
        planId: w.planId,
        goal: w.goal.slice(0, 80),
        status: w.status,
        duration: w.completedAt ? formatDuration(w.completedAt - w.startedAt) : 'in progress',
        stepCount: w.steps.length,
      }));
  }

  /**
   * Get detailed data for a specific workflow.
   */
  getWorkflowData(planId: string): StoredWorkflowData | undefined {
    return this.workflows.get(planId);
  }

  /**
   * Clear all stored workflow data.
   */
  clear(): void {
    this.workflows.clear();
    this.stepRecords.clear();
  }

  /**
   * Get aggregate execution stats.
   */
  getStats(): {
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    totalSteps: number;
    avgDurationMs: number;
  } {
    const workflows = Array.from(this.workflows.values());
    const completed = workflows.filter((w) => w.status === 'completed');
    const failed = workflows.filter((w) => w.status === 'failed');
    const withDuration = workflows.filter((w) => w.completedAt);

    const totalDuration = withDuration.reduce(
      (sum, w) => sum + (w.completedAt ? w.completedAt - w.startedAt : 0),
      0,
    );

    return {
      totalWorkflows: workflows.length,
      completedWorkflows: completed.length,
      failedWorkflows: failed.length,
      totalSteps: workflows.reduce((sum, w) => sum + w.steps.length, 0),
      avgDurationMs: withDuration.length > 0
        ? Math.round(totalDuration / withDuration.length)
        : 0,
    };
  }

  // ---- Private helpers ----

  private getPlanIdForStep(_step: WorkflowStep): string | undefined {
    // Find the plan ID by scanning stored workflows
    for (const [planId, data] of this.workflows) {
      if (data.steps.some((s) => s.description === _step.description)) {
        return planId;
      }
    }
    return undefined;
  }
}
