/**
 * Autic shared types and utilities
 */

/** Provider types */
export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  enabled: boolean;
}

export type ProviderType = 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'custom';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  capabilities: ModelCapability[];
  pricing?: ModelPricing;
}

export interface ModelCapability {
  type: 'chat' | 'code' | 'vision' | 'embedding' | 'function_calling' | 'streaming';
}

export interface ModelPricing {
  perMillionTokensInput: number;
  perMillionTokensOutput: number;
}

/** Message types */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  message: ChatMessage;
  usage?: TokenUsage;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Session types */
export interface SessionConfig {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workspaceDir: string;
  modelId?: string;
  providerId?: string;
  metadata: Record<string, string>;
}

/** Queue types */
export interface QueueTask<T = unknown> {
  id: string;
  type: string;
  priority: number;
  payload: T;
  status: QueueTaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  retries: number;
  maxRetries: number;
}

export type QueueTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Runtime types */
export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeWorkers: number;
  queuedTasks: number;
  memoryUsage: number;
  lastCheck: number;
}

/** Security types */
export interface VaultEntry {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
}

export interface Permission {
  action: string;
  resource: string;
  granted: boolean;
}

/** Tool types */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler: string;
  enabled: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

/** === Phase 2 — Execution Runtime Types === */

/** Task orchestration states */
export type TaskState =
  | 'pending'
  | 'queued'
  | 'planning'
  | 'running'
  | 'awaiting_tool'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'paused'
  | 'cancelled';

/** Full task lifecycle record */
export interface TaskRecord {
  id: string;
  sessionId: string;
  parentId?: string;
  type: string;
  description: string;
  state: TaskState;
  priority: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  steps: ExecutionStep[];
  error?: string;
  retries: number;
  maxRetries: number;
  metadata: Record<string, string>;
}

export interface ExecutionStep {
  id: string;
  type: 'tool_call' | 'llm_call' | 'plan' | 'verify' | 'recover';
  toolName?: string;
  input?: unknown;
  output?: unknown;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  error?: string;
}

/** Execution result */
export interface ExecutionResult {
  taskId: string;
  success: boolean;
  steps: ExecutionStep[];
  totalDurationMs: number;
  error?: string;
  output?: unknown;
}

/** Risk levels for permission system */
export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  reasons: string[];
}

/** Permission check middleware types */
export interface PermissionCheckRequest {
  action: string;
  resource: string;
  riskLevel: RiskLevel;
  taskId?: string;
  details?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  reason?: string;
}

/** Runtime event types */
export type RuntimeEventType =
  | 'task:created'
  | 'task:queued'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:retrying'
  | 'task:paused'
  | 'task:cancelled'
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'tool:executing'
  | 'tool:completed'
  | 'tool:failed'
  | 'queue:enqueued'
  | 'queue:drained'
  | 'runtime:health_changed'
  | 'runtime:degraded'
  | 'runtime:error'
  | 'watchdog:stall_detected'
  | 'watchdog:recovery_triggered';

export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: number;
  taskId?: string;
  stepId?: string;
  data?: Record<string, unknown>;
  error?: string;
}

/** Terminal execution types */
export interface TerminalOptions {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface TerminalResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
}

/** Recovery/snapshot types */
export interface ExecutionSnapshot {
  taskId: string;
  state: TaskState;
  completedSteps: ExecutionStep[];
  pendingSteps: ExecutionStep[];
  currentStepIndex: number;
  timestamp: number;
  metadata: Record<string, string>;
}

/** Watchdog stall detection types */
export interface StalledTaskInfo {
  taskId: string;
  type: string;
  startedAt: number;
  stalledSince: number;
  stalledDurationMs: number;
  description: string;
}

/** === Phase 3 — Memory + Session + Context Types === */

/** Session states */
export type SessionState = 'active' | 'paused' | 'crashed' | 'completed';

/** Enhanced session config */
export interface EnhancedSessionConfig extends SessionConfig {
  state: SessionState;
  workspaceId: string;
  taskCount: number;
  completedTaskCount: number;
  totalTokensUsed?: number;
  lastActiveAt: number;
}

/** Execution history entry */
export interface HistoryEntry {
  id: string;
  sessionId: string;
  type: 'task' | 'command' | 'tool_call' | 'llm_call';
  description: string;
  status: 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  metadata?: Record<string, string>;
}

/** Workspace memory structures */
export interface ArchitectureMemory {
  projectName: string;
  framework: string;
  packageManager: string;
  language: string;
  keyFiles: string[];
  dependencies: string[];
  updatedAt: number;
}

export interface RepoSummary {
  name: string;
  rootDir: string;
  totalFiles: number;
  totalDirs: number;
  languages: string[];
  frameworks: string[];
  detectedAt: number;
}

export interface CompletedTask {
  taskId: string;
  type: string;
  description: string;
  completedAt: number;
  durationMs: number;
  steps: number;
  result: 'success' | 'failure';
}

export interface WorkflowMemory {
  activeGoals: string[];
  recentDecisions: Array<{ decision: string; context: string; timestamp: number }>;
  currentContext: string;
  updatedAt: number;
}

/** Layered memory types */
export type MemoryLayer = 'short_term' | 'mid_term' | 'long_term';

export interface MemoryRecord {
  id: string;
  key: string;
  value: unknown;
  layer: MemoryLayer;
  tags: string[];
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
  ttl?: number;
}

/** Engineering memory types */
export interface ErrorRecord {
  id: string;
  error: string;
  context: string;
  severity: 'low' | 'medium' | 'high';
  occurredAt: number;
  resolvedAt?: number;
  resolution?: string;
}

export interface FixRecord {
  id: string;
  issue: string;
  fix: string;
  files: string[];
  appliedAt: number;
  success: boolean;
}

export interface PatternRecord {
  id: string;
  pattern: string;
  description: string;
  examples: string[];
  detectedAt: number;
  frequency: number;
}

/** Context optimization types */
export interface ContextBudget {
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  breakdown: Array<{ category: string; tokens: number; percentage: number }>;
}

export interface FileContext {
  path: string;
  priority: number;
  relevanceScore: number;
  tokenCount: number;
  reason: string;
}

export interface OptimizationResult {
  originalTokens: number;
  optimizedTokens: number;
  reduction: number;
  filesSelected: number;
  filesTotal: number;
  reductionPercentage: string;
}

/** Repo intelligence types */
export interface FileNode {
  path: string;
  type: 'file' | 'directory';
  size: number;
  depth: number;
  imports: string[];
  exports: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
}

