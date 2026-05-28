/**
 * Extension Registry — manages installed extensions, their metadata,
 * and provides query/discovery capabilities.
 */

import type { ExtensionManifest, ExtensionType, ExtensionVisibility } from './ExtensionManifest.js';
import { timestamp, generateId } from '@autic/shared';

/**
 * Installation record for an extension
 */
export interface ExtensionInstallation {
  /** Installation ID */
  id: string;
  /** Extension manifest */
  manifest: ExtensionManifest;
  /** Installation timestamp */
  installedAt: number;
  /** Last activation timestamp */
  lastActivatedAt?: number;
  /** Installation source path */
  sourcePath: string;
  /** Whether the extension is enabled */
  enabled: boolean;
  /** Custom configuration for this installation */
  config?: Record<string, unknown>;
}

/**
 * Registry event types
 */
export type RegistryEvent =
  | { type: 'installed'; installation: ExtensionInstallation }
  | { type: 'uninstalled'; id: string; manifestId: string }
  | { type: 'enabled'; id: string }
  | { type: 'disabled'; id: string }
  | { type: 'updated'; installation: ExtensionInstallation };

/**
 * Registry event handler
 */
export type RegistryEventHandler = (event: RegistryEvent) => void;

/**
 * Extension Registry — centralized registry for all installed extensions
 */
export class ExtensionRegistry {
  private installations: Map<string, ExtensionInstallation> = new Map();
  private listeners: RegistryEventHandler[] = [];

  /**
   * Install an extension
   */
  install(
    manifest: ExtensionManifest,
    sourcePath: string,
    config?: Record<string, unknown>,
  ): ExtensionInstallation {
    const existing = this.findByManifestId(manifest.id);
    if (existing) {
      throw new Error(
        `Extension already installed: ${manifest.id} (${manifest.name}) at ${existing.sourcePath}`,
      );
    }

    const installation: ExtensionInstallation = {
      id: `inst-${generateId()}`,
      manifest,
      installedAt: timestamp(),
      sourcePath,
      enabled: true,
      config,
    };

    this.installations.set(installation.id, installation);
    this.emit({ type: 'installed', installation });

    return installation;
  }

  /**
   * Uninstall an extension by installation ID
   */
  uninstall(id: string): boolean {
    const installation = this.installations.get(id);
    if (!installation) {
      return false;
    }

    this.installations.delete(id);
    this.emit({ type: 'uninstalled', id, manifestId: installation.manifest.id });
    return true;
  }

  /**
   * Enable an extension
   */
  enable(id: string): boolean {
    const installation = this.installations.get(id);
    if (!installation) {
      return false;
    }

    installation.enabled = true;
    this.emit({ type: 'enabled', id });
    return true;
  }

  /**
   * Disable an extension
   */
  disable(id: string): boolean {
    const installation = this.installations.get(id);
    if (!installation) {
      return false;
    }

    installation.enabled = false;
    this.emit({ type: 'disabled', id });
    return true;
  }

  /**
   * Update an extension's manifest
   */
  update(id: string, manifest: ExtensionManifest): boolean {
    const installation = this.installations.get(id);
    if (!installation) {
      return false;
    }

    installation.manifest = manifest;
    installation.manifest.updatedAt = timestamp();
    this.emit({ type: 'updated', installation });
    return true;
  }

  /**
   * Get all installations
   */
  getAll(): ExtensionInstallation[] {
    return Array.from(this.installations.values());
  }

  /**
   * Get all enabled installations
   */
  getEnabled(): ExtensionInstallation[] {
    return this.getAll().filter((i) => i.enabled);
  }

  /**
   * Get installation by ID
   */
  get(id: string): ExtensionInstallation | undefined {
    return this.installations.get(id);
  }

  /**
   * Find installations by type
   */
  findByType(type: ExtensionType): ExtensionInstallation[] {
    return this.getAll().filter((i) => i.manifest.type === type);
  }

  /**
   * Find installations by visibility
   */
  findByVisibility(visibility: ExtensionVisibility): ExtensionInstallation[] {
    return this.getAll().filter((i) => i.manifest.visibility === visibility);
  }

  /**
   * Find installations by tag
   */
  findByTag(tag: string): ExtensionInstallation[] {
    return this.getAll().filter((i) => i.manifest.tags.includes(tag));
  }

  /**
   * Search installations by name or description
   */
  search(query: string): ExtensionInstallation[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (i) =>
        i.manifest.name.toLowerCase().includes(lower) ||
        i.manifest.description.toLowerCase().includes(lower) ||
        i.manifest.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  /**
   * Get count of installed extensions
   */
  get count(): number {
    return this.installations.size;
  }

  /**
   * Subscribe to registry events
   */
  subscribe(handler: RegistryEventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: RegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Silently handle listener errors
      }
    }
  }

  /**
   * Find installation by manifest ID
   */
  private findByManifestId(manifestId: string): ExtensionInstallation | undefined {
    return this.getAll().find((i) => i.manifest.id === manifestId);
  }
}
