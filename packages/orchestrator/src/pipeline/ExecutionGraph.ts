/**
 * ExecutionGraph — Deterministic pipeline state tracking and transitions.
 *
 * Tracks:
 *   - Current pipeline stage
 *   - Completed stages
 *   - Failed stages
 *   - Stage transitions (forward, retry, failure routing)
 *   - Delegation counts
 *   - Cancellation support
 *
 * The graph is NOT a complex DAG. It's a linear stage sequencer with
 * deterministic transition rules and bounded retry support.
 */

import { timestamp } from '@autic/shared';
import type { OrchestrationStage, OrchestrationStatus, PipelineState } from '@autic/shared';
import type { PipelineRegistry } from './PipelineRegistry.js';

export interface GraphTransition {
  from: OrchestrationStage;
  to: OrchestrationStage;
  reason: string;
  timestamp: number;
}

export interface GraphOptions {
  maxDelegations?: number;
}

interface StageRecord {
  stage: OrchestrationStage;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  error?: string;
  retries: number;
  maxRetries: number;
}

export class ExecutionGraph {
  private pipelineId: string = '';
  private goal: string = '';
  private stages: StageRecord[] = [];
  private transitions: GraphTransition[] = [];
  private status: OrchestrationStatus = 'idle';
  private currentStageIndex: number = -1;
  private startTime: number = 0;
  private maxDelegations: number;
  private completedStages: Set<OrchestrationStage> = new Set();
  private failedStages: Set<OrchestrationStage> = new Set();
  private registry: PipelineRegistry;

  constructor(registry: PipelineRegistry, options: GraphOptions = {}) {
    this.registry = registry;
    this.maxDelegations = options.maxDelegations || 50;
  }

  /**
   * Initialize the execution graph with a pipeline and goal.
   */
  initialize(pipelineId: string, goal: string): void {
    const pipeline = this.registry.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    this.pipelineId = pipelineId;
    this.goal = goal;
    this.status = 'idle';
    this.currentStageIndex = -1;
    this.startTime = timestamp();
    this.transitions = [];
    this.completedStages.clear();
    this.failedStages.clear();

    this.stages = pipeline.stages.map((stage) => ({
      stage,
      startedAt: 0,
      status: 'running' as const,
      retries: 0,
      maxRetries: 2,
    }));
  }

  /**
   * Start the pipeline — moves to the first stage.
   */
  start(): OrchestrationStage | null {
    if (this.stages.length === 0) return null;

    this.status = 'running';
    this.currentStageIndex = 0;
    const first = this.stages[0];
    first.startedAt = timestamp();
    first.status = 'running';

    return first.stage;
  }

  /**
   * Mark the current stage as completed and advance.
   * Returns the next stage, or null if the pipeline is complete.
   */
  completeStage(): OrchestrationStage | null {
    const current = this.getCurrentRecord();
    if (!current) return null;

    current.status = 'completed';
    current.completedAt = timestamp();
    this.completedStages.add(current.stage);

    this.transitions.push({
      from: current.stage,
      to: this.getNextStage() || 'completed',
      reason: 'completed',
      timestamp: timestamp(),
    });

    return this.advance();
  }

  /**
   * Mark the current stage as failed.
   * If retries remain, retry. Otherwise advance or fail the pipeline.
   * Returns the stage to execute next, or null if pipeline is failed.
   */
  failStage(error: string): OrchestrationStage | null {
    const current = this.getCurrentRecord();
    if (!current) return null;

    current.error = error;
    current.retries++;

    if (current.retries <= current.maxRetries) {
      // Retry the same stage
      current.status = 'running';
      current.startedAt = timestamp();

      this.transitions.push({
        from: current.stage,
        to: current.stage, // retry same stage
        reason: `retry ${current.retries}/${current.maxRetries}`,
        timestamp: timestamp(),
      });

      return current.stage;
    }

    // Max retries exceeded
    current.status = 'failed';
    current.completedAt = timestamp();
    this.failedStages.add(current.stage);

    this.transitions.push({
      from: current.stage,
      to: this.getNextStage() || 'failed' as OrchestrationStage,
      reason: `failed: ${error.slice(0, 80)}`,
      timestamp: timestamp(),
    });

    return this.advance();
  }

