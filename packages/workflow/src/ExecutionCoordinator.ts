/**
 * ExecutionCoordinator — Orchestrates the full autonomous engineering loop.
 *
 * Flow: Analyze → Plan → Execute → Verify → Repair → Complete
 *
 * Connects:
 *   - WorkflowPlanner (task decomposition)
 *   - ToolRegistry (tool execution)
 *   - VerificationEngine (result validation)
 *   - RepairLoop (bounded retry + fix)
 *   - SafetyControls (depth/timeout/cancellation)
 *   - ExecutionMemory (persisted state)
 *
 * All execution is:
 *   - Deterministic and inspectable
 *   - Bounded by retries, depth, and timeouts
 *   - Safety-checked before every action
 *   - Observable via events
 */

import { timestamp } from '@autic/shared';
import type {
  WorkflowStep,
  WorkflowState,
  WorkflowStepStatus,
  ExecutionEvent,
  CoordinationState,
} from '@autic/shared';
import { WorkflowPlanner } from './WorkflowPlanner.js';
import { VerificationEngine } from './VerificationEngine.js';
import { RepairLoop } from './RepairLoop.js';
import { SafetyControls } from './SafetyControls.js';
import type { SafetyContext } from './SafetyControls.js';
import { ExecutionMemory } from './ExecutionMemory.js';
import { Observability } from './Observability.js';
import { EventEmitter } from 'node:events';

export interface CoordinatorOptions {
  maxSteps?: number;
  maxRetries?: number;
  workflowTimeoutMs?: number;
  allowDangerousActions?: boolean;
  persistState?: boolean;
}

export interface CoordinatorSnapshot {
  state: CoordinationState;
  safety: SafetyContext;
  events: ExecutionEvent[];
  memory: {
    stepCount: number;
    repairCount: number;
    totalDurationMs: number;
  };
}

