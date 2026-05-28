/**
 * @autic/context-engine — Advanced token optimization + context engineering.
 *
 * 15 subsystems for efficient, safe, and scalable context management:
 *   - ContextEngineeringCore — Central orchestration pipeline
 *   - TokenBudgetEngine — Provider/model-aware token budgeting
 *   - SelectiveFileRetrieval — Dependency-aware file targeting
 *   - ContextRankingSystem — Lightweight relevance ranking
 *   - ContextCompressionEngine — Summary generation, dedup, reduction
 *   - RepoChunkingSystem — Modular chunk boundaries
 *   - ExecutionAwareContextAssembly — Dynamic context per role
 *   - MultiLayerMemoryRetrieval — Scoped memory retrieval
 *   - ContextCachingSystem — Lightweight caches with invalidation
 *   - ProviderAwareOptimization — Provider-specific budgeting
 *   - TokenAwareSwarmCoordination — Agent token budgets
 *   - ContextObservability — Token usage, retrieval stats
 *   - ContextSafetySystem — Overflow prevention, runaway detection
 *   - LongWorkflowContextStability — Summarization, idle cleanup
 */

export { ContextEngineeringCore } from './ContextEngineeringCore.js';
export type { ContextEngineeringConfig } from './ContextEngineeringCore.js';

export { TokenBudgetEngine } from './TokenBudgetEngine.js';
export type { BudgetAllocation } from './TokenBudgetEngine.js';

export { SelectiveFileRetrieval } from './SelectiveFileRetrieval.js';
export type { RetrievalOptions } from './SelectiveFileRetrieval.js';

export { ContextRankingSystem } from './ContextRankingSystem.js';
export type { RankableItem, RankingOptions } from './ContextRankingSystem.js';

export { ContextCompressionEngine } from './ContextCompressionEngine.js';
export type { CompressionOptions, CompressionResult } from './ContextCompressionEngine.js';

export { RepoChunkingSystem } from './RepoChunkingSystem.js';

export { ExecutionAwareContextAssembly } from './ExecutionAwareContextAssembly.js';
export type { AgentRole, StageType } from './ExecutionAwareContextAssembly.js';

export { MultiLayerMemoryRetrieval } from './MultiLayerMemoryRetrieval.js';
export type { RetrievalRequest } from './MultiLayerMemoryRetrieval.js';

export { ContextCachingSystem } from './ContextCachingSystem.js';
export type { CacheOptions } from './ContextCachingSystem.js';

export { ProviderAwareOptimization } from './ProviderAwareOptimization.js';

export { TokenAwareSwarmCoordination } from './TokenAwareSwarmCoordination.js';
export type { AgentTokenBudget, SharedContextBudget } from './TokenAwareSwarmCoordination.js';

export { ContextObservability } from './ContextObservability.js';
export type { ObservabilityStats } from './ContextObservability.js';

export { ContextSafetySystem } from './ContextSafetySystem.js';
export type { SafetyCheckResult, SafetyStats } from './ContextSafetySystem.js';

export { LongWorkflowContextStability } from './LongWorkflowContextStability.js';
export type { WorkflowContextOptions } from './LongWorkflowContextStability.js';
