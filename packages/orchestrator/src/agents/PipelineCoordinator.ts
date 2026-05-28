/**
 * PipelineCoordinator — Coordinates agents through the full R&D pipeline.
 *
 * Orchestrates:
 *   Research → Planning → Architecture → Engineering → Verification → Repair → FinalReview
 *
 * Each stage is executed by a bounded agent that wraps existing systems.
 * Communication between agents happens via structured TaskContracts — not free-form chat.
 *
 * The coordinator:
 *   - Routes execution to the correct agent for each stage
 *   - Passes contracts between agents as I/O
 *   - Enforces stage ordering
 *   - Collects results for the final summary
 */

import { generateId, timestamp } from '@autic/shared';
import type {
  OrchestrationStage,
  OrchestrationStatus,
  PipelineState,
  TaskContract,
} from '@autic/shared';
import { ExecutionGraph } from '../pipeline/ExecutionGraph.js';
import { PipelineRegistry } from '../pipeline/PipelineRegistry.js';
import type { ResearchAgent } from './ResearchAgent.js';
import type { PlanningAgent } from './PlanningAgent.js';
import type { ArchitectureAgent } from './ArchitectureAgent.js';
import type { EngineeringAgent } from './EngineeringAgent.js';
import type { VerificationAgent } from './VerificationAgent.js';
import type { RepairAgent } from './RepairAgent.js';
import type { FinalReviewAgent } from './FinalReviewAgent.js';

export type AgentHandlerResult = Promise<{ success: boolean; error?: string }>;

export interface AgentHandler {
  (contract: TaskContract): AgentHandlerResult;
}

export interface PipelineCoordinatorOptions {
  maxStages?: number;
  stageTimeoutMs?: number;
}

interface StageResult {
  stage: OrchestrationStage;
  contract: TaskContract;
  success: boolean;
  durationMs: number;
  error?: string;
}

export class PipelineCoordinator {
  private graph: ExecutionGraph;
  private contractHistory: TaskContract[] = [];
  private stageResults: StageResult[] = [];
  private status: OrchestrationStatus = 'idle';

  // Agent references
  private researchAgent?: ResearchAgent;
  private planningAgent?: PlanningAgent;
  private architectureAgent?: ArchitectureAgent;
  private engineeringAgent?: EngineeringAgent;
  private verificationAgent?: VerificationAgent;
  private repairAgent?: RepairAgent;
  private finalReviewAgent?: FinalReviewAgent;

  constructor(registry: PipelineRegistry, options: PipelineCoordinatorOptions = {}) {
    this.graph = new ExecutionGraph(registry, {
      maxDelegations: options.maxStages ? options.maxStages * 3 : 50,
    });
  }

  /**
   * Set all agent references.
   */
  setAgents(agents: {
    research?: ResearchAgent;
    planning?: PlanningAgent;
    architecture?: ArchitectureAgent;
    engineering?: EngineeringAgent;
    verification?: VerificationAgent;
    repair?: RepairAgent;
    finalReview?: FinalReviewAgent;
  }): void {
    this.researchAgent = agents.research;
    this.planningAgent = agents.planning;
    this.architectureAgent = agents.architecture;
    this.engineeringAgent = agents.engineering;
    this.verificationAgent = agents.verification;
    this.repairAgent = agents.repair;
    this.finalReviewAgent = agents.finalReview;
  }

