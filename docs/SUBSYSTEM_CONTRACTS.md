# Subsystem Contracts

> Version: 0.1.0 | Defines the public API contracts between all Autic subsystems.

## Core Shared Types (`@autic/shared`)

The shared types package defines cross-cutting interfaces used by all subsystems.

```typescript
// Provider contract
interface ProviderConfig {
  name: string;
  provider: 'openrouter' | 'ollama' | 'openai' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  rateLimit?: { requestsPerMinute: number; tokensPerMinute: number };
}

// Session contract
interface SessionConfig {
  id: string;
  model?: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
}

// Workflow contract
interface WorkflowConfig {
  goal: string;
  maxSteps: number;
  timeout: number;
  allowDangerous: boolean;
  verbose: boolean;
}
```

## Provider Layer (`@autic/provider`)

**Purpose:** Abstract LLM provider interactions behind a unified interface.

**Public API:**
- `ProviderRouter` — Routes requests to the appropriate provider
- `ProviderRegistry` — Manages registered providers
- `ProviderHealthCheck` — Validates provider connectivity

**Contract:**
```typescript
interface ProviderRouter {
  route(config: ProviderConfig, prompt: string): Promise<ProviderResponse>;
  getAvailableModels(): Promise<ModelInfo[]>;
  validateProvider(name: string): Promise<boolean>;
}
```

## Context Layer (`@autic/context`)

**Purpose:** Manage LLM context windows with token optimization and caching.

**Public API:**
- `ContextManager` — Handles context assembly and optimization
- `TokenOptimizer` — Compresses context within token limits
- `ContextCache` — Caches processed contexts

**Contract:**
```typescript
interface ContextManager {
  buildContext(session: SessionConfig, messages: Message[]): Promise<ContextResult>;
  optimizeContext(context: ContextResult): Promise<ContextResult>;
  resetSession(sessionId: string): Promise<void>;
}
```

## Orchestration Layer (`@autic/orchestrator` + `@autic/swarm`)

**Purpose:** Coordinate multi-agent execution pipelines.

**Public API:**
- `NeuroBrain` — Central orchestration intelligence
- `PipelineExecutor` — Executes staged pipelines
- `SwarmCoordinator` — Manages multi-agent coordination

**Contract:**
```typescript
interface Orchestrator {
  executePipeline(goal: string, pipeline: PipelineConfig): Promise<PipelineResult>;
  getStatus(): OrchestrationSnapshot;
  cancel(sessionId: string): Promise<void>;
}

interface SwarmCoordinator {
  startSwarm(goal: string, config: SwarmConfig): Promise<SwarmSession>;
  getSwarmStatus(sessionId: string): SwarmStatus;
  stopSwarm(sessionId: string): Promise<void>;
}
```

## Workflow Layer (`@autic/workflow`)

**Purpose:** Execute autonomous engineering workflows.

**Public API:**
- `WorkflowEngine` — Executes multi-step autonomous workflows
- `TaskExecutor` — Executes individual tasks within workflows

**Contract:**
```typescript
interface WorkflowEngine {
  execute(goal: string, config: WorkflowConfig): Promise<WorkflowResult>;
  getProgress(workflowId: string): WorkflowProgress;
  cancel(workflowId: string): Promise<void>;
}
```

## Security Layer (`@autic/vault`, `@autic/sanitization`, `@autic/permissions`)

**Purpose:** Provide defense-in-depth security for secrets, output sanitization, and permission management.

### Vault Contract
```typescript
interface Vault {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  isEncrypted(): boolean;
}
```

### Sanitization Contract
```typescript
interface SecretSanitizer {
  sanitize(output: string): string;
  addPattern(pattern: RegExp): void;
  getStats(): SanitizationStats;
}
```

### Permissions Contract
```typescript
interface PermissionManager {
  checkPermission(action: string, scope: PermissionScope): Promise<boolean>;
  grantPermission(extension: string, permissions: string[]): Promise<void>;
  revokePermission(extension: string, permission: string): Promise<void>;
}
```

## Hardening Layer (`@autic/hardening`)

**Purpose:** Ensure runtime stability through watchdogs, recovery, and failure detection.

**Public API:**
- `Watchdog` — Monitors runtime health with heartbeat checks
- `CrashRecovery` — Restores state after crashes
- `DeadlockProtector` — Detects and resolves deadlocks/stalls
- `MemoryLeakDetector` — Identifies memory leaks in workers
- `ProviderFailureHardener` — Handles provider failures with fallback logic