export interface FrameworkInfo {
  name: string;
  version?: string;
  confidence: number;
  indicators: string[];
}

/** Storage types */
export interface StorageIndex {
  id: string;
  type: string;
  key: string;
  tags: string[];
  createdAt: number;
  size: number;
}

/** === Phase 4 — Provider Orchestration + Model Management Types === */

/** Provider status tracking */
export interface ProviderStatus {
  providerId: string;
  providerName: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'rate_limited';
  connected: boolean;
  latencyMs?: number;
  modelCount: number;
  lastChecked: number;
  lastError?: string;
  rateLimitedUntil?: number;
}

/** Provider registration entry */
export interface ProviderEntry {
  config: ProviderConfig;
  status: ProviderStatus;
  keyIds: string[];
  capabilities: string[];
}

/** Multi-key management */
export interface KeyEntry {
  id: string;
  providerId: string;
  label: string;
  keyPrefix: string;
  createdAt: number;
  lastUsedAt?: number;
  lastVerifiedAt?: number;
  verified: boolean;
  failedAttempts: number;
  cooldownUntil?: number;
  isActive: boolean;
}

/** Rate-limit state tracking */
export interface RateLimitState {
  requestsThisMinute: number;
  maxRequestsPerMinute: number;
  tokensThisMinute: number;
  maxTokensPerMinute: number;
  lastResetAt: number;
  cooldownUntil?: number;
  activeRequests: number;
  maxConcurrency: number;
}

/** Structured provider error */
export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  providerId: string;
  modelId?: string;
  statusCode?: number;
  retryable: boolean;
  retryAfterMs?: number;
  actionable: boolean;
  suggestion?: string;
  originalError?: string;
  timestamp: number;
}

export type ProviderErrorCode =
  | 'auth_failed'
  | 'invalid_key'
  | 'rate_limited'
  | 'provider_offline'
  | 'model_unavailable'
  | 'timeout'
  | 'insufficient_quota'
  | 'invalid_request'
  | 'internal_error'
  | 'network_error';

/** Routing strategies */
export type RoutingStrategy = 'priority' | 'fallback' | 'round_robin' | 'lowest_latency' | 'preferred';

export interface RoutingConfig {
  strategy: RoutingStrategy;
  preferredProvider?: string;
  preferredModel?: string;
  fallbackProviders: string[];
  allowLocal: boolean;
  allowCloud: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/** Provider capability types */
export type ProviderCapability =
  | 'chat'
  | 'streaming'
  | 'function_calling'
  | 'vision'
  | 'code'
  | 'embedding';

/** Model registry entry */
export interface ModelRegistryEntry {
  model: ModelInfo;
  providerId: string;
  detectedAt: number;
  lastVerifiedAt: number;
  verified: boolean;
  contextWindow: number;
  isLocal: boolean;
  isInstalled: boolean;
}

/** Provider add result */
export interface ProviderAddResult {
  success: boolean;
  providerId: string;
  modelsFound: number;
  errors: string[];
  verificationStatus: 'verified' | 'failed' | 'unknown';
}

/** === Phase 5 — Autonomous Engineering Loop Types === */

/** Workflow plan — decomposed task with ordered steps */
export interface WorkflowPlan {
  id: string;
  sessionId: string;
  goal: string;
  steps: WorkflowStep[];
  createdAt: number;
  metadata: Record<string, string>;
}

/** A single step in a workflow plan */
export interface WorkflowStep {
  id: string;
  description: string;
  type: WorkflowStepType;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  dependencies: string[]; // step IDs this step depends on
  status: WorkflowStepStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  output?: unknown;
  error?: string;
  retries: number;
  maxRetries: number;
  verificationResult?: VerificationResult;
}

export type WorkflowStepType =
  | 'analyze'
  | 'plan'
  | 'tool_call'
  | 'llm_call'
  | 'verify'
  | 'repair'
  | 'complete';

export type WorkflowStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'retrying';

/** Workflow execution state */
export interface WorkflowState {
  planId: string;
  goal: string;
  status: 'planning' | 'executing' | 'verifying' | 'repairing' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  steps: WorkflowStep[];
  startedAt: number;
  completedAt?: number;
  totalRetries: number;
  maxRetries: number;
  error?: string;
}

/** Verification result */
export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
  summary: string;
  durationMs: number;
}

export interface VerificationCheck {
  type: 'build' | 'test' | 'lint' | 'typecheck' | 'file_exists' | 'command_success' | 'custom';
  name: string;
  passed: boolean;
  output?: string;
  error?: string;
  durationMs?: number;
}

/** Failure classification */
export type FailureCategory =
  | 'dependency'
  | 'compilation_error'
  | 'type_error'
  | 'provider_error'
  | 'timeout'
  | 'verification_failed'
  | 'permission_denied'
  | 'runtime_crash'
  | 'tool_error'
  | 'unknown';

export interface FailureClassification {
  category: FailureCategory;
  severity: 'low' | 'medium' | 'high';
  retryable: boolean;
  retryStrategy?: 'immediate' | 'backoff' | 'skip_step' | 'abort';
  description: string;
  suggestion?: string;
}

/** Safety controls configuration */
export interface SafetyConfig {
  maxExecutionDepth: number;
  maxWorkflowRetries: number;
  maxStepRetries: number;
  workflowTimeoutMs: number;
  stepTimeoutMs: number;
  allowDangerousActions: boolean;
  requirePermissionForHighRisk: boolean;
  maxConsecutiveFailures: number;
}

/** Coordination state — full snapshot of autonomous execution */
export interface CoordinationState {
  workflow: WorkflowState;
  currentStep: WorkflowStep | null;
  pendingTools: string[];
  completedCount: number;
  failedCount: number;
  totalDurationMs: number;
  memoryUsage: number;
}

/** Execution observability event */
export interface ExecutionEvent {
  type: ExecutionEventType;
  timestamp: number;
  planId?: string;
  stepId?: string;
  message: string;
  data?: Record<string, unknown>;
}

export type ExecutionEventType =
  | 'workflow:started'
  | 'workflow:planning'
  | 'workflow:step_started'
  | 'workflow:step_completed'
  | 'workflow:step_failed'
  | 'workflow:verifying'
  | 'workflow:repairing'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:cancelled'
  | 'workflow:paused'
  | 'workflow:resumed'

/** === Phase 6 — Security + Permission + Secret Protection Types === */

/** Trust profiles for auto-mode */
export type TrustProfile = 'safe' | 'balanced' | 'full_auto';