  /**
   * Skip the current stage and advance.
   */
  skipStage(): OrchestrationStage | null {
    const current = this.getCurrentRecord();
    if (!current) return null;

    current.status = 'skipped';
    current.completedAt = timestamp();

    this.transitions.push({
      from: current.stage,
      to: this.getNextStage() || 'completed',
      reason: 'skipped',
      timestamp: timestamp(),
    });

    return this.advance();
  }

  /**
   * Advance to the next stage.
   */
  private advance(): OrchestrationStage | null {
    this.currentStageIndex++;

    if (this.currentStageIndex >= this.stages.length) {
      this.status = 'completed';
      return null;
    }

    const next = this.stages[this.currentStageIndex];
    next.startedAt = timestamp();
    next.status = 'running';

    this.transitions.push({
      from: this.currentStageIndex > 0
        ? this.stages[this.currentStageIndex - 1].stage
        : 'research',
      to: next.stage,
      reason: 'advance',
      timestamp: timestamp(),
    });

    return next.stage;
  }

  /**
   * Cancel the pipeline execution.
   */
  cancel(): void {
    this.status = 'cancelled';
    const current = this.getCurrentRecord();
    if (current) {
      current.status = 'failed';
      current.completedAt = timestamp();
      current.error = 'Pipeline cancelled';
    }
  }

  /**
   * Pause the pipeline.
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  /**
   * Resume the pipeline.
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
    }
  }

  /**
   * Get the current stage.
   */
  getCurrentStage(): OrchestrationStage | null {
    const record = this.getCurrentRecord();
    return record?.stage || null;
  }

  /**
   * Get the next stage in the pipeline.
   */
  getNextStage(): OrchestrationStage | null {
    if (this.currentStageIndex < 0) {
      return this.stages[0]?.stage || null;
    }

    const nextIdx = this.currentStageIndex + 1;
    if (nextIdx >= this.stages.length) return null;

    return this.stages[nextIdx].stage;
  }

  /**
   * Check delegations remaining.
   */
  canDelegate(): boolean {
    return this.transitions.length < this.maxDelegations;
  }

  /**
   * Get the number of delegations used.
   */
  getDelegationCount(): number {
    return this.transitions.length;
  }

  /**
   * Get the current pipeline status.
   */
  getStatus(): OrchestrationStatus {
    return this.status;
  }

  /**
   * Get the current pipeline stage record.
   */
  private getCurrentRecord(): StageRecord | undefined {
    if (this.currentStageIndex < 0 || this.currentStageIndex >= this.stages.length) {
      return undefined;
    }
    return this.stages[this.currentStageIndex];
  }

  /**
   * Build a PipelineState snapshot.
   */
  getState(): PipelineState {
    return {
      pipelineId: this.pipelineId,
      goal: this.goal,
      currentStage: this.getCurrentStage() || 'research',
      status: this.status,
      stagesCompleted: Array.from(this.completedStages),
      stagesFailed: Array.from(this.failedStages),
      startedAt: this.startTime,
      completedAt: this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled'
        ? timestamp()
        : undefined,
      error: this.getCurrentRecord()?.error,
      delegations: this.transitions.length,
      contractHistory: [],
    };
  }

  /**
   * Get all transitions for observability.
   */
  getTransitions(): GraphTransition[] {
    return [...this.transitions];
  }

  /**
   * Get stage performance metrics.
   */
  getStageMetrics(): Array<{
    stage: OrchestrationStage;
    status: string;
    durationMs?: number;
    retries: number;
  }> {
    return this.stages.map((s) => ({
      stage: s.stage,
      status: s.status,
      durationMs: s.completedAt ? s.completedAt - s.startedAt : undefined,
      retries: s.retries,
    }));
  }

  /**
   * Reset the graph for a new execution.
   */
  reset(): void {
    this.pipelineId = '';
    this.goal = '';
    this.stages = [];
    this.transitions = [];
    this.status = 'idle';
    this.currentStageIndex = -1;
    this.startTime = 0;
    this.completedStages.clear();
    this.failedStages.clear();
  }
}