/** Tool execution signature wired externally */
export type ToolExecutor = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class ExecutionCoordinator extends EventEmitter {
  private planner: WorkflowPlanner;
  private verifier: VerificationEngine;
  private repairLoop: RepairLoop;
  private safety: SafetyControls;
  private memory: ExecutionMemory;
  private observability: Observability;

  private workflowState: WorkflowState | null = null;
  private toolExecutor: ToolExecutor | null = null;

  constructor(private options: CoordinatorOptions = {}) {
    super();
    this.planner = new WorkflowPlanner({ maxSteps: options.maxSteps || 20 });
    this.verifier = new VerificationEngine();
    this.repairLoop = new RepairLoop({
      maxRepairAttempts: 3,
      maxTotalRetries: options.maxRetries || 5,
      cooldownMs: 2_000,
    });
    this.safety = new SafetyControls({
      maxExecutionDepth: options.maxSteps || 20,
      maxStepRetries: 3,
      workflowTimeoutMs: options.workflowTimeoutMs || 300_000,
      allowDangerousActions: options.allowDangerousActions || false,
      maxConsecutiveFailures: 3,
    });
    this.memory = new ExecutionMemory();
    this.observability = new Observability();
  }

  getPlanner(): WorkflowPlanner {
    return this.planner;
  }
  getVerifier(): VerificationEngine {
    return this.verifier;
  }
  getRepairLoop(): RepairLoop {
    return this.repairLoop;
  }
  getSafety(): SafetyControls {
    return this.safety;
  }
  getMemory(): ExecutionMemory {
    return this.memory;
  }
  getObservability(): Observability {
    return this.observability;
  }

  /**
   * Set the tool executor — wired externally with real tool implementations.
   */
  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor;
  }

  /**
   * Execute a full autonomous workflow from a goal string.
   *
   * Flow:
   *   1. Plan — decompose goal into ordered steps
   *   2. For each step: safety-check → execute → verify
   *   3. If step fails: classify → repair (bounded retries)
   *   4. If unrecoverable: mark failed, emit event
   *   5. Complete or Fail
   */
  async executeWorkflow(params: {
    sessionId: string;
    goal: string;
    files?: string[];
  }): Promise<WorkflowState> {
    const { sessionId, goal, files } = params;

    // 1. Plan
    this.emitEvent('workflow:planning', { message: `Planning workflow: ${goal.slice(0, 80)}` });
    const plan = await this.planner.scanAndPlan({
      sessionId,
      goal,
      listFiles: async (_p: string) => {
        // Simple fallback — real implementation can be wired externally
        return files || [];
      },
      readFile: async (_p: string) => null,
    });

    // 2. Initialize workflow state
    this.workflowState = {
      planId: plan.id,
      goal: plan.goal,
      status: 'planning',
      currentStepIndex: 0,
      steps: plan.steps.map((s) => ({ ...s, status: 'pending' as WorkflowStepStatus })),
      startedAt: timestamp(),
      totalRetries: 0,
      maxRetries: this.options.maxRetries || 5,
    };

    this.safety.reset();
    this.repairLoop.resetRetries();

    this.emitEvent('workflow:started', {
      message: `Workflow started: ${goal.slice(0, 80)}`,
      planId: plan.id,
      data: { stepCount: plan.steps.length },
    });

    // 3. Execute loop
    for (let i = 0; i < this.workflowState.steps.length; i = this.workflowState.currentStepIndex) {
      const step = this.workflowState.steps[i];
      this.workflowState.currentStepIndex = i;

      // Safety check before each step
      const check = this.safety.checkAction({
        step,
        workflow: this.workflowState,
        isDangerous: step.type === 'tool_call' && step.toolName === 'run_terminal',
      });

      if (!check.allowed) {
        this.workflowState.error = check.reason;
        this.workflowState.status = 'failed';
        this.emitEvent('workflow:failed', {
          message: check.reason || 'Safety check failed',
          stepId: step.id,
        });
        break;
      }

      // Update step status
      step.status = 'running';
      step.startedAt = timestamp();
      this.workflowState.status = 'executing';
      this.safety.incrementDepth();

      this.emitEvent('workflow:step_started', {
        message: `Step ${i + 1}/${this.workflowState.steps.length}: ${step.description}`,
        stepId: step.id,
        data: { stepIndex: i, stepType: step.type },
      });

      try {
        // Execute step based on type
        const result = await this.executeStep(step, i);

        if (result.success) {
          step.status = 'success';
          step.completedAt = timestamp();
          step.durationMs = step.completedAt - step.startedAt;
          this.safety.recordSuccess();

          this.emitEvent('workflow:step_completed', {
            message: `✓ ${step.description}`,
            stepId: step.id,
            data: { durationMs: step.durationMs },
          });

          // Record in execution memory
          await this.memory.recordStep(step, i);
        } else {
          // Step failed — attempt repair
          const repair = await this.repairLoop.attemptRepair({
            failedStep: step,
            workflowState: this.workflowState,
            error: result.error || 'Unknown error',
            exitCode: result.exitCode,
            execute: async (s: WorkflowStep) => {
              return this.executeToolStep(s);
            },
            verify: async (_s: WorkflowStep) => {
              const vResult = await this.verifier.verifyCommandSuccess(
                (step.output as string) || '',
                step.error ? 1 : 0,
                step.durationMs || 0,
              );
              return vResult.passed;
            },
          });

          if (repair.repaired) {
            step.status = 'success';
            step.completedAt = timestamp();
            step.durationMs = step.completedAt - step.startedAt;
            this.workflowState.totalRetries += repair.attempts;

            this.emitEvent('workflow:repairing', {
              message: `Repaired after ${repair.attempts} attempt(s): ${step.description}`,
              stepId: step.id,
              data: { attempts: repair.attempts },
            });
          } else {
            step.status = 'failed';
            step.completedAt = timestamp();
            step.durationMs = step.completedAt - step.startedAt;
            step.error = repair.finalError || result.error;
            this.safety.recordFailure();

            this.emitEvent('workflow:step_failed', {
              message: `✗ ${step.description}: ${(step.error || '').slice(0, 100)}`,
              stepId: step.id,
              data: { error: step.error, category: repair.classification.category },
            });

            // Check if workflow should abort
            if (!repair.classification.retryable) {
              this.workflowState.status = 'failed';
              this.workflowState.error = repair.finalError;
              this.emitEvent('workflow:failed', {
                message: `Unrecoverable failure: ${(repair.finalError || '').slice(0, 100)}`,
                data: { category: repair.classification.category },
              });
              break;
            }
          }
        }
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        step.completedAt = timestamp();
        step.durationMs = step.completedAt - step.startedAt;
        this.safety.recordFailure();

        this.emitEvent('workflow:step_failed', {
          message: `✗ Exception in step: ${(step.error || '').slice(0, 100)}`,
          stepId: step.id,
          data: { error: step.error },
        });

        // Unhandled exception — abort the workflow
        this.workflowState.status = 'failed';
        this.workflowState.error = step.error;
        this.emitEvent('workflow:failed', {
          message: `Unhandled exception: ${(step.error || '').slice(0, 100)}`,
          data: { error: step.error },
        });
        break;
      }

      // Move to next step
      this.workflowState.currentStepIndex++;
    }

    // 4. Final state
    const allSucceeded = this.workflowState.steps.every(
      (s) => s.status === 'success' || s.status === 'skipped',
    );

    if (this.workflowState.status !== 'failed') {
      this.workflowState.status = allSucceeded ? 'completed' : 'failed';
      if (allSucceeded) {
        this.emitEvent('workflow:completed', {
          message: `Workflow completed: ${this.workflowState.goal.slice(0, 60)}`,
          data: {
            totalSteps: this.workflowState.steps.length,
            durationMs: timestamp() - this.workflowState.startedAt,
          },
        });
      }
    }

    this.workflowState.completedAt = timestamp();
    return this.workflowState;
  }

  /**
   * Execute a single step based on its type.
   */
  private async executeStep(
    step: WorkflowStep,
    _stepIndex: number,
  ): Promise<{ success: boolean; error?: string; exitCode?: number }> {
    switch (step.type) {
      case 'analyze':
        // Analysis steps are informational — always succeed
        return { success: true };

      case 'plan':
        // Planning steps are informational
        return { success: true };

      case 'tool_call':
        return this.executeToolStep(step);

      case 'llm_call':
        // LLM call steps require a provider — stubbed for now
        return { success: true };

      case 'verify': {
        // Verification steps run against previous step output
        const prevStep = this.getPreviousStep(step);
        if (!prevStep) return { success: true };
        const vResult = await this.verifier.verifyCommandSuccess(
          (prevStep.output as string) || '',
          prevStep.status === 'success' ? 0 : 1,
          prevStep.durationMs || 0,
        );
        return { success: vResult.passed, error: vResult.summary };
      }

      case 'repair':
        // Repair steps are handled by the repair loop
        return { success: true };

      case 'complete':
        return { success: true };

      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  }

  /**
   * Execute a tool call step via the registered tool executor.
   */
  private async executeToolStep(
    step: WorkflowStep,
  ): Promise<{ success: boolean; error?: string; exitCode?: number }> {
    if (!this.toolExecutor) {
      return { success: false, error: 'No tool executor configured' };
    }

    if (!step.toolName) {
      return { success: false, error: 'Tool step has no toolName' };
    }

    try {
      const result = await this.toolExecutor(step.toolName, step.toolArgs || {});
      step.output = result.data;

      if (result.success) {
        return { success: true };
      }

      // Determine exit code from error message patterns
      const exitCode = result.error?.includes('timeout')
        ? 124
        : result.error?.includes('not found')
          ? 127
          : result.error?.includes('permission')
            ? 126
            : 1;

      return { success: false, error: result.error, exitCode };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Get the step that this step depends on (previous non-skipped step).
   */
  private getPreviousStep(step: WorkflowStep): WorkflowStep | undefined {
    if (!this.workflowState) return undefined;
    const idx = this.workflowState.steps.indexOf(step);
    if (idx <= 0) return undefined;
    return this.workflowState.steps[idx - 1];
  }

  /**
   * Pause the current workflow.
   */
  pause(): void {
    this.safety.pause();
    this.emitEvent('workflow:paused', { message: 'Workflow paused' });
  }

  /**
   * Resume the paused workflow.
   */
  resume(): void {
    this.safety.resume();
    this.emitEvent('workflow:resumed', { message: 'Workflow resumed' });
  }

  /**
   * Cancel the current workflow.
   */
  cancel(): void {
    this.safety.cancel();
    if (this.workflowState) {
      this.workflowState.status = 'cancelled';
      this.workflowState.completedAt = timestamp();
    }
    this.emitEvent('workflow:cancelled', { message: 'Workflow cancelled' });
  }

  /**
   * Get a snapshot of the current coordinator state.
   */
  getSnapshot(): CoordinatorSnapshot | null {
    if (!this.workflowState) return null;

    const state: CoordinationState = {
      workflow: this.workflowState,
      currentStep:
        this.workflowState.currentStepIndex < this.workflowState.steps.length
          ? this.workflowState.steps[this.workflowState.currentStepIndex]
          : null,
      pendingTools: this.workflowState.steps
        .filter((s) => s.status === 'pending' && s.type === 'tool_call')
        .map((s) => s.toolName || 'unknown'),
      completedCount: this.workflowState.steps.filter((s) => s.status === 'success').length,
      failedCount: this.workflowState.steps.filter((s) => s.status === 'failed').length,
      totalDurationMs: this.workflowState.completedAt
        ? this.workflowState.completedAt - this.workflowState.startedAt
        : timestamp() - this.workflowState.startedAt,
      memoryUsage: process.memoryUsage().heapUsed,
    };

    return {
      state,
      safety: this.safety.getContext(),
      events: this.observability.getEvents().slice(-20),
      memory: {
        stepCount: this.workflowState.steps.length,
        repairCount: this.repairLoop.getTotalRetries(),
        totalDurationMs: state.totalDurationMs,
      },
    };
  }

  /**
   * Emit an observability event.
   */
  private emitEvent(
    type: ExecutionEvent['type'],
    data: { message: string; planId?: string; stepId?: string; data?: Record<string, unknown> },
  ): void {
    const event = this.observability.record({
      type: type,
      message: data.message,
      planId: data.planId || this.workflowState?.planId,
      stepId: data.stepId,
      metadata: data.data,
    });
    this.emit('event', event);
  }
}
