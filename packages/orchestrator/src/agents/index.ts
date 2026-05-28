/**
 * Specialized agents barrel.
 *
 * Each agent is a bounded execution coordinator — NOT a fake AGI entity.
 * Agents wrap existing systems (tools, workflow, skills) with role-specific
 * permission scoping and structured contract I/O.
 *
 * Agent roles:
 *   - Research:  Read-only repo analysis
 *   - Planning:  Task decomposition and execution sequencing
 *   - Architecture: Modularity and dependency boundary validation
 *   - Engineering: Code implementation with scoped write access
 *   - Verification: Build, test, lint validation
 *   - Repair: Failure analysis and bounded retry
 *   - FinalReview: Final validation gate
 */

export { ResearchAgent } from './ResearchAgent.js';
export type { ResearchAgentOptions } from './ResearchAgent.js';

export { PlanningAgent } from './PlanningAgent.js';
export type { PlanningAgentOptions } from './PlanningAgent.js';

export { ArchitectureAgent } from './ArchitectureAgent.js';

export { EngineeringAgent } from './EngineeringAgent.js';

export { VerificationAgent } from './VerificationAgent.js';

export { RepairAgent } from './RepairAgent.js';

export { FinalReviewAgent } from './FinalReviewAgent.js';

export { PipelineCoordinator } from './PipelineCoordinator.js';
export type { PipelineCoordinatorOptions, AgentHandler, AgentHandlerResult } from './PipelineCoordinator.js';

import type { PipelineDefinition, OrchestrationStage } from '@autic/shared';

/**
 * Create a default pipeline with all 7 stages.
 */
export function createDefaultPipeline(): PipelineDefinition {
  return {
    id: 'full-development',
    name: 'Full Development Pipeline',
    description: 'Research → Plan → Architecture → Engineering → Verification → Repair → Final Review',
    stages: ['research', 'planning', 'architecture', 'engineering', 'verification', 'repair', 'final_review'] as OrchestrationStage[],
    timeoutMs: 600_000,
    maxDelegations: 50,
    safetyProfile: 'balanced' as const,
  };
}
