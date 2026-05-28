/**
 * @autic/sdk — Extension SDK Foundation
 *
 * Safe extensibility architecture for the Autic ecosystem.
 * Provides extension lifecycle, plugin sandboxing, API hooks,
 * permission management, version compatibility, and discovery.
 */

// Extension system
export {
  createManifest,
  validateManifest,
  ExtensionLifecycleManager,
  ExtensionLoader,
  ExtensionRegistry,
} from './extension/index.js';

export type {
  ExtensionManifest,
  ExtensionVisibility,
  ExtensionType,
  ExtensionLifecycleStage,
  ExtensionPermission,
  VersionCompatibility,
  LifecycleHook,
  LifecycleContext,
  LifecycleResult,
  ManagedExtension,
  ExtensionLoaderConfig,
  ExtensionLoadResult,
  ExtensionInstallation,
  RegistryEvent,
  RegistryEventHandler,
} from './extension/index.js';

// Plugin sandbox
export { PluginSandbox } from './plugin/index.js';

export type {
  SandboxLimits,
  PluginExecutionContext,
  SandboxExecutionResult,
} from './plugin/index.js';

// API Hooks
export {
  RuntimeHooks,
  RuntimeHookEvent,
  ProviderHooks,
  ProviderHookEvent,
  WorkflowHooks,
  WorkflowHookEvent,
  OrchestrationHooks,
  OrchestrationHookEvent,
  ContextHooks,
  ContextHookEvent,
} from './hooks/index.js';

export type {
  RuntimeHookContext,
  RuntimeHookHandler,
  ProviderHookContext,
  ProviderHookHandler,
  WorkflowHookContext,
  WorkflowHookHandler,
  OrchestrationHookContext,
  OrchestrationHookHandler,
  ContextHookContext,
  ContextHookHandler,
} from './hooks/index.js';

// Permission management
export { PermissionManager, PERMISSION_SCOPES } from './permissions/index.js';

export type {
  PermissionCheck,
  PermissionScope,
  PermissionManagerConfig,
} from './permissions/index.js';

// Version compatibility
export { VersionCompatibilityChecker } from './version/index.js';

export type { CompatibilityCheckResult, CompatibilityCheckConfig } from './version/index.js';

// Ecosystem discovery
export { EcosystemDiscovery } from './discovery/index.js';

export type { DiscoveryConfig, DiscoveredExtension, DiscoveryResult } from './discovery/index.js';
