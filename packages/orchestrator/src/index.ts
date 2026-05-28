/**
 * @autic/orchestrator — Role-based agent orchestration and Neuro Brain foundation.
 *
 * The orchestrator manages deterministic, bounded execution pipelines:
 *   Research → Planning → Architecture → Engineering → Verification → Repair → Final Review
 *
 * Agents are specialized execution coordinators (NOT fake AGI entities).
 * They communicate through structured task contracts.
 * The Orchestrator (Neuro Brain) coordinates pipeline progression and delegates work.
 *
 * All execution is:
 *   - Deterministic and inspectable
 *   - Bounded by depth limits, delegation limits, and timeouts
 *   - Safety-checked via permission integration
 *   - Observable via pipeline events
 */

export { Orchestrator } from './Orchestrator.js';
export type { OrchestratorOptions } from '@autic/shared';

export { PipelineRegistry } from './pipeline/PipelineRegistry.js';
export type { PipelineRegistryOptions } from './pipeline/PipelineRegistry.js';

export { ExecutionGraph } from './pipeline/ExecutionGraph.js';
export type { GraphTransition, GraphOptions } from './pipeline/ExecutionGraph.js';

export type { TaskContract } from '@autic/shared';
export type {
  AgentHandler,
  AgentHandlerResult,
  PipelineCoordinatorOptions,
} from './agents/PipelineCoordinator.js';

export { PipelineCoordinator } from './agents/PipelineCoordinator.js';

export {
  ResearchAgent,
  PlanningAgent,
  ArchitectureAgent,
  EngineeringAgent,
  VerificationAgent,
  RepairAgent,
  FinalReviewAgent,
} from './agents/index.js';

export type { ResearchAgentOptions, PlanningAgentOptions } from './agents/index.js';

export { createDefaultPipeline } from './agents/index.js';

export { OrchestrationObservability, createStageDisplay } from './observability.js';
export type { PipelineDisplayStage } from './observability.js';
