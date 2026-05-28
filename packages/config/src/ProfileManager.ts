/**
 * ProfileManager — Developer profile system.
 *
 * Provides presets (SAFE, BALANCED, FULL_AUTO, LOCAL_ONLY) that map to
 * runtime policies: provider restrictions, execution behavior overrides,
 * permission policy integration.
 */

import { ConfigManager } from './ConfigManager.js';
import type { DeveloperProfile, ProfileConfig } from '@autic/shared';

export class ProfileManager {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /** Get current active profile */
  getCurrentProfile(): DeveloperProfile {
    return this.configManager.getProfile();
  }

  /** Get full profile config for the active profile */
  getCurrentProfileConfig(): ProfileConfig {
    return this.configManager.getProfileConfig();
  }

  /** Get all available profile presets */
  getAvailableProfiles(): ProfileConfig[] {
    return this.configManager.getProfilePresets();
  }

  /** Get profile config for a specific preset */
  getProfileConfig(profile: DeveloperProfile): ProfileConfig {
    return this.configManager.getProfileConfigFor(profile);
  }

  /** Set global profile */
  async setProfile(profile: DeveloperProfile): Promise<void> {
    await this.configManager.setProfile(profile);
  }

  /** Set workspace-specific profile override */
  async setWorkspaceProfile(profile: DeveloperProfile): Promise<void> {
    await this.configManager.setWorkspaceProfile(profile);
  }

  /** Get profile description */
  getProfileDescription(profile: DeveloperProfile): string {
    return this.configManager.getProfileConfigFor(profile).description;
  }

  /** Check if cloud providers are allowed under current profile */
  cloudProvidersAllowed(): boolean {
    return this.getCurrentProfileConfig().allowCloudProviders;
  }

  /** Check if local providers are allowed */
  localProvidersAllowed(): boolean {
    return this.getCurrentProfileConfig().allowLocalProviders;
  }

  /** Check if telemetry is enabled */
  telemetryEnabled(): boolean {
    return this.getCurrentProfileConfig().telemetryEnabled;
  }

  /** Get max execution depth for current profile */
  getMaxExecutionDepth(): number {
    return this.getCurrentProfileConfig().maxExecutionDepth;
  }

  /** Get workflow timeout for current profile */
  getWorkflowTimeoutMs(): number {
    return this.getCurrentProfileConfig().workflowTimeoutMs;
  }
}