export interface TrustProfileConfig {
  profile: TrustProfile;
  allowDangerousCommands: boolean;
  requireApprovalForMedium: boolean;
  autoApproveLowRisk: boolean;
  maxExecutionDepth: number;
  workflowTimeoutMs: number;
  allowedActions: string[];
  blockedActions: string[];
}

/** Security event types */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  action?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

export type SecurityEventType =
  | 'permission:granted'
  | 'permission:denied'
  | 'permission:approved'
  | 'permission:escalation'
  | 'sanitization:triggered'
  | 'sanitization:blocked'
  | 'vault:accessed'
  | 'vault:modified'
  | 'vault:error'
  | 'provider:sanitized'
  | 'provider:boundary_check'
  | 'safety:blocked'
  | 'safety:warning'
  | 'safety:path_protected'
  | 'trust:escalated'
  | 'trust:degraded'
  | 'privacy:mode_changed'
  | 'validation:warning'
  | 'validation:blocked';

/** Execution safety classification */
export interface ExecutionSafetyCheck {
  safe: boolean;
  reason?: string;
  classification: 'safe' | 'dangerous' | 'suspicious' | 'unknown';
  riskLevel: RiskLevel;
  matchedPatterns: string[];
  suggestion?: string;
}

/** Privacy mode configuration */
export interface PrivacyConfig {
  mode: 'offline' | 'local_only' | 'normal';
  disableTelemetry: boolean;
  disableCloudSync: boolean;
  restrictLocalProviders: boolean;
  blockOutboundRequests: boolean;
}

/** Secure context assembly config */
export interface SecureContextConfig {
  maxFiles: number;
  maxTokens: number;
  includeEnv: boolean;
  stripSecrets: boolean;
  sanitizePaths: boolean;
}

/** Security validation result */
export interface SecurityValidation {
  passed: boolean;
  checks: SecurityValidationCheck[];
  summary: string;
}

export interface SecurityValidationCheck {
  type: 'unsafe_workflow' | 'permission_escalation' | 'provider_trust' | 'suspicious_pattern' | 'custom';
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

/** Permission approval request */
export interface PermissionApprovalRequest {
  action: string;
  resource: string;
  riskLevel: RiskLevel;
  reason: string;
  trustProfile: TrustProfile;
  autoApproved: boolean;
  requiresUserInput: boolean;
}

/** Dangerous command pattern */
export interface DangerousPattern {
  pattern: RegExp;
  classification: 'destructive' | 'network' | 'system' | 'secret';
  riskLevel: RiskLevel;
  description: string;
}

/** === Phase 8 — Role-Based Agent Orchestration Types === */

/** Orchestration stages in the R&D pipeline */
export type OrchestrationStage =
  | 'research'
  | 'planning'
  | 'architecture'
  | 'engineering'
  | 'verification'
  | 'repair'
  | 'final_review'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Execution status of a pipeline or stage */
export type OrchestrationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** Pipeline definition — ordered stages for a role-based workflow */
export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  stages: OrchestrationStage[];
  timeoutMs: number;
  maxDelegations: number;
  safetyProfile: 'safe' | 'balanced';
}

/** Current state of a running pipeline */
export interface PipelineState {
  pipelineId: string;
  goal: string;
  currentStage: OrchestrationStage;
  status: OrchestrationStatus;
  stagesCompleted: OrchestrationStage[];
  stagesFailed: OrchestrationStage[];
  startedAt: number;
  completedAt?: number;
  error?: string;
  delegations: number;
  currentAgentId?: string;
  contractHistory: TaskContract[];
}

/** Structured task contract — typed I/O between orchestration agents */
export interface TaskContract {
  id: string;
  source: OrchestrationStage;
  target: OrchestrationStage;
  type: ContractType;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'fulfilled' | 'rejected';
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export type ContractType =
  | 'repo_analysis'
  | 'execution_plan'
  | 'architecture_validation'
  | 'code_implementation'
  | 'verification_result'
  | 'repair_result'
  | 'final_review'
  | 'pipeline_result';

/** Research agent contract output */
export interface ResearchOutput {
  repoStructure: {
    files: string[];
    directories: string[];
    configFiles: string[];
  };
  dependencies: string[];
  frameworks: Array<{ name: string; confidence: number }>;
  summary: string;
  keyFindings: string[];
}

/** Planning agent contract output */
export interface PlanningOutput {
  tasks: Array<{
    id: string;
    description: string;
    type: string;
    dependencies: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
  }>;
  estimatedSteps: number;
  suggestedPipeline: string[];
  risks: string[];
}

/** Architecture agent contract output */
export interface ArchitectureOutput {
  validations: Array<{
    check: string;
    passed: boolean;
    message: string;
  }>;
  recommendations: string[];
  consistent: boolean;
  summary: string;
}

/** Engineering agent contract output */
export interface EngineeringOutput {
  changesApplied: number;
  filesModified: string[];
  filesCreated: string[];
  summary: string;
  warnings: string[];
}

/** Verification agent contract output */
export interface VerificationOutput {
  passed: boolean;
  checks: Array<{
    type: 'build' | 'test' | 'lint' | 'typecheck' | 'custom';
    name: string;
    passed: boolean;
    output?: string;
    error?: string;
  }>;
  summary: string;
}

/** Repair agent contract output */
export interface RepairOutput {
  attempts: number;
  repaired: boolean;
  fixesApplied: string[];
  finalState: 'resolved' | 'unresolved' | 'partial';
  summary: string;
}

/** Final review agent contract output */
export interface FinalReviewOutput {
  approved: boolean;
  architectureScore: number;
  securityScore: number;
  verificationScore: number;
  issues: string[];
  recommendations: string[];
  summary: string;
}

/** Orchestration event for observability */
export interface OrchestrationEvent {
  type: OrchestrationEventType;
  timestamp: number;
  pipelineId: string;
  stage: OrchestrationStage;
  message: string;
  agentId?: string;
  contractId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export type OrchestrationEventType =
  | 'pipeline:started'
  | 'pipeline:stage_started'
  | 'pipeline:stage_completed'
  | 'pipeline:stage_failed'
  | 'pipeline:stage_skipped'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'pipeline:cancelled'
  | 'pipeline:paused'
  | 'pipeline:resumed'
  | 'agent:delegated'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:retrying'
  | 'contract:created'
  | 'contract:fulfilled'
  | 'contract:rejected'
  | 'orchestrator:error';

/** Orchestrator configuration */
export interface OrchestratorOptions {
  maxDelegations?: number;
  defaultPipelineId?: string;
  safetyProfile?: 'safe' | 'balanced';
  stageTimeoutMs?: number;
  pipelineTimeoutMs?: number;
  persistState?: boolean;
}

/** === Phase 9 — Runtime Stability + Performance Optimization Types === */

/** Heartbeat tracking for runtime liveness */
export interface HeartbeatMetrics {
  component: string;
  componentId: string;
  lastHeartbeat: number;
  expectedIntervalMs: number;
  missedBeats: number;
  status: 'alive' | 'stale' | 'dead';
  metadata?: Record<string, unknown>;
}

/** Resource usage snapshot */
export interface ResourceMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapPercent: number;
  };
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  workers: {
    active: number;
    idle: number;
    total: number;
  };
  queue: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    pressure: number;
  };
  providers: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  pipelines: {
    active: number;
    completed: number;
    failed: number;
  };
}

