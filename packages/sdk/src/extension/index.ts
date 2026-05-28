/**
 * Extension module — manifests, lifecycle, loader, and registry
 */

export { createManifest, validateManifest } from './ExtensionManifest.js';

export type {
  ExtensionVisibility,
  ExtensionType,
  ExtensionLifecycleStage,
  ExtensionPermission,
  VersionCompatibility,
  ExtensionManifest,
} from './ExtensionManifest.js';

export { ExtensionLifecycleManager } from './ExtensionLifecycle.js';

export type {
  LifecycleHook,
  LifecycleContext,
  LifecycleResult,
  ManagedExtension,
} from './ExtensionLifecycle.js';

export { ExtensionLoader } from './ExtensionLoader.js';

export type { ExtensionLoaderConfig, ExtensionLoadResult } from './ExtensionLoader.js';

export { ExtensionRegistry } from './ExtensionRegistry.js';

export type {
  ExtensionInstallation,
  RegistryEvent,
  RegistryEventHandler,
} from './ExtensionRegistry.js';
