/**
 * Orchestrator — Neuro Brain: centralized orchestration runtime.
 *
 * The Orchestrator is the central coordination layer for the pipeline system.
 * It is NOT a fake AGI reasoning system — it's a deterministic runtime that:
 *
 *   - Selects the appropriate pipeline for a given goal
 *   - Coordinates agents through pipeline stages
 *   - Manages bounded delegation and execution sequencing
 *   - Emits observability events
 *   - Enforces safety controls
 *   - Provides cancellation, pause, and resume
 *
 * Architecture:
 *   Orchestrator (Neuro Brain)
 *     ├── PipelineRegistry (pipeline selection)
 *     ├── ExecutionGraph (state tracking)
 *     ├── PipelineCoordinator (agent routing)
 *     ├── 7 Specialized Agents (bounded execution)
 *     └── Observability (events + display)
 */

import { timestamp } from '@autic/shared';
import type {
  OrchestrationStage,
  PipelineDefinition,
  PipelineState,
  OrchestratorOptions as OrchestratorConfig,
  OrchestrationEvent,
  OrchestrationEventType,
} from '@autic/shared';
import { PipelineRegistry } from './pipeline/PipelineRegistry.js';
import { PipelineCoordinator } from './agents/PipelineCoordinator.js';
import {
  ResearchAgent,
  PlanningAgent,
  ArchitectureAgent,
  EngineeringAgent,
  VerificationAgent,
  RepairAgent,
  FinalReviewAgent,
} from './agents/index.js';
import { OrchestrationObservability } from './observability.js';