/** Loop protection detection result */
export interface LoopDetection {
  detected: boolean;
  type: 'recursion' | 'repeated_failure' | 'infinite_verification' | 'runaway_repair' | 'none';
  pattern: string[];
  threshold: number;
  currentCount: number;
  source: string;
  recommendation: string;
}

/** Telemetry data point */
export interface TelemetryMetrics {
  workflowDurationMs: number;
  queueLatencyMs: number;
  providerLatencyMs: number;
  retryCount: number;
  memoryGrowthBytes: number;
  renderCount: number;
  toolExecutionCount: number;
  stageTransitions: number;
  errorCount: number;
  timestamp: number;
}

/** Graceful shutdown state */
export interface ShutdownState {
  phase: 'idle' | 'preparing' | 'saving' | 'stopping_workers' | 'persisting_queue' | 'cleaning_subprocesses' | 'complete';
  startedAt: number;
  completedAt?: number;
  saveErrors: string[];
  workersStopped: number;
  queueTasksPersisted: number;
  subprocessesCleaned: number;
}

/** Process isolation info */
export interface ProcessInfo {
  pid: number;
  ppid?: number;
  cmd: string;
  startedAt: number;
  memoryMB: number;
  cpuPercent: number;
  status: 'running' | 'zombie' | 'stopped';
  orphan: boolean;
}

/** Queue pressure assessment */
export interface QueuePressure {
  level: 'low' | 'medium' | 'high' | 'critical';
  pendingCount: number;
  runningCount: number;
  avgWaitMs: number;
  throughputPerMin: number;
  concurrencyUtilization: number;
  recommendation: string;
}

/** Memory usage breakdown */
export interface MemoryUsage {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  sessionCacheMB: number;
  contextCacheMB: number;
  eventLogMB: number;
  totalMB: number;
  growthRateMBPerHour: number;
}

/** Provider health cache entry */
export interface ProviderHealthCache {
  providerId: string;
  healthy: boolean;
  lastChecked: number;
  latencyMs: number;
  consecutiveFailures: number;
  cooldownUntil: number;
  degraded: boolean;
  lastError?: string;
}

/** Background task definition */
export interface BackgroundTask {
  id: string;
  name: string;
  type: 'cleanup' | 'maintenance' | 'health_check' | 'memory_prune' | 'telemetry_flush';
  intervalMs: number;
  lastRun: number;
  running: boolean;
  priority: 'low' | 'medium' | 'high';
}

/** === Phase 7 — Skills + Agent + Workflow Specialization Types === */

/** Skill type: declarative (JSON/YAML) or executable (TypeScript) */
export type SkillType = 'declarative' | 'executable';

/** Skill tool permission scoping */
export interface ToolPermission {
  toolId: string;
  allowed: boolean;
  resourcePattern?: string;
}

/** Full skill definition */
export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  type: SkillType;
  capabilities: string[];
  preferredModel?: string;
  preferredProvider?: string;
  toolPermissions: ToolPermission[];
  maxExecutionDepth?: number;
  timeoutMs?: number;
  workflowPipeline?: string[];
  dependencies?: string[];
}

/** Agent definition — specialized execution coordinator */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  maxDepth: number;
  timeoutMs: number;
  allowedTools: string[];
  preferredModel?: string;
  preferredProvider?: string;
  defaultPipeline?: string[];
}

/** Agent execution status */
export type AgentExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Agent execution context — isolated runtime state */
export interface AgentExecutionContext {
  agentId: string;
  skillId: string;
  taskId: string;
  goal: string;
  status: AgentExecutionStatus;
  depth: number;
  startedAt: number;
  completedAt?: number;
  steps: WorkflowStep[];
  toolAccess: string[];
  memoryAccess: string[];
  output?: unknown;
  error?: string;
}

/** Skill installation source */
export interface SkillSource {
  type: 'local' | 'inline';
  path?: string;
  content?: string;
}

/** Skill validation result */
export interface SkillValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** === Phase 10 — Engineering Learning + Operational Intelligence Types === */

/** Learning storage categories */
export type LearningCategory =
  | 'error'
  | 'fix'
  | 'pattern'
  | 'optimization'
  | 'verification';

/** Learning entry — structured record in the learning system */
export interface LearningEntry {
  id: string;
  type: LearningCategory;
  title: string;
  description: string;
  context: string;
  framework?: string;
  dependency?: string;
  confidence: number;
  verified: boolean;
  verificationCount: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  source: 'local' | 'session' | 'workspace' | 'global';
  metadata?: Record<string, string>;
}

/** Verified fix record — only verified successful fixes */
export interface VerifiedFix {
  id: string;
  issue: string;
  fix: string;
  framework?: string;
  dependency?: string;
  errorType: string;
  filesChanged: string[];
  verificationChecks: VerificationCheck[];
  verifiedAt: number;
  confidence: number;
  usageCount: number;
  lastUsed: number;
}

/** Enhanced failure classification with framework/dependency awareness */
export interface EnhancedFailureClassification {
  category: FailureCategory;
  severity: 'low' | 'medium' | 'high';
  retryable: boolean;
  retryStrategy?: 'immediate' | 'backoff' | 'skip_step' | 'abort';
  description: string;
  suggestion?: string;
  framework?: string;
  dependency?: string;
  tsErrorCode?: string;
  isBuildError: boolean;
  isLintError: boolean;
  isTypeError: boolean;
  isProviderError: boolean;
  isRuntimeError: boolean;
}

