/**
 * @autic/swarm — Controlled swarm orchestration + advanced execution coordination.
 *
 * Bounded, deterministic multi-agent coordination for:
 *   - Swarm orchestration with safety controls
 *   - Safe agent delegation with depth limits
 *   - Bounded parallel execution
 *   - Execution load balancing
 *   - Recursion and chaos prevention
 *   - Role-based pipeline templates
 *   - Execution partitioning for isolation
 *   - Shared coordination memory
 *   - Concurrency-aware provider routing
 *   - Swarm observability
 *   - Failed delegation recovery
 *   - Resource protection (CPU, memory, provider)
 *   - Long-workflow stability controls
 */

export { SwarmOrchestrator } from './SwarmOrchestrator.js';
export type { SwarmOrchestratorOptions, SwarmAgent } from './SwarmOrchestrator.js';

export { AgentDelegation } from './AgentDelegation.js';

export { ParallelExecutionSystem } from './ParallelExecutionSystem.js';
export type { ParallelJob } from './ParallelExecutionSystem.js';

export { ExecutionLoadBalancer } from './ExecutionLoadBalancer.js';
export type { LoadBalancerOptions } from './ExecutionLoadBalancer.js';

export { SwarmSafetySystem } from './SwarmSafetySystem.js';

export { RoleBasedPipelines } from './RoleBasedPipelines.js';
export type { PipelineTemplateId } from './RoleBasedPipelines.js';

export { ExecutionPartitioning } from './ExecutionPartitioning.js';
export type { PartitionConfig } from './ExecutionPartitioning.js';

export { SharedOrchestrationMemory } from './SharedOrchestrationMemory.js';
export type { MemoryScope, MemoryWriteOptions } from './SharedOrchestrationMemory.js';

export { ConcurrencyProviderRouter } from './ConcurrencyProviderRouter.js';
export type { ProviderInfo } from './ConcurrencyProviderRouter.js';

export { SwarmObservability } from './SwarmObservability.js';

export { SwarmRecovery } from './SwarmRecovery.js';
export type { RecoveryStrategy, RecoveryPlan } from './SwarmRecovery.js';

export { ResourceProtection } from './ResourceProtection.js';

export { LongWorkflowStability } from './LongWorkflowStability.js';