type ToolRunner = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class Orchestrator {
  private pipelineRegistry: PipelineRegistry;
  private coordinator: PipelineCoordinator;
  private observability: OrchestrationObservability;

  // Agent instances
  private researchAgent: ResearchAgent;
  private planningAgent: PlanningAgent;
  private architectureAgent: ArchitectureAgent;
  private engineeringAgent: EngineeringAgent;
  private verificationAgent: VerificationAgent;
  private repairAgent: RepairAgent;
  private finalReviewAgent: FinalReviewAgent;

  private options: Required<OrchestratorConfig>;
  private currentPipeline: PipelineDefinition | null = null;

  /** Event callbacks */
  private eventListeners: Array<(event: OrchestrationEvent) => void> = [];

  constructor(options: OrchestratorConfig = {}) {
    this.options = {
      maxDelegations: options.maxDelegations ?? 50,
      defaultPipelineId: options.defaultPipelineId ?? 'full-development',
      safetyProfile: options.safetyProfile ?? 'balanced',
      stageTimeoutMs: options.stageTimeoutMs ?? 300_000,
      pipelineTimeoutMs: options.pipelineTimeoutMs ?? 600_000,
      persistState: options.persistState ?? false,
    };

    this.pipelineRegistry = new PipelineRegistry({ maxPipelines: 20 });
    this.observability = new OrchestrationObservability();

    // Create agents
    this.researchAgent = new ResearchAgent({ timeoutMs: 60_000 });
    this.planningAgent = new PlanningAgent({ maxTasks: 15, timeoutMs: 30_000 });
    this.architectureAgent = new ArchitectureAgent();
    // Registries are lazily set — defaults are used until explicitly provided
    this.engineeringAgent = new EngineeringAgent();
    this.verificationAgent = new VerificationAgent();
    this.repairAgent = new RepairAgent(3);
    this.finalReviewAgent = new FinalReviewAgent();

    // Create coordinator with agents
    this.coordinator = new PipelineCoordinator(this.pipelineRegistry, {
      maxStages: 20,
      stageTimeoutMs: this.options.stageTimeoutMs,
    });

    this.coordinator.setAgents({
      research: this.researchAgent,
      planning: this.planningAgent,
      architecture: this.architectureAgent,
      engineering: this.engineeringAgent,
      verification: this.verificationAgent,
      repair: this.repairAgent,
      finalReview: this.finalReviewAgent,
    });
  }

  /**
   * Set skill and agent registries for the engineering agent.
   */
  setSkillRegistry(skillRegistry: import('@autic/skills').SkillRegistry): void {
    // Re-create engineering agent with proper registries
    this.engineeringAgent = new EngineeringAgent(skillRegistry);
    // The tool executor is set on execute
  }

  /**
   * Execute a full orchestrated pipeline.
   */
  async orchestrate(params: { goal: string; pipelineId?: string; runTool: ToolRunner }): Promise<{
    state: PipelineState;
    results: Array<{
      stage: OrchestrationStage;
      success: boolean;
      durationMs: number;
      error?: string;
    }>;
  }> {
    const { goal, runTool } = params;

    // 1. Select pipeline
    const pipeline = params.pipelineId
      ? this.pipelineRegistry.get(params.pipelineId) ||
        this.pipelineRegistry.selectForGoal(goal, this.options)
      : this.pipelineRegistry.selectForGoal(goal, this.options);

    this.currentPipeline = pipeline;

    this.emitEvent('pipeline:started', {
      message: `Pipeline started: ${pipeline.name}`,
      data: { pipelineId: pipeline.id, stages: pipeline.stages.length },
    });

    // 2. Wire tool executor into engineering agent
    this.engineeringAgent.setToolExecutor(runTool);

    // 3. Execute pipeline
    const { state, results } = await this.coordinator.execute(goal, pipeline.id, runTool);

    // 4. Emit completion event
    if (state.status === 'completed') {
      this.emitEvent('pipeline:completed', {
        message: `Pipeline completed: ${goal.slice(0, 60)}`,
        data: {
          stagesCompleted: state.stagesCompleted.length,
          durationMs: state.completedAt ? state.completedAt - state.startedAt : 0,
        },
      });
    } else if (state.status === 'failed') {
      this.emitEvent('pipeline:failed', {
        message: `Pipeline failed: ${state.error?.slice(0, 80) || 'Unknown error'}`,
        error: state.error,
      });
    } else if (state.status === 'cancelled') {
      this.emitEvent('pipeline:cancelled', {
        message: 'Pipeline cancelled',
      });
    }

    return {
      state,
      results: results.map((r) => ({
        stage: r.stage,
        success: r.success,
        durationMs: r.durationMs,
        error: r.error,
      })),
    };
  }

  /**
   * Execute a single pipeline stage (for manual/step-by-step mode).
   */
  async executeStage(params: {
    stage: OrchestrationStage;
    goal: string;
    runTool: ToolRunner;
  }): Promise<{ success: boolean; error?: string }> {
    const { stage, goal, runTool } = params;

    this.emitEvent('pipeline:stage_started', {
      message: `Stage started: ${stage}`,
      data: { stage },
    });

    // Route to the appropriate agent
    let result: { success: boolean; error?: string };

    switch (stage) {
      case 'research': {
        const contract = await this.researchAgent.execute(goal, runTool);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      case 'planning': {
        const contract = await this.planningAgent.execute(goal, runTool);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      case 'architecture': {
        const contract = await this.architectureAgent.execute(goal, runTool);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      case 'engineering': {
        this.engineeringAgent.setToolExecutor(runTool);
        const contract = await this.engineeringAgent.execute(goal, runTool);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      case 'verification': {
        const contract = await this.verificationAgent.execute(goal, runTool);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      case 'repair': {
        const contract = await this.repairAgent.execute(goal, runTool);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      case 'final_review': {
        const state = this.coordinator.getState();
        const contract = await this.finalReviewAgent.execute(goal, runTool, undefined, state);
        result = { success: contract.status === 'fulfilled', error: contract.error };
        break;
      }
      default:
        result = { success: false, error: `Unknown stage: ${stage}` };
    }

    if (result.success) {
      this.emitEvent('pipeline:stage_completed', {
        message: `Stage completed: ${stage}`,
        data: { stage },
      });
    } else {
      this.emitEvent('pipeline:stage_failed', {
        message: `Stage failed: ${stage}: ${result.error || ''}`,
        data: { stage },
        error: result.error,
      });
    }

    return result;
  }

  /**
   * Cancel the current pipeline.
   */
  cancel(): void {
    this.coordinator.cancel();
    this.emitEvent('pipeline:cancelled', { message: 'Pipeline cancelled by user' });
  }

  /**
   * Pause the current pipeline.
   */
  pause(): void {
    this.coordinator.pause();
    this.emitEvent('pipeline:paused', { message: 'Pipeline paused' });
  }

  /**
   * Resume the current pipeline.
   */
  resume(): void {
    this.coordinator.resume();
    this.emitEvent('pipeline:resumed', { message: 'Pipeline resumed' });
  }

  /**
   * Register an event listener.
   */
  onEvent(callback: (event: OrchestrationEvent) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * Emit an event to all listeners and the observability system.
   */
  private emitEvent(
    type: OrchestrationEventType,
    data: {
      message: string;
      stage?: OrchestrationStage;
      agentId?: string;
      error?: string;
      data?: Record<string, unknown>;
    },
  ): void {
    const event: OrchestrationEvent = {
      type,
      timestamp: timestamp(),
      pipelineId: this.currentPipeline?.id || '',
      stage: data.stage || (this.coordinator.getState().currentStage as OrchestrationStage),
      message: data.message,
      agentId: data.agentId,
      error: data.error,
      data: data.data,
    };

    this.observability.record(event);

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Silently handle listener errors
      }
    }
  }

  /**
   * Get the observability system.
   */
  getObservability(): OrchestrationObservability {
    return this.observability;
  }

  /**
   * Get the pipeline registry.
   */
  getPipelineRegistry(): PipelineRegistry {
    return this.pipelineRegistry;
  }

  /**
   * Get the coordinator.
   */
  getCoordinator(): PipelineCoordinator {
    return this.coordinator;
  }

  /**
   * Get current pipeline definition.
   */
  getCurrentPipeline(): PipelineDefinition | null {
    return this.currentPipeline;
  }

  /**
   * Get the executor options.
   */
  getOptions(): Required<OrchestratorConfig> {
    return { ...this.options };
  }

  /**
   * Reset the orchestrator state.
   */
  reset(): void {
    this.coordinator.reset();
    this.currentPipeline = null;
  }
}