/** Workspace-specific learning profile */
export interface WorkspaceLearningProfile {
  workspaceId: string;
  projectName: string;
  frameworks: string[];
  languages: string[];
  packageManager: string;
  patterns: PatternRecord[];
  preferences: {
    preferredProvider?: string;
    preferredModel?: string;
    stylingConventions?: string[];
  };
  updatedAt: number;
}

/** Global intelligence entry — abstract, anonymized pattern */
export interface GlobalIntelligenceEntry {
  id: string;
  type: 'framework_pattern' | 'fix_pattern' | 'error_pattern' | 'optimization_pattern';
  abstractPattern: string;
  frameworks: string[];
  confidence: number;
  occurrences: number;
  lastVerified: number;
  createdAt: number;
}

/** Learning validation score */
export interface LearningValidationScore {
  entryId: string;
  confidence: number;
  verificationCount: number;
  lastVerified: number;
  expired: boolean;
  duplicate: boolean;
  duplicateOf?: string;
  isValid: boolean;
  reason: string;
}

/** Pre-build intelligence context */
export interface PreBuildContext {
  framework: string;
  dependencies: string[];
  knownRisks: string[];
  relevantPatterns: LearningEntry[];
  verifiedFixes: VerifiedFix[];
  optimizationTips: string[];
  loadedAt: number;
}

/** Operational optimization record */
export interface OperationalOptimization {
  id: string;
  type: 'provider_selection' | 'queue_strategy' | 'retry_pattern' | 'execution_pattern' | 'workflow_efficiency';
  description: string;
  successCount: number;
  failureCount: number;
  avgImprovementMs?: number;
  lastApplied: number;
  createdAt: number;
}

/** Learning retrieval query */
export interface LearningRetrievalQuery {
  framework?: string;
  dependency?: string;
  repository?: string;
  executionStage?: string;
  category?: LearningCategory;
  maxResults?: number;
  minConfidence?: number;
}

/** Learning retrieval result */
export interface LearningRetrievalResult {
  entries: LearningEntry[];
  verifiedFixes: VerifiedFix[];
  optimizations: OperationalOptimization[];
  totalCount: number;
  retrievalTimeMs: number;
}

/** Compression result from learning compression system */
export interface LearningCompressionResult {
  originalEntries: number;
  compressedEntries: number;
  removedCount: number;
  duplicatesRemoved: number;
  staleRemoved: number;
  estimatedTokensSaved: number;
}

/** Sanitized entry ready for optional global sync */
export interface SanitizedLearningEntry {
  abstractPattern: string;
  type: string;
  frameworks: string[];
  confidence: number;
  occurrences: number;
  source: 'global';
}

/** Framework intelligence entry */
export interface FrameworkIntelligence {
  framework: string;
  version?: string;
  commonPatterns: string[];
  knownIssues: Array<{ issue: string; fix: string; frequency: number }>;
  dependencyConflicts: Array<{ package: string; conflict: string; resolution: string }>;
  buildConfigTips: string[];
  updatedAt: number;
}

/** Learning observability event */
export interface LearningEvent {
  type: LearningEventType;
  timestamp: number;
  entryId?: string;
  category?: LearningCategory;
  message: string;
  confidence?: number;
  source?: string;
}

export type LearningEventType =
  | 'learning:entry_created'
  | 'learning:entry_verified'
  | 'learning:entry_applied'
  | 'learning:entry_expired'
  | 'learning:compression_run'
  | 'learning:retrieval_hit'
  | 'learning:retrieval_miss'
  | 'learning:sync_prepared'
  | 'learning:validation_failed'
  | 'learning:learning_disabled';

/** Learning controls state */
export interface LearningControls {
  enabled: boolean;
  localOnly: boolean;
  globalSync: boolean;
  learningDir: string;
  maxEntries: number;
  maxRetentionDays: number;
}

/** === Phase 11 — Controlled Swarm Orchestration Types === */

/** Swarm agent role types */
export type SwarmAgentRole =
  | 'coordinator'
  | 'worker'
  | 'researcher'
  | 'planner'
  | 'architect'
  | 'engineer'
  | 'verifier'
  | 'repairer'
  | 'reviewer'
  | 'observer';

/** Delegation contract — structured task assignment between swarm agents */
export interface DelegationContract {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  role: SwarmAgentRole;
  task: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled';
  depth: number;
  maxDepth: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, string>;
}

/** Swarm execution partition */
export interface ExecutionPartition {
  id: string;
  name: string;
  domain: 'frontend' | 'backend' | 'infrastructure' | 'data' | 'security' | 'testing' | 'documentation' | 'general';
  agents: string[];
  concurrency: number;
  activeJobs: number;
  maxJobs: number;
}

/** Shared orchestration memory cell */
export interface CoordinationMemoryCell {
  key: string;
  value: unknown;
  scope: 'global' | 'pipeline' | 'stage' | 'partition';
  owner: string;
  createdAt: number;
  updatedAt: number;
  ttl?: number;
}

/** Load balancer metrics snapshot */
export interface LoadBalancerMetrics {
  activeWorkers: number;
  idleWorkers: number;
  totalWorkers: number;
  providerUtilization: number;
  queuePressure: number;
  memoryPressure: number;
  cpuPressure: number;
  pendingDelegations: number;
  activeDelegations: number;
  recommendation: string;
  timestamp: number;
}

/** Swarm safety violation */
export interface SwarmSafetyViolation {
  type: 'delegation_depth' | 'swarm_size' | 'recursion' | 'runaway_execution' | 'pipeline_collapse';
  message: string;
  currentValue: number;
  maxValue: number;
  source: string;
  timestamp: number;
}

/** Resource protection state */
export interface ResourceProtectionState {
  cpuThreshold: number;
  memoryThreshold: number;
  providerThreshold: number;
  workerThreshold: number;
  queueBackpressureThreshold: number;
  cpuPressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
  memoryPressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
  providerPressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
  workerPressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
  queuePressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
  throttlingActive: boolean;
  lastCheck: number;
}

/** Swarm observability event */
export interface SwarmEvent {
  type: SwarmEventType;
  timestamp: number;
  swarmId: string;
  agentId?: string;
  delegationId?: string;
  partitionId?: string;
  message: string;
  error?: string;
  data?: Record<string, unknown>;
}

