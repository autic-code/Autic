/**
 * Version Compatibility Checker — validates runtime, plugin,
 * and API version compatibility to prevent ecosystem breakage.
 */

/**
 * Compatibility check result
 */
export interface CompatibilityCheckResult {
  /** Whether the versions are compatible */
  compatible: boolean;
  /** Detailed messages */
  messages: string[];
  /** Severity level */
  severity: 'compatible' | 'warning' | 'incompatible';
  /** Recommended action */
  recommendation?: string;
}

/**
 * Compatibility check configuration
 */
export interface CompatibilityCheckConfig {
  /** Whether to enforce strict version matching */
  strict: boolean;
  /** Allow minor version bumps (e.g., 1.1.0 → 1.2.0) */
  allowMinorBumps: boolean;
  /** Allow patch version bumps (e.g., 1.1.0 → 1.1.1) */
  allowPatchBumps: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CompatibilityCheckConfig = {
  strict: false,
  allowMinorBumps: true,
  allowPatchBumps: true,
};

/**
 * Version Compatibility Checker
 */
export class VersionCompatibilityChecker {
  private config: CompatibilityCheckConfig;

  constructor(config?: Partial<CompatibilityCheckConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check extension compatibility with the current runtime version
   */
  checkExtensionCompatibility(
    _extensionVersion: string,
    minRuntimeVersion: string,
    maxRuntimeVersion?: string,
  ): CompatibilityCheckResult {
    const messages: string[] = [];
    const currentRuntime = '0.1.0'; // Current Autic runtime version

    // Check minimum runtime version
    const minCmp = this.compareVersions(currentRuntime, minRuntimeVersion);
    if (minCmp < 0) {
      const msg = `Runtime ${currentRuntime} is older than minimum required ${minRuntimeVersion}`;
      messages.push(msg);
      return {
        compatible: false,
        messages,
        severity: 'incompatible',
        recommendation: `Upgrade Autic to version ${minRuntimeVersion} or later`,
      };
    }

    // Check maximum runtime version
    if (maxRuntimeVersion) {
      const maxCmp = this.compareVersions(currentRuntime, maxRuntimeVersion);
      if (maxCmp > 0) {
        const msg = `Runtime ${currentRuntime} is newer than maximum supported ${maxRuntimeVersion}`;
        messages.push(msg);
        return {
          compatible: false,
          messages,
          severity: 'incompatible',
          recommendation: `Downgrade Autic to version ${maxRuntimeVersion} or upgrade the extension`,
        };
      }
    }

    messages.push(`Extension compatible with runtime ${currentRuntime}`);
    return {
      compatible: true,
      messages,
      severity: 'compatible',
    };
  }

  /**
   * Check API version compatibility
   */
  checkAPICompatibility(
    declaredVersions: string[],
    requiredVersion: string,
  ): CompatibilityCheckResult {
    const messages: string[] = [];

    // Check exact match
    if (declaredVersions.includes(requiredVersion)) {
      messages.push(`API version ${requiredVersion} is compatible`);
      return {
        compatible: true,
        messages,
        severity: 'compatible',
      };
    }

    // Check with version bump allowances
    for (const declared of declaredVersions) {
      const cmp = this.compareVersions(declared, requiredVersion);

      if (cmp === 0) {
        messages.push(`API version ${requiredVersion} is compatible`);
        return { compatible: true, messages, severity: 'compatible' };
      }

      if (this.config.allowMinorBumps || this.config.allowPatchBumps) {
        const [declMajor, declMinor] = declared.split('.').map(Number);
        const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number);

        if (declMajor === reqMajor) {
          if (this.config.allowMinorBumps && declMinor > reqMinor) {
            messages.push(
              `API version ${declared} is compatible with ${requiredVersion} (minor bump allowed)`,
            );
            return { compatible: true, messages, severity: 'compatible' };
          }

          if (this.config.allowPatchBumps && declMinor === reqMinor) {
            messages.push(
              `API version ${declared} is compatible with ${requiredVersion} (patch bump allowed)`,
            );
            return { compatible: true, messages, severity: 'compatible' };
          }
        }
      }
    }

    // Strict mode check
    if (this.config.strict) {
      messages.push(
        `API version ${requiredVersion} is not in declared versions: ${declaredVersions.join(', ')}`,
      );
      return {
        compatible: false,
        messages,
        severity: 'incompatible',
        recommendation: `Update extension to support API version ${requiredVersion}`,
      };
    }

    messages.push(
      `Warning: API version ${requiredVersion} not explicitly declared`,
    );
    return {
      compatible: true,
      messages,
      severity: 'warning',
      recommendation: 'Consider declaring API version compatibility in extension manifest',
    };
  }

  /**
   * Check plugin compatibility
   */
  checkPluginCompatibility(
    pluginVersion: string,
    apiVersion: string,
  ): CompatibilityCheckResult {
    const messages: string[] = [];

    if (!pluginVersion || !apiVersion) {
      return {
        compatible: false,
        messages: ['Plugin version or API version not specified'],
        severity: 'incompatible',
        recommendation: 'Add version metadata to plugin manifest',
      };
    }

    // Check major version alignment
    const [pluginMajor] = pluginVersion.split('.').map(Number);
    const [apiMajor] = apiVersion.split('.').map(Number);

    if (pluginMajor !== apiMajor) {
      messages.push(
        `Plugin major version ${pluginMajor} does not match API major version ${apiMajor}`,
      );
      return {
        compatible: false,
        messages,
        severity: 'incompatible',
        recommendation: `Update plugin to API version ${apiVersion} or downgrade to compatible version`,
      };
    }

    messages.push(
      `Plugin ${pluginVersion} compatible with API ${apiVersion}`,
    );
    return {
      compatible: true,
      messages,
      severity: 'compatible',
    };
  }

  /**
   * Simple semver comparison (returns negative if a < b, positive if a > b, 0 if equal)
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aNum = aParts[i] ?? 0;
      const bNum = bParts[i] ?? 0;
      if (aNum !== bNum) return aNum - bNum;
    }

    return 0;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<CompatibilityCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
