/**
 * @autic/hardening — Production hardening + reliability validation systems.
 *
 * Contains 17 hardening subsystems for runtime reliability, fault tolerance,
 * stress testing, memory leak detection, deadlock protection, and more.
 */

// #1 — Full Runtime Audit
export { RuntimeAuditSystem } from './audit/RuntimeAudit.js';
export type { RuntimeAuditOptions, RuntimeAuditEvents } from './audit/RuntimeAudit.js';

// #2 — Long-Workflow Stress Testing
export { StressTestRunner } from './stress/StressTestRunner.js';
export type { StressTestRunnerOptions, StressTestEvents } from './stress/StressTestRunner.js';

// #3 — Provider Failure Hardening
export { ProviderFailureHardener } from './provider/ProviderFailureHardening.js';
export type {
  ProviderHardeningOptions,
  ProviderHardeningEvents,
} from './provider/ProviderFailureHardening.js';

// #4 — Memory Leak Detection
export { MemoryLeakDetector } from './memory/MemoryLeakDetector.js';
export type { MemoryLeakDetectorOptions, MemoryLeakEvents } from './memory/MemoryLeakDetector.js';

// #5 — Deadlock + Stall Protection
export { DeadlockStallProtector } from './deadlock/DeadlockStallProtection.js';
export type {
  DeadlockStallOptions,
  DeadlockStallEvents,
} from './deadlock/DeadlockStallProtection.js';

// #6 — Execution Safety Validation
export { ExecutionSafetyValidator } from './safety/ExecutionSafetyValidator.js';

// #7 — Context System Hardening
export { ContextHardeningSystem } from './context/ContextHardeningSystem.js';

// #8 — Swarm Stability Validation
export { SwarmStabilityValidator } from './swarm/SwarmStabilityValidator.js';

// #9 — Crash Recovery Hardening
export { CrashRecoveryHardener } from './recovery/CrashRecoveryHardening.js';

// #10 — Filesystem Safety Validation
export { FilesystemSafetyValidator } from './filesystem/FilesystemSafetyValidator.js';

// #11 — Security Hardening
export { SecurityHardeningSystem } from './security/SecurityHardeningSystem.js';

// #12 — CLI Resilience
export { CLIResilienceEnhancer } from './cli/CLIResilienceSystem.js';

// #13 — Error Diagnostics
export { ErrorDiagnosticsEnhancer } from './cli/ErrorDiagnosticsSystem.js';

// #14 — Performance Hardening
export { PerformanceHardener } from './performance/PerformanceHardeningSystem.js';

// #15 — Production Validation Suite
export { ProductionValidationSuite } from './validation/ProductionValidationSuite.js';

// #16 — Release Readiness
export { ReleaseReadinessChecker } from './validation/ReleaseReadinessSystem.js';

// #17 — CLI UX Hardening
export { CLIUXHardener } from './ux/CLIUXHardening.js';