export type SwarmEventType =
  | 'swarm:started'
  | 'swarm:stopped'
  | 'swarm:paused'
  | 'swarm:resumed'
  | 'agent:registered'
  | 'agent:delegated'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:cancelled'
  | 'delegation:created'
  | 'delegation:accepted'
  | 'delegation:completed'
  | 'delegation:failed'
  | 'parallel:batch_started'
  | 'parallel:batch_completed'
  | 'parallel:worker_result'
  | 'parallel:worker_failed'
  | 'partition:created'
  | 'partition:activated'
  | 'partition:deactivated'
  | 'memory:written'
  | 'memory:read'
  | 'memory:expired'
  | 'safety:violation'
  | 'safety:blocked'
  | 'load:balanced'
  | 'load:throttled'
  | 'load:recovered'
  | 'provider:routed'
  | 'provider:rate_limited'
  | 'recovery:started'
  | 'recovery:completed'
  | 'recovery:failed'
  | 'stability:cooldown'
  | 'stability:adaptation'
  | 'stability:cleanup'
  | 'resource:protection_triggered'
  | 'resource:protection_released';

/** Swarm orchestration configuration */
export interface SwarmConfig {
  maxAgents: number;
  maxDelegationDepth: number;
  maxParallelBatches: number;
  concurrencyPerPartition: number;
  providerTimeoutMs: number;
  delegationTimeoutMs: number;
  cooldownMs: number;
  idleWorkerTimeoutMs: number;
  safetyProfile: 'safe' | 'balanced';
  localOnly: boolean;
}

/** Swarm status snapshot */
export interface SwarmStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error';
  agents: number;
  activeDelegations: number;
  completedDelegations: number;
  failedDelegations: number;
  partitions: number;
  startedAt: number;
  uptimeMs: number;
  config: SwarmConfig;
  loadMetrics: LoadBalancerMetrics;
  protection: ResourceProtectionState;
}

/** Role-based pipeline definition for swarm execution */
export interface SwarmPipelineDefinition {
  id: string;
  name: string;
  description: string;
  stages: Array<{
    name: string;
    role: SwarmAgentRole;
    description: string;
    timeoutMs: number;
    retries: number;
  }>;
  partition?: string;
  timeoutMs: number;
  maxParallelism: number;
}

/** Parallel batch execution result */
export interface ParallelBatchResult {
  batchId: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  results: Array<{
    jobId: string;
    agentId: string;
    success: boolean;
    output?: unknown;
    error?: string;
    durationMs: number;
  }>;
  totalDurationMs: number;
}

/** Concurrency routing decision */
export interface ConcurrencyRouteDecision {
  providerId: string;
  modelId: string;
  reason: string;
  loadScore: number;
  estimatedLatencyMs: number;
}

/** === Phase 12 — Advanced Token Optimization + Context Engineering Types === */

/** Token budget for a single assembly request */
export interface TokenBudget {
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  providerTokens: number;
  modelTokens: number;
  safetyMargin: number;
  breakdown: TokenBudgetBreakdown[];
}

export interface TokenBudgetBreakdown {
  category: 'files' | 'system_prompt' | 'conversation_history' | 'learning_memory' | 'execution_context' | 'available';
  tokens: number;
  percentage: number;
  maxTokens: number;
}

/** Context assembly request */
export interface ContextAssemblyRequest {
  goal: string;
  stage?: string;
  role?: string;
  files?: string[];
  maxTokens?: number;
  includeLearning?: boolean;
  includeMemory?: boolean;
  includeExecutionHistory?: boolean;
}

/** Context assembly result — the assembled context for a specific request */
export interface ContextAssemblyResult {
  requestId: string;
  selectedFiles: FileContext[];
  fileCount: number;
  fileTokens: number;
  totalTokens: number;
  budgetTokens: number;
  compressionRatio: number;
  retrievalTimeMs: number;
  cacheHits: number;
  assemblyWarnings: string[];
}

/** File chunk from repo chunking system */
export interface FileChunk {
  id: string;
  sourceFile: string;
  content: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  type: 'imports' | 'exports' | 'types' | 'implementation' | 'tests' | 'config' | 'documentation';
  dependencies: string[];
  exports: string[];
  priority: number;
}

/** Context cache entry */
export interface ContextCacheEntry {
  key: string;
  result: ContextAssemblyResult;
  files: string[];
  createdAt: number;
  accessedAt: number;
  ttl: number;
  hits: number;
  sizeBytes: number;
}

/** Context observability event */
export interface ContextEvent {
  type: ContextEventType;
  timestamp: number;
  requestId?: string;
  message: string;
  tokensUsed?: number;
  filesSelected?: number;
  compressionRatio?: number;
  cacheHits?: number;
  durationMs?: number;
  warning?: string;
  error?: string;
}

export type ContextEventType =
  | 'context:assembled'
  | 'context:file_retrieved'
  | 'context:chunk_loaded'
  | 'context:compressed'
  | 'context:cache_hit'
  | 'context:cache_miss'
  | 'context:cache_invalidated'
  | 'context:budget_allocated'
  | 'context:budget_overflow'
  | 'context:safety_triggered'
  | 'context:summarized'
  | 'context:stale_cleaned';

/** Context safety violation */
export interface ContextSafetyViolation {
  type: 'oversized_context' | 'runaway_retrieval' | 'recursive_retrieval' | 'memory_pressure';
  message: string;
  currentValue: number;
  maxValue: number;
  source: string;
  timestamp: number;
}

/** Provider-aware optimization recommendation */
export interface ProviderContextRecommendation {
  providerId: string;
  modelId: string;
  reason: 'large_context' | 'small_context' | 'balanced' | 'fallback';
  contextTokens: number;
  maxContextWindow: number;
  fitRatio: number;
  estimatedCost: number;
}

/** Memory retrieval item for multi-layer retrieval */
export interface MemoryRetrievalItem {
  source: 'short_term' | 'mid_term' | 'long_term' | 'learning' | 'repo_intelligence';
  key: string;
  value: unknown;
  relevance: number;
  tokenCost: number;
  tags: string[];
  retrievedAt: number;
}

/** Context ranking score */
export interface ContextRankingScore {
  itemId: string;
  itemType: 'file' | 'memory' | 'learning' | 'execution_record' | 'chunk';
  relevance: number;
  recency: number;
  frequency: number;
  dependencyScore: number;
  totalScore: number;
  reason: string;
}

/** Long-workflow context state */
export interface LongWorkflowContextState {
  sessionSummaries: Array<{ timeRange: string; summary: string; tokenCount: number }>;
  lastSummarizedAt: number;
  totalCompressedTokens: number;
  totalSavedTokens: number;
  adaptationLevel: 'normal' | 'summarizing' | 'minimal' | 'critical';
}

