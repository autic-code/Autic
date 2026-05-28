/**
 * Extension Manifest — metadata and validation for Autic extensions.
 *
 * Every extension must declare a manifest with identity, lifecycle hooks,
 * permission requirements, and version compatibility.
 */

import { generateId, timestamp } from '@autic/shared';

/**
 * Extension visibility scope
 */
export type ExtensionVisibility = 'public' | 'private' | 'local';

/**
 * Extension type classification
 */
export type ExtensionType = 'plugin' | 'skill' | 'provider' | 'hook' | 'theme' | 'tool';

/**
 * Extension lifecycle stage
 */
export type ExtensionLifecycleStage =
  | 'registered'
  | 'loaded'
  | 'validated'
  | 'activated'
  | 'running'
  | 'deactivated'
  | 'unloaded'
  | 'error';

/**
 * Permission scope for an extension
 */
export interface ExtensionPermission {
  /** Permission identifier (e.g., 'filesystem:read', 'network:connect') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Whether this permission is required or optional */
  required: boolean;
}

/**
 * Version compatibility constraints
 */
export interface VersionCompatibility {
  /** Minimum Autic runtime version required */
  minRuntimeVersion: string;
  /** Maximum Autic runtime version supported (optional) */
  maxRuntimeVersion?: string;
  /** Compatible extension API versions */
  apiVersions: string[];
  /** Tested platform architectures */
  platforms?: string[];
}

/**
 * Extension manifest — the identity and contract of an extension
 */
export interface ExtensionManifest {
  /** Unique extension ID */
  id: string;
  /** Extension name */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Extension type */
  type: ExtensionType;
  /** Author information */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Visibility scope */
  visibility: ExtensionVisibility;
  /** License identifier */
  license?: string;
  /** Entry point module path */
  entryPoint: string;
  /** Permission requirements */
  permissions: ExtensionPermission[];
  /** Version compatibility */
  compatibility: VersionCompatibility;
  /** Optional icon or logo URL */
  icon?: string;
  /** Tags for discovery */
  tags: string[];
  /** Repository URL */
  repository?: string;
  /** Documentation URL */
  documentation?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Create a new extension manifest with defaults
 */
export function createManifest(params: {
  name: string;
  version: string;
  description: string;
  type: ExtensionType;
  entryPoint: string;
  permissions?: ExtensionPermission[];
  compatibility?: Partial<VersionCompatibility>;
  tags?: string[];
}): ExtensionManifest {
  const now = timestamp();
  return {
    id: `ext-${generateId()}`,
    name: params.name,
    version: params.version,
    description: params.description,
    type: params.type,
    visibility: 'local',
    entryPoint: params.entryPoint,
    permissions: params.permissions ?? [],
    compatibility: {
      minRuntimeVersion: params.compatibility?.minRuntimeVersion ?? '0.1.0',
      maxRuntimeVersion: params.compatibility?.maxRuntimeVersion,
      apiVersions: params.compatibility?.apiVersions ?? ['1.0.0'],
      platforms: params.compatibility?.platforms ?? ['linux', 'darwin', 'win32'],
    },
    tags: params.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate an extension manifest for completeness and correctness
 */
export function validateManifest(
  manifest: Partial<ExtensionManifest>,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest.name?.trim()) {
    errors.push('Extension name is required');
  }
  if (!manifest.version?.trim()) {
    errors.push('Extension version is required');
  }
  if (!manifest.description?.trim()) {
    errors.push('Extension description is required');
  }
  if (!manifest.type) {
    errors.push('Extension type is required');
  }
  if (!manifest.entryPoint?.trim()) {
    errors.push('Extension entry point is required');
  }

  // Validate semantic version format
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Version must be semantic (e.g., 1.0.0)');
  }

  // Validate permissions
  if (manifest.permissions?.length) {
    const required = manifest.permissions.filter((p) => p.required);
    if (required.length > 20) {
      warnings.push(`Extension requires ${required.length} permissions — consider reducing scope`);
    }
  }

  // Validate compatibility
  if (manifest.compatibility) {
    if (!manifest.compatibility.minRuntimeVersion) {
      errors.push('Minimum runtime version is required');
    }
    if (!manifest.compatibility.apiVersions?.length) {
      errors.push('At least one API version must be specified');
    }
  } else {
    warnings.push('No version compatibility declared — assuming latest runtime');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