  /**
   * Execute the full pipeline.
   * Returns the final PipelineState with all stage results.
   */
  async execute(
    goal: string,
    pipelineId: string,
    runTool: (
      toolName: string,
      args: Record<string, unknown>,
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>,
  ): Promise<{ state: PipelineState; results: StageResult[] }> {
    this.status = 'running';
    this.contractHistory = [];
    this.stageResults = [];

    // Initialize the execution graph
    this.graph.initialize(pipelineId, goal);
    const firstStage = this.graph.start();

    if (!firstStage) {
      this.status = 'failed';
      return {
        state: this.graph.getState(),
        results: [],
      };
    }

    // Execute each stage in order through the graph
    let currentStageOrNull: OrchestrationStage | null = firstStage;

    while (currentStageOrNull !== null && this.status === 'running') {
      const stage: OrchestrationStage = currentStageOrNull;
      const startTime = Date.now();

      try {
        const result = await this.executeStage(stage, goal, runTool);
        const durationMs = Date.now() - startTime;

        this.stageResults.push({
          stage,
          contract: result.contract,
          success: result.success,
          durationMs,
          error: result.error,
        });

        this.contractHistory.push(result.contract);

        if (result.success) {
          currentStageOrNull = this.graph.completeStage();
        } else {
          currentStageOrNull = this.graph.failStage(result.error || 'Stage failed');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const durationMs = Date.now() - startTime;

        this.stageResults.push({
          stage,
          contract: {
            id: generateId(),
            source: stage,
            target: stage,
            type: 'pipeline_result',
            input: {},
            status: 'rejected',
            startedAt: startTime,
            completedAt: timestamp(),
            error: errorMsg,
          },
          success: false,
          durationMs,
          error: errorMsg,
        });

        currentStageOrNull = this.graph.failStage(errorMsg);
      }

      // Check delegation limit
      if (!this.graph.canDelegate()) {
        this.graph.cancel();
        this.status = 'cancelled';
        break;
      }

      // If graph indicates completion or failure, stop
      const gs = this.graph.getStatus();
      if (gs === 'completed' || gs === 'failed' || gs === 'cancelled') {
        break;
      }
    }

    this.status = this.graph.getStatus();

    return {
      state: this.graph.getState(),
      results: this.stageResults,
    };
  }

  /**
   * Execute a single pipeline stage via the appropriate agent.
   */
  private async executeStage(
    stage: OrchestrationStage,
    goal: string,
    runTool: (
      toolName: string,
      args: Record<string, unknown>,
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>,
  ): Promise<{ contract: TaskContract; success: boolean; error?: string }> {
    // Get the most recent contract as input context
    const previousContract =
      this.contractHistory.length > 0
        ? this.contractHistory[this.contractHistory.length - 1]
        : undefined;

    let contract: TaskContract;

    switch (stage) {
      case 'research': {
        if (!this.researchAgent) {
          return {
            contract: this.createErrorContract(stage, 'ResearchAgent not configured'),
            success: false,
            error: 'ResearchAgent not configured',
          };
        }
        contract = await this.researchAgent.execute(goal, runTool, previousContract);
        break;
      }

      case 'planning': {
        if (!this.planningAgent) {
          return {
            contract: this.createErrorContract(stage, 'PlanningAgent not configured'),
            success: false,
            error: 'PlanningAgent not configured',
          };
        }
        contract = await this.planningAgent.execute(goal, runTool, previousContract);
        break;
      }

      case 'architecture': {
        if (!this.architectureAgent) {
          return {
            contract: this.createErrorContract(stage, 'ArchitectureAgent not configured'),
            success: false,
            error: 'ArchitectureAgent not configured',
          };
        }
        contract = await this.architectureAgent.execute(goal, runTool, previousContract);
        break;
      }

      case 'engineering': {
        if (!this.engineeringAgent) {
          return {
            contract: this.createErrorContract(stage, 'EngineeringAgent not configured'),
            success: false,
            error: 'EngineeringAgent not configured',
          };
        }
        contract = await this.engineeringAgent.execute(goal, runTool, previousContract);
        break;
      }

      case 'verification': {
        if (!this.verificationAgent) {
          return {
            contract: this.createErrorContract(stage, 'VerificationAgent not configured'),
            success: false,
            error: 'VerificationAgent not configured',
          };
        }
        contract = await this.verificationAgent.execute(goal, runTool, previousContract);
        break;
      }

      case 'repair': {
        if (!this.repairAgent) {
          return {
            contract: this.createErrorContract(stage, 'RepairAgent not configured'),
            success: false,
            error: 'RepairAgent not configured',
          };
        }
        contract = await this.repairAgent.execute(goal, runTool, previousContract);
        break;
      }

      case 'final_review': {
        if (!this.finalReviewAgent) {
          return {
            contract: this.createErrorContract(stage, 'FinalReviewAgent not configured'),
            success: false,
            error: 'FinalReviewAgent not configured',
          };
        }
        const pipelineState = this.graph.getState();
        contract = await this.finalReviewAgent.execute(
          goal,
          runTool,
          previousContract,
          pipelineState,
        );
        break;
      }

      default:
        return {
          contract: this.createErrorContract(stage, `Unknown stage: ${stage}`),
          success: false,
          error: `Unknown stage: ${stage}`,
        };
    }

    return {
      contract,
      success: contract.status === 'fulfilled',
      error: contract.error,
    };
  }

  /**
   * Create an error contract for failed stages.
   */
  private createErrorContract(stage: OrchestrationStage, error: string): TaskContract {
    return {
      id: generateId(),
      source: stage,
      target: stage,
      type: 'pipeline_result',
      input: {},
      status: 'rejected',
      startedAt: timestamp(),
      completedAt: timestamp(),
      error,
    };
  }

  /**
   * Get the pipeline state.
   */
  getState(): PipelineState {
    return this.graph.getState();
  }

  /**
   * Get all stage results.
   */
  getResults(): StageResult[] {
    return [...this.stageResults];
  }

  /**
   * Get contract history.
   */
  getContracts(): TaskContract[] {
    return [...this.contractHistory];
  }

  /**
   * Get the execution status.
   */
  getStatus(): OrchestrationStatus {
    return this.status;
  }

  /**
   * Cancel the pipeline.
   */
  cancel(): void {
    this.status = 'cancelled';
    this.graph.cancel();
  }

  /**
   * Pause the pipeline.
   */
  pause(): void {
    this.status = 'paused';
    this.graph.pause();
  }

  /**
   * Resume the pipeline.
   */
  resume(): void {
    this.status = 'running';
    this.graph.resume();
  }

  /**
   * Reset for a new execution.
   */
  reset(): void {
    this.graph.reset();
    this.contractHistory = [];
    this.stageResults = [];
    this.status = 'idle';
  }
}