/** Long-workflow stability control state */
export interface LongWorkflowStabilityState {
  cooldownActive: boolean;
  cooldownUntil: number;
  adaptationLevel: 'normal' | 'reduced' | 'minimal' | 'paused';
  consecutiveDelegations: number;
  idleWorkers: number;
  lastCooldownAt: number;
  totalCooldownDurationMs: number;
}

/** === Phase 13 — Productionization + Configuration + Diagnostics Types === */

/** Global Autic configuration — stored at ~/.autic/config.json */
export interface AuticConfig {
  version: string;
  schema: number;
  lastUpdated: number;
  profile: DeveloperProfile;
  providers: ProviderConfig[];
  preferences: RuntimePreferences;
  update: UpdateConfig;
  diagnostics: DiagnosticsConfig;
}

/** Runtime preference settings */
export interface RuntimePreferences {
  defaultModel?: string;
  defaultProvider?: string;
  maxTokens: number;
  temperature: number;
  verbose: boolean;
  debug: boolean;
  logLevel: 'silent' | 'error' | 'warn' | 'info' | 'verbose' | 'debug';
  outputFormat: 'pretty' | 'json' | 'minimal';
}

/** Developer profile presets */
export type DeveloperProfile = 'safe' | 'balanced' | 'full_auto' | 'local_only';

/** Profile configuration — mapped from developer profile */
export interface ProfileConfig {
  profile: DeveloperProfile;
  label: string;
  description: string;
  allowDangerousCommands: boolean;
  requireApprovalForMedium: boolean;
  autoApproveLowRisk: boolean;
  maxExecutionDepth: number;
  workflowTimeoutMs: number;
  allowCloudProviders: boolean;
  allowLocalProviders: boolean;
  telemetryEnabled: boolean;
  cloudSyncEnabled: boolean;
}

/** Update check configuration */
export interface UpdateConfig {
  checkEnabled: boolean;
  checkIntervalMs: number;
  lastCheckedAt: number;
  latestVersion?: string;
  updateAvailable: boolean;
  updateUrl?: string;
  releaseNotes?: string;
}

/** Diagnostics configuration */
export interface DiagnosticsConfig {
  crashLogging: boolean;
  crashLogDir: string;
  maxCrashLogs: number;
  anonymizedReports: boolean;
  healthCheckIntervalMs: number;
}

/** Workspace configuration — stored in project's .autic/config.json */
export interface WorkspaceConfig {
  version: string;
  schema: number;
  projectName?: string;
  detectedFramework?: string;
  detectedPackageManager?: string;
  profile?: DeveloperProfile;
  providers?: ProviderConfig[];
  preferences?: Partial<RuntimePreferences>;
  initCompleted: boolean;
  initializedAt: number;
}

/** Config source for layered resolution */
export type ConfigSource = 'default' | 'global' | 'workspace' | 'profile' | 'env' | 'cli';

/** Resolved config with source tracking */
export interface ResolvedConfigValue<T> {
  value: T;
  source: ConfigSource;
  overridden: boolean;
}

/** Doctor diagnostic check result */
export interface DiagnosticCheck {
  name: string;
  category: 'system' | 'provider' | 'runtime' | 'security' | 'workspace' | 'network';
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  suggestion?: string;
  durationMs: number;
  details?: string;
}

/** Doctor diagnostic report */
export interface DiagnosticReport {
  timestamp: number;
  durationMs: number;
  checks: DiagnosticCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    skipped: number;
    total: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memoryTotal: number;
    memoryFree: number;
    cpus: number;
  };
}

/** Crash diagnostic snapshot */
export interface CrashSnapshot {
  id: string;
  timestamp: number;
  process: {
    pid: number;
    uptime: number;
    nodeVersion: string;
    platform: string;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: {
    command: string;
    args: string[];
    cwd: string;
    lastEvents: string[];
    activeSessions: number;
    activeWorkflows: number;
  };
  metadata: Record<string, string>;
  anonymized: boolean;
}

/** Installation validation result */
export interface InstallationValidation {
  passed: boolean;
  timestamp: number;
  durationMs: number;
  checks: Array<{
    name: string;
    category: 'system' | 'dependency' | 'permission' | 'provider';
    status: 'pass' | 'warn' | 'fail';
    message: string;
    details?: string;
  }>;
}

/** Platform compatibility info */
export interface PlatformInfo {
  platform: string;
  arch: string;
  shell: string;
  nodeVersion: string;
  npmVersion?: string;
  pnpmVersion?: string;
  gitVersion?: string;
  terminal: string;
  homeDir: string;
  configDir: string;
  dataDir: string;
  tempDir: string;
  pathSeparator: string;
  lineEnding: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
}

/** Update check result */
export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  isPrerelease: boolean;
  releaseDate?: string;
  releaseNotesUrl?: string;
  downloadUrl?: string;
  checkedAt: number;
}

/** Release manifest for integrity checking */
export interface ReleaseManifest {
  version: string;
  publishedAt: string;
  integrity: {
    algorithm: 'sha256' | 'sha512';
    hash: string;
  };
  files: Array<{
    name: string;
    size: number;
    integrity: string;
  }>;
  changelog?: string;
}

/** Performance validation result */
export interface PerformanceValidation {
  timestamp: number;
  startup: {
    coldStartMs: number;
    warmStartMs: number;
    initTimeMs: number;
    configLoadMs: number;
  };
  memory: {
    baselineMB: number;
    afterWorkflowMB: number;
    peakMB: number;
    leakDetected: boolean;
  };
  stress: {
    queueThroughput: number;
    maxConcurrentWorkers: number;
    failureRate: number;
    recoveryTimeMs: number;
  };
  recommendations: string[];
}

/** Privacy validation report */
export interface PrivacyValidation {
  passed: boolean;
  timestamp: number;
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }>;
  summary: string;
}

/** === Phase 14 — Production Hardening + Reliability Validation Types === */

/** Runtime audit check result */
export interface AuditCheck {
  name: string;
  category: 'health' | 'orchestration' | 'queue' | 'provider' | 'recovery' | 'memory' | 'safety';
  status: 'pass' | 'warn' | 'fail' | 'error';
  message: string;
  details?: string;
  durationMs: number;
  recommendation?: string;
}

/** Full runtime audit report */
export interface AuditReport {
  timestamp: number;
  durationMs: number;
  checks: AuditCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    errors: number;
    total: number;
  };
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  recommendations: string[];
}

