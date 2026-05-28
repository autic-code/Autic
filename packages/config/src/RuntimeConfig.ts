/**
 * RuntimeConfig — provides typed access to resolved runtime configuration.
 * Built on top of ConfigManager with convenience getters.
 */

import { ConfigManager } from './ConfigManager.js';
import type {
  RuntimePreferences,
  DeveloperProfile,
  ProfileConfig,
  SafetyConfig,
} from '@autic/shared';

export class RuntimeConfig {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /** Get typed runtime preferences */
  get preferences(): RuntimePreferences {
    return this.configManager.getPreferences();
  }

  /** Get current profile */
  get profile(): DeveloperProfile {
    return this.configManager.getProfile();
  }

  /** Get full profile config */
  get profileConfig(): ProfileConfig {
    return this.configManager.getProfileConfig();
  }

  /** Derive safety config from current profile */
  get safetyConfig(): SafetyConfig {
    const profile = this.profileConfig;
    return {
      maxExecutionDepth: profile.maxExecutionDepth,
      maxWorkflowRetries: 3,
      maxStepRetries: 2,
      workflowTimeoutMs: profile.workflowTimeoutMs,
      stepTimeoutMs: 60000,
      allowDangerousActions: profile.allowDangerousCommands,
      requirePermissionForHighRisk: !profile.autoApproveLowRisk,
      maxConsecutiveFailures: 5,
    };
  }

  /** Whether verbose mode is enabled */
  get verbose(): boolean {
    return this.preferences.verbose || this.preferences.logLevel === 'verbose';
  }

  /** Whether debug mode is enabled */
  get debug(): boolean {
    return this.preferences.debug || this.preferences.logLevel === 'debug';
  }

  /** Get effective log level */
  get logLevel(): string {
    if (this.preferences.debug) return 'debug';
    if (this.preferences.verbose) return 'verbose';
    return this.preferences.logLevel;
  }

  /** Check if cloud providers are allowed */
  get cloudAllowed(): boolean {
    return this.profileConfig.allowCloudProviders;
  }

  /** Check if local providers are allowed */
  get localAllowed(): boolean {
    return this.profileConfig.allowLocalProviders;
  }
}