**Contract:**
```typescript
interface Watchdog {
  start(interval: number): void;
  stop(): void;
  healthCheck(): RuntimeHealthIndicators;
}

interface CrashRecovery {
  restoreSession(sessionId: string): Promise<boolean>;
  restoreQueue(): Promise<boolean>;
  getRestorePoints(): RestorePoint[];
}
```

## Diagnostics Layer (`@autic/diagnostics`)

**Purpose:** Provide runtime introspection, health monitoring, and documentation.

**Public API:**
- `Doctor` — Comprehensive environment diagnostics
- `ObservabilityEnhancer` — Runtime system snapshots and health checks
- `SecurityValidator` — Security validation framework
- `DocumentationGenerator` — Markdown documentation generation
- `CrashDiagnostics` — Crash analysis and reporting

**Contract:**
```typescript
interface ObservabilityEnhancer {
  getRuntimeHealth(): RuntimeHealthIndicators;
  getOrchestrationSnapshot(): OrchestrationSnapshot;
  getQueueSnapshot(): QueueSnapshot;
  getProviderSnapshot(): ProviderSnapshot;
  getContextSnapshot(): ContextSnapshot;
  getLearningSnapshot(): LearningSnapshot;
}
```

## Validation Layer (`@autic/validation`)

**Purpose:** Validate real-world operational readiness.

**Public API:**
- `WorkflowValidator` — Validates workflows against project types
- `ChaosSimulator` — Simulates provider failures for resilience testing
- `LongRunTester` — Long-running autonomous workflow testing
- `RegressionPreventer` — Regression detection across subsystems
- `RecoveryValidator` — Validates crash recovery capabilities
- `PlatformCertifier` — Platform certification checks

## Governance Layer (`@autic/governance`)

**Purpose:** Manage extension ecosystem safety and compatibility.

**Public API:**
- `ExtensionGovernor` — Extension trust metadata, permission auditing, compatibility scoring
- `SecurityAuditor` — Runtime security audit framework
- `EcosystemMaintenance` — Extension diagnostics, compatibility inspection

## Profiling Layer (`@autic/profiling`)

**Purpose:** Production performance analysis and baseline establishment.

**Public API:**
- `RuntimeProfiler` — CPU, memory, queue, provider, orchestration profiling
- `PerformanceBaseline` — Performance baseline management and comparison

## Telemetry Layer (`@autic/telemetry`)

**Purpose:** Safe, opt-in, privacy-preserving runtime metrics.

**Contract:**
```typescript
interface TelemetryCollector {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  getConfig(): TelemetryConfig;
  getReport(): TelemetryReport;
  clear(): void;
}
```

**Data collection policy:**
- ✅ Anonymized runtime metrics (aggregate only)
- ✅ Crash categories (type, count — no stack traces)
- ✅ Provider reliability metrics (latency, success rate — no API keys)
- ✅ Workflow performance statistics (duration, steps — no repo info)
- ❌ NEVER: secrets, source code, prompts, credentials, file contents

## SDK Layer (`@autic/sdk`)

**Purpose:** Enable safe third-party extension development.

**Key contracts:**
- `ExtensionManifest` — Extension metadata and permissions declaration
- `ExtensionLifecycleManager` — Install, enable, disable, uninstall lifecycle
- `ExtensionLoader` — Sandboxed extension loading
- `ExtensionRegistry` — Extension registration and discovery
- `PluginSandbox` — Isolated plugin execution environment
- `RuntimeHooks` — Runtime lifecycle hooks (init, destroy, error)
- `ProviderHooks` — Provider interaction hooks (before/after request)
- `WorkflowHooks` — Workflow lifecycle hooks (before/after step)
- `OrchestrationHooks` — Pipeline orchestration hooks
- `ContextHooks` — Context manipulation hooks
- `PermissionManager` — Extension permission management
- `VersionCompatibilityChecker` — Extension version compatibility
- `EcosystemDiscovery` — Extension discovery in workspace

## Release Layer (`@autic/release`)

**Purpose:** Manage release channels and updates.

**Contract:**
```typescript
interface ReleaseChannels {
  getCurrentChannel(): 'stable' | 'beta' | 'dev';
  setChannel(channel: 'stable' | 'beta' | 'dev'): Promise<void>;
  checkForUpdates(): Promise<UpdateInfo | null>;
  getVersionHistory(): VersionInfo[];
}

interface ReleaseOperations {
  verifyRelease(version: string): Promise<ReleaseVerificationReport>;
  validateRollback(from: string, to: string): Promise<RollbackValidationResult>;
  checkPackageIntegrity(): Promise<IntegrityReport[]>;
  validateRuntimeCompatibility(): Promise<CompatibilityReport>;
  auditDependencies(): Promise<DependencyAuditReport>;
}
```
