/**
 * Permission Manager — manages scoped permissions for extensions.
 *
 * Extensions must declare required permissions in their manifest.
 * The PermissionManager validates and enforces these permissions
 * at runtime, preventing unauthorized operations.
 */

import { EventEmitter } from 'events';
import type { ExtensionPermission } from '../extension/ExtensionManifest.js';

/**
 * Predefined permission scopes
 */
export const PERMISSION_SCOPES = {
  FILESYSTEM_READ: { name: 'filesystem:read', description: 'Read files from workspace', required: false },
  FILESYSTEM_WRITE: { name: 'filesystem:write', description: 'Write files to workspace', required: false },
  FILESYSTEM_DELETE: { name: 'filesystem:delete', description: 'Delete files from workspace', required: false },
  NETWORK_CONNECT: { name: 'network:connect', description: 'Make outbound network connections', required: false },
  NETWORK_SERVE: { name: 'network:serve', description: 'Start a local network server', required: false },
  EXECUTE_COMMAND: { name: 'execute:command', description: 'Execute shell commands', required: false },
  PROVIDER_ACCESS: { name: 'provider:access', description: 'Access LLM providers', required: false },
  PROVIDER_MANAGE: { name: 'provider:manage', description: 'Add/remove providers', required: false },
  VAULT_ACCESS: { name: 'vault:access', description: 'Access encrypted vault', required: false },
  VAULT_MANAGE: { name: 'vault:manage', description: 'Modify vault contents', required: false },
  SESSION_ACCESS: { name: 'session:access', description: 'Access session data', required: false },
  SESSION_MANAGE: { name: 'session:manage', description: 'Create/delete sessions', required: false },
  CONFIG_READ: { name: 'config:read', description: 'Read configuration', required: false },
  CONFIG_WRITE: { name: 'config:write', description: 'Modify configuration', required: false },
  EXTENSION_MANAGE: { name: 'extension:manage', description: 'Install/uninstall extensions', required: false },
  INTERNAL: { name: 'internal:*', description: 'Full internal access (trusted extensions only)', required: false },
} as const;

/**
 * Permission check result
 */
export interface PermissionCheck {
  /** Whether the permission is granted */
  granted: boolean;
  /** Permission name */
  permission: string;
  /** Extension ID */
  extensionId: string;
  /** Reason for denial */
  reason?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Permission scope configuration
 */
export interface PermissionScope {
  /** Extension ID */
  extensionId: string;
  /** Granted permissions */
  granted: Set<string>;
  /** Denied permissions */
  denied: Set<string>;
  /** Whether this extension is fully trusted */
  trusted: boolean;
}

/**
 * Permission manager configuration
 */
export interface PermissionManagerConfig {
  /** Whether to require explicit permission grants (default: true) */
  requireExplicitGrants: boolean;
  /** Whether to allow trusted extensions full access (default: true) */
  allowTrustedFullAccess: boolean;
  /** Maximum number of permissions per extension (default: 50) */
  maxPermissionsPerExtension: number;
}

/**
 * Default permission manager configuration
 */
const DEFAULT_CONFIG: PermissionManagerConfig = {
  requireExplicitGrants: true,
  allowTrustedFullAccess: true,
  maxPermissionsPerExtension: 50,
};

/**
 * Permission Manager — enforces scoped permissions for extensions
 */
export class PermissionManager extends EventEmitter {
  private scopes: Map<string, PermissionScope> = new Map();
  private config: PermissionManagerConfig;

  constructor(config?: Partial<PermissionManagerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an extension's permission scopes
   */
  registerExtension(
    extensionId: string,
    permissions: ExtensionPermission[],
  ): void {
    if (this.scopes.has(extensionId)) {
      throw new Error(`Extension already registered: ${extensionId}`);
    }

    const granted = new Set<string>();

    for (const perm of permissions) {
      if (perm.required || !this.config.requireExplicitGrants) {
        granted.add(perm.name);
      }
    }

    const scope: PermissionScope = {
      extensionId,
      granted,
      denied: new Set(),
      trusted: false,
    };

    this.scopes.set(extensionId, scope);
    this.emit('registered', { extensionId, granted: Array.from(granted) });
  }

  /**
   * Check if an extension has a specific permission
   */
  checkPermission(extensionId: string, permission: string): PermissionCheck {
    const scope = this.scopes.get(extensionId);
    const now = Date.now();

    if (!scope) {
      return {
        granted: false,
        permission,
        extensionId,
        reason: 'Extension not registered',
        timestamp: now,
      };
    }

    // Trusted extensions get full access
    if (this.config.allowTrustedFullAccess && scope.trusted) {
      return {
        granted: true,
        permission,
        extensionId,
        timestamp: now,
      };
    }

    // Check explicit denial
    if (scope.denied.has(permission)) {
      const check: PermissionCheck = {
        granted: false,
        permission,
        extensionId,
        reason: 'Permission explicitly denied',
        timestamp: now,
      };
      this.emit('denied', check);
      return check;
    }

    // Check granted permissions
    // Also check wildcard permissions (e.g., 'internal:*')
    const isGranted =
      scope.granted.has(permission) ||
      scope.granted.has('internal:*') ||
      Array.from(scope.granted).some((g) => {
        if (g.endsWith(':*')) {
          const prefix = g.slice(0, -2);
          return permission.startsWith(prefix);
        }
        return false;
      });

    if (!isGranted && this.config.requireExplicitGrants) {
      const check: PermissionCheck = {
        granted: false,
        permission,
        extensionId,
        reason: 'Permission not granted',
        timestamp: now,
      };
      this.emit('denied', check);
      return check;
    }

    return {
      granted: true,
      permission,
      extensionId,
      timestamp: now,
    };
  }

  /**
   * Grant a permission to an extension
   */
  grantPermission(extensionId: string, permission: string): boolean {
    const scope = this.scopes.get(extensionId);
    if (!scope) return false;

    if (scope.granted.size >= this.config.maxPermissionsPerExtension) {
      return false;
    }

    scope.granted.add(permission);
    scope.denied.delete(permission);
    this.emit('granted', { extensionId, permission });
    return true;
  }

  /**
   * Deny a permission for an extension
   */
  denyPermission(extensionId: string, permission: string): boolean {
    const scope = this.scopes.get(extensionId);
    if (!scope) return false;

    scope.denied.add(permission);
    scope.granted.delete(permission);
    this.emit('denied', { extensionId, permission });
    return true;
  }

  /**
   * Mark an extension as trusted (bypasses permission checks)
   */
  setTrusted(extensionId: string, trusted: boolean): boolean {
    const scope = this.scopes.get(extensionId);
    if (!scope) return false;

    scope.trusted = trusted;
    this.emit('trustChanged', { extensionId, trusted });
    return true;
  }

  /**
   * Get an extension's permission scope
   */
  getScope(extensionId: string): PermissionScope | undefined {
    return this.scopes.get(extensionId);
  }

  /**
   * Remove an extension's permissions
   */
  unregisterExtension(extensionId: string): boolean {
    return this.scopes.delete(extensionId);
  }

  /**
   * Get all registered scopes
   */
  getAllScopes(): PermissionScope[] {
    return Array.from(this.scopes.values());
  }

  /**
   * Get permission check history for an extension
   */
  getEffectivePermissions(extensionId: string): {
    granted: string[];
    denied: string[];
    trusted: boolean;
  } {
    const scope = this.scopes.get(extensionId);
    if (!scope) {
      return { granted: [], denied: [], trusted: false };
    }
    return {
      granted: Array.from(scope.granted),
      denied: Array.from(scope.denied),
      trusted: scope.trusted,
    };
  }
}
