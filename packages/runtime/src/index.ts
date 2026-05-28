/**
 * @autic/runtime - Execution runtime with task orchestration, queue, watchdog, worker pool,
 * execution engine, terminal engine, recovery, and event system
 */

// Queue + Worker Pool
export { Queue } from './queue/index.js';
export type { QueueOptions, QueueEvents, TaskHandler } from './queue/index.js';
export { WorkerPool } from './worker/index.js';
export type { WorkerTask, WorkerResult, WorkerPoolOptions } from './worker/index.js';

// Watchdog
export { Watchdog } from './watchdog/index.js';
export type { WatchdogOptions, WatchdogEvents } from './watchdog/index.js';

// Task orchestration
export {
  canTransition,
  assertTransition,
  transitionTask,
  isTerminal,
  isActive,
  isFailed,
  isPaused,
  canRetry,
  canCancel,
} from './tasks/TaskState.js';
export { TaskOrchestrator } from './tasks/TaskOrchestrator.js';
export type { TaskOrchestratorOptions, TaskOrchestratorEvents } from './tasks/TaskOrchestrator.js';

// Execution engine
export { ExecutionEngine } from './execution/ExecutionEngine.js';
export type { EngineOptions, ExecutionEvents } from './execution/ExecutionEngine.js';

// Terminal engine
export { TerminalEngine } from './terminal/TerminalEngine.js';
export type { TerminalEvents } from './terminal/TerminalEngine.js';

// Recovery manager
export { RecoveryManager } from './recovery/RecoveryManager.js';
export type { RecoveryOptions } from './recovery/RecoveryManager.js';

// Runtime events
export { RuntimeEvents } from './events/RuntimeEvents.js';
export type { EventListener } from './events/RuntimeEvents.js';

// Stability modules
export { AdvancedWatchdog } from './stability/AdvancedWatchdog.js';
export type {
  AdvancedWatchdogOptions,
  AdvancedWatchdogEvents,
} from './stability/AdvancedWatchdog.js';
export { MemoryOptimizer } from './stability/MemoryOptimizer.js';
export type { MemoryOptimizerOptions, MemoryOptimizerEvents } from './stability/MemoryOptimizer.js';
export { ResourceManager } from './stability/ResourceManager.js';
export type { ResourceManagerOptions, ResourceManagerEvents } from './stability/ResourceManager.js';
export { LoopProtection } from './stability/LoopProtection.js';
export type { LoopProtectionOptions, LoopProtectionEvents } from './stability/LoopProtection.js';
export { BackgroundScheduler } from './stability/BackgroundScheduler.js';
export type {
  BackgroundSchedulerOptions,
  BackgroundSchedulerEvents,
} from './stability/BackgroundScheduler.js';
export { GracefulShutdown } from './stability/GracefulShutdown.js';
export type {
  GracefulShutdownOptions,
  GracefulShutdownEvents,
} from './stability/GracefulShutdown.js';
export { Telemetry } from './stability/Telemetry.js';
export type { TelemetryOptions, TelemetryEvents } from './stability/Telemetry.js';
export { ProcessIsolation } from './stability/ProcessIsolation.js';
export type {
  ProcessIsolationOptions,
  ProcessIsolationEvents,
} from './stability/ProcessIsolation.js';

// Advanced queue control
export { AdvancedQueueController } from './queue/AdvancedQueueController.js';
export type {
  AdvancedQueueControllerOptions,
  AdvancedQueueControllerEvents,
} from './queue/AdvancedQueueController.js';

// Enhanced recovery
export { EnhancedRecoveryManager } from './recovery/EnhancedRecoveryManager.js';
export type {
  EnhancedRecoveryOptions,
  EnhancedRecoveryEvents,
} from './recovery/EnhancedRecoveryManager.js';