/** Stress test configuration */
export interface StressTestConfig {
  durationMs: number;
  concurrency: number;
  workflowCount: number;
  providerFailures: boolean;
  memoryPressure: boolean;
  queueSaturation: boolean;
  simulateOutages: string[];
  taskTypes: string[];
}

/** Stress test phase result */
export interface StressTestPhase {
  name: string;
  durationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
  avgLatencyMs: number;
  peakMemoryMB: number;
  errors: string[];
}

/** Stress test result */
export interface StressTestResult {
  passed: boolean;
  config: StressTestConfig;
  phases: StressTestPhase[];
  totalDurationMs: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  errorRate: number;
  peakMemoryMB: number;
  avgLatencyMs: number;
  recoveryTimeMs: number;
  issues: string[];
  recommendations: string[];
}

/** Memory leak detection report */
export interface MemoryLeakReport {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  sessionsActive: number;
  workersActive: number;
  cacheEntries: number;
  orphanedTasks: Array<{ id: string; idleMs: number }>;
  suspiciousGrowth: Array<{ component: string; growthMB: number; timeWindowMs: number }>;
  leakDetected: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  recommendations: string[];
}

/** Deadlock detection result */
export interface DeadlockReport {
  detected: boolean;
  cycle: string[];
  involvedTasks: string[];
  blockedDurationMs: number;
  timestamp: number;
  autoResolved: boolean;
  resolution?: string;
}

/** Stall detection result */
export interface StallReport {
  detected: boolean;
  component: string;
  componentId: string;
  stalledSince: number;
  stalledDurationMs: number;
  lastActivity: number;
  autoResolved: boolean;
  resolution?: string;
}

/** Provider failure hardening state */
export interface ProviderHardeningState {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'isolated';
  consecutiveFailures: number;
  cooldownUntil: number;
  fallbackActive: boolean;
  fallbackProvider?: string;
  degradedModeAt?: number;
  isolationUntil?: number;
  lastOutageAt?: number;
  recoveryAttempts: number;
  history: Array<{ timestamp: number; event: string; detail: string }>;
}

/** Cascading failure state */
export interface CascadingFailureState {
  detected: boolean;
  rootProvider: string;
  affectedProviders: string[];
  affectedWorkflows: string[];
  timestamp: number;
  mitigationAction: string;
  contained: boolean;
}

/** Execution safety validation result */
export interface ExecutionSafetyValidation {
  passed: boolean;
  permissionBoundaryValid: boolean;
  recursionLimitsValid: boolean;
  dangerousCommandsHandled: boolean;
  secretSanitizationValid: boolean;
  providerIsolationValid: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: string;
  }>;
}

/** Context hardening validation result */
export interface ContextHardeningValidation {
  passed: boolean;
  tokenBudgetStable: boolean;
  retrievalScalingValid: boolean;
  compressionIntegrityValid: boolean;
  overflowProtectionActive: boolean;
  largeRepoPerformance: boolean;
  issues: string[];
  recommendations: string[];
}

/** Swarm stability validation result */
export interface SwarmStabilityValidation {
  passed: boolean;
  delegationBoundsValid: boolean;
  concurrencyLimitsValid: boolean;
  workerBalancingValid: boolean;
  orchestrationIsolationValid: boolean;
  recoveryLogicValid: boolean;
  issues: string[];
  recommendations: string[];
}

/** Crash recovery hardening result */
export interface CrashRecoveryValidation {
  passed: boolean;
  interruptedWorkflowRestorable: boolean;
  corruptedSessionHandling: boolean;
  partialQueueRestoration: boolean;
  failedAgentRecovery: boolean;
  safeResumability: boolean;
  issues: string[];
  recommendations: string[];
}

/** Filesystem safety validation result */
export interface FilesystemSafetyValidation {
  passed: boolean;
  unsafePathsChecked: boolean;
  accidentalDeletePrevention: boolean;
  workspaceBoundaryEnforced: boolean;
  atomicWriteValidated: boolean;
  rollbackCapability: boolean;
  issues: string[];
  recommendations: string[];
}

/** Security hardening validation result */
export interface SecurityHardeningValidation {
  passed: boolean;
  vaultIsolationValid: boolean;
  secretSanitizationValid: boolean;
  promptSanitizationValid: boolean;
  providerBoundarySecure: boolean;
  localOnlyModeIntegrity: boolean;
  issues: string[];
  recommendations: string[];
}

/** CLI resilience report */
export interface CLIResilienceReport {
  passed: boolean;
  startupResilient: boolean;
  terminalRecovery: boolean;
  renderRecovery: boolean;
  interruptedSessionRestoration: boolean;
  safeShutdown: boolean;
  issues: string[];
  recommendations: string[];
}

/** Error diagnostics report */
export interface ErrorDiagnosticsReport {
  timestamp: number;
  recentErrors: Array<{
    message: string;
    source: string;
    frequency: number;
    firstSeen: number;
    lastSeen: number;
    suggestion?: string;
  }>;
  providerErrors: Array<{
    providerId: string;
    errorCount: number;
    commonErrors: string[];
    suggestion?: string;
  }>;
  orchestrationErrors: Array<{
    stage: string;
    errorCount: number;
    commonFailures: string[];
  }>;
  recommendations: string[];
}

/** Performance hardening validation result */
export interface PerformanceHardeningReport {
  passed: boolean;
  startupMs: number;
  renderFrequencyMs: number;
  queueThroughput: number;
  memoryCleanupMs: number;
  providerPollingMs: number;
  retrievalMs: number;
  issues: string[];
  improvements: string[];
}

/** Production validation suite result */
export interface ProductionValidationResult {
  passed: boolean;
  timestamp: number;
  durationMs: number;
  suites: Array<{
    name: string;
    passed: boolean;
    testsPassed: number;
    testsFailed: number;
    testsSkipped: number;
    durationMs: number;
    errors: string[];
  }>;
  summary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
  recommendations: string[];
}

/** Release readiness validation result */
export interface ReleaseReadinessResult {
  passed: boolean;
  version: string;
  packageValid: boolean;
  dependenciesAudited: boolean;
  runtimeCompatible: boolean;
  configurationValid: boolean;
  integrityCheckPassed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: string;
  }>;
  recommendations: string[];
}

/** CLI UX hardening report */
export interface CLIUXHardeningReport {
  passed: boolean;
  errorClarity: boolean;
  runtimeVisibility: boolean;
  onboardingFlow: boolean;
  recoveryMessages: boolean;
  providerFeedback: boolean;
  executionTransparency: boolean;
  issues: string[];
  recommendations: string[];
}
