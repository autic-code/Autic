/**
 * Extension Lifecycle Manager — manages extension lifecycle stages
 * and provides lifecycle hooks for safe extension execution.
 */

import { EventEmitter } from 'events';
import type { ExtensionManifest, ExtensionLifecycleStage, ExtensionType } from './ExtensionManifest.js';
import { timestamp, generateId } from '@autic/shared';

/**
 * Lifecycle hook function signature
 */
export type LifecycleHook = (context: LifecycleContext) => Promise<LifecycleResult>;

/**
 * Context provided to lifecycle hooks
 */
export interface LifecycleContext {
  /** Extension manifest */
  manifest: ExtensionManifest;
  /** Current lifecycle stage */
  stage: ExtensionLifecycleStage;
  /** Hook-specific payload */
  payload?: Record<string, unknown>;
}

/**
 * Result returned by a lifecycle hook
 */
export interface LifecycleResult {
  /** Whether the hook completed successfully */
  success: boolean;
  /** Optional error message on failure */
  error?: string;
  /** Modified payload to pass to next hook */
  payload?: Record<string, unknown>;
}

/**
 * Registered extension with lifecycle state
 */
export interface ManagedExtension {
  /** Unique runtime ID */
  runtimeId: string;
  /** Extension manifest */
  manifest: ExtensionManifest;
  /** Current lifecycle stage */
  stage: ExtensionLifecycleStage;
  /** Whether the extension is currently active */
  active: boolean;
  /** Activation count (for tracking reloads) */
  activationCount: number;
  /** Timestamp of last state change */
  lastStateChange: number;
  /** Error state if applicable */
  lastError?: string;
}

/**
 * Extension Lifecycle Manager
 *
 * Manages the full lifecycle of extensions:
 * registered → loaded → validated → activated → running → deactivated → unloaded
 */
export class ExtensionLifecycleManager extends EventEmitter {
  private extensions: Map<string, ManagedExtension> = new Map();
  private hooks: Map<ExtensionLifecycleStage, LifecycleHook[]> = new Map();
  private stageOrder: ExtensionLifecycleStage[] = [
    'registered',
    'loaded',
    'validated',
    'activated',
    'running',
    'deactivated',
    'unloaded',
  ];

  constructor() {
    super();
  }

  /**
   * Register a new extension
   */
  async register(manifest: ExtensionManifest): Promise<ManagedExtension> {
    const existing = Array.from(this.extensions.values()).find(
      (e) => e.manifest.id === manifest.id,
    );
    if (existing) {
      throw new Error(`Extension already registered: ${manifest.id} (${manifest.name})`);
    }

    const extension: ManagedExtension = {
      runtimeId: `runtime-${generateId()}`,
      manifest,
      stage: 'registered',
      active: false,
      activationCount: 0,
      lastStateChange: timestamp(),
    };

    this.extensions.set(extension.runtimeId, extension);
    this.emit('registered', { extension });

    // Auto-transition to loaded
    await this.transitionTo(extension, 'loaded');
    return extension;
  }

  /**
   * Activate a registered extension (transition through lifecycle)
   */
  async activate(runtimeId: string): Promise<ManagedExtension> {
    const extension = this.extensions.get(runtimeId);
    if (!extension) {
      throw new Error(`Extension not found: ${runtimeId}`);
    }
    if (extension.active) {
      return extension;
    }

    await this.transitionTo(extension, 'validated');
    await this.transitionTo(extension, 'activated');
    await this.transitionTo(extension, 'running');

    extension.active = true;
    extension.activationCount++;
    extension.lastStateChange = timestamp();
    this.emit('activated', { extension });

    return extension;
  }

  /**
   * Deactivate an extension
   */
  async deactivate(runtimeId: string): Promise<ManagedExtension> {
    const extension = this.extensions.get(runtimeId);
    if (!extension) {
      throw new Error(`Extension not found: ${runtimeId}`);
    }
    if (!extension.active) {
      return extension;
    }

    await this.transitionTo(extension, 'deactivated');
    extension.active = false;
    extension.lastStateChange = timestamp();
    this.emit('deactivated', { extension });

    return extension;
  }

  /**
   * Unload an extension completely
   */
  async unload(runtimeId: string): Promise<void> {
    const extension = this.extensions.get(runtimeId);
    if (!extension) {
      throw new Error(`Extension not found: ${runtimeId}`);
    }

    if (extension.active) {
      await this.deactivate(runtimeId);
    }

    await this.transitionTo(extension, 'unloaded');
    this.extensions.delete(runtimeId);
    this.emit('unloaded', { runtimeId, manifestId: extension.manifest.id });
  }

  /**
   * Register a lifecycle hook for a specific stage
   */
  onStage(stage: ExtensionLifecycleStage, hook: LifecycleHook): void {
    const existing = this.hooks.get(stage) ?? [];
    existing.push(hook);
    this.hooks.set(stage, existing);
  }

  /**
   * Get all managed extensions
   */
  getAll(): ManagedExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get extension by runtime ID
   */
  get(runtimeId: string): ManagedExtension | undefined {
    return this.extensions.get(runtimeId);
  }

  /**
   * Get extensions by type
   */
  getByType(type: ExtensionType): ManagedExtension[] {
    return this.getAll().filter((e) => e.manifest.type === type);
  }

  /**
   * Get active extensions
   */
  getActive(): ManagedExtension[] {
    return this.getAll().filter((e) => e.active);
  }

  /**
   * Get extension count
   */
  get count(): number {
    return this.extensions.size;
  }

  /**
   * Transition extension to a new stage
   */
  private async transitionTo(
    extension: ManagedExtension,
    targetStage: ExtensionLifecycleStage,
  ): Promise<void> {
    const currentIdx = this.stageOrder.indexOf(extension.stage);
    const targetIdx = this.stageOrder.indexOf(targetStage);

    if (targetIdx < currentIdx) {
      throw new Error(
        `Cannot transition from ${extension.stage} to ${targetStage} (reverse transition not allowed)`,
      );
    }

    for (let i = currentIdx + 1; i <= targetIdx; i++) {
      const nextStage = this.stageOrder[i];
      extension.stage = nextStage;
      extension.lastStateChange = timestamp();

      await this.executeHooks(nextStage, extension);

      this.emit('stageTransition', {
        runtimeId: extension.runtimeId,
        stage: nextStage,
        timestamp: extension.lastStateChange,
      });
    }
  }

  /**
   * Execute all hooks for a given stage
   */
  private async executeHooks(
    stage: ExtensionLifecycleStage,
    extension: ManagedExtension,
  ): Promise<void> {
    const stageHooks = this.hooks.get(stage) ?? [];

    for (const hook of stageHooks) {
      try {
        const context: LifecycleContext = {
          manifest: extension.manifest,
          stage,
          payload: { runtimeId: extension.runtimeId },
        };

        const result = await hook(context);

        if (!result.success) {
          extension.lastError = result.error ?? 'Hook execution failed';
          extension.stage = 'error';
          this.emit('hookError', {
            runtimeId: extension.runtimeId,
            stage,
            error: extension.lastError,
          });
          throw new Error(extension.lastError);
        }
      } catch (err) {
        extension.lastError = err instanceof Error ? err.message : String(err);
        extension.stage = 'error';
        this.emit('hookError', {
          runtimeId: extension.runtimeId,
          stage,
          error: extension.lastError,
        });
        throw err;
      }
    }
  }
}
