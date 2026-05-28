/**
 * TrustProfileSystem — Configurable trust profiles for autonomous execution.
 *
 * Profiles map to permission policies:
 *   SAFE      — Read-only operations, all writes/changes require approval
 *   BALANCED  — Common operations auto-approved, dangerous actions require approval
 *   FULL_AUTO — Full autonomous execution with safety boundaries
 *
 * Security systems remain active regardless of profile.
 */

import {
  type TrustProfile,
  type TrustProfileConfig,
  type RiskLevel,
  type PermissionApprovalRequest,
} from '@autic/shared';

/** Built-in trust profile configurations */
const PROFILE_CONFIGS: Record<TrustProfile, TrustProfileConfig> = {
  safe: {
    profile: 'safe',
    allowDangerousCommands: false,
    requireApprovalForMedium: true,
    autoApproveLowRisk: true,
    maxExecutionDepth: 20,
    workflowTimeoutMs: 120_000,
    allowedActions: ['read_file', 'list_files', 'search_files', 'cat', 'ls', 'grep', 'head', 'tail', 'wc'],
    blockedActions: [
      'rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown',
      'write_file', 'delete_file', 'create_file',
      'install', 'npm publish', 'git push', 'git commit',
      'docker', 'curl', 'wget', 'ssh', 'sudo',
    ],
  },
  balanced: {
    profile: 'balanced',
    allowDangerousCommands: false,
    requireApprovalForMedium: true,
    autoApproveLowRisk: true,
    maxExecutionDepth: 50,
    workflowTimeoutMs: 300_000,
    allowedActions: ['*'],
    blockedActions: [
      'rm -rf', 'rmdir /', 'chmod 777', 'chown -R',
      'npm publish', 'pnpm publish', 'docker',
      'sudo', 'su', 'passwd',
      '> /dev/', 'mkfs', 'dd if=',
    ],
  },
  full_auto: {
    profile: 'full_auto',
    allowDangerousCommands: true,
    requireApprovalForMedium: false,
    autoApproveLowRisk: true,
    maxExecutionDepth: 100,
    workflowTimeoutMs: 600_000,
    allowedActions: ['*'],
    blockedActions: [
      'sudo', 'su', 'passwd', 'chmod 777',
      '> /dev/', 'mkfs', 'dd if=',
    ],
  },
};

export class TrustProfileSystem {
  private currentProfile: TrustProfileConfig;
  private profileName: TrustProfile;

  constructor(initialProfile: TrustProfile = 'balanced') {
    this.profileName = initialProfile;
    this.currentProfile = { ...PROFILE_CONFIGS[initialProfile] };
  }

  /**
   * Set the active trust profile.
   */
  setProfile(profile: TrustProfile): void {
    this.profileName = profile;
    this.currentProfile = { ...PROFILE_CONFIGS[profile] };
  }

  /**
   * Get the current trust profile configuration.
   */
  getConfig(): TrustProfileConfig {
    return { ...this.currentProfile };
  }

  /**
   * Get the current profile name.
   */
  getProfile(): TrustProfile {
    return this.profileName;
  }

  /**
   * Check if an action is allowed by the current trust profile.
   */
  isActionAllowed(action: string): boolean {
    // Check blocked actions first
    for (const blocked of this.currentProfile.blockedActions) {
      if (action.includes(blocked)) return false;
    }

    // Check allowed actions
    if (this.currentProfile.allowedActions.includes('*')) return true;
    for (const allowed of this.currentProfile.allowedActions) {
      if (action.startsWith(allowed)) return true;
    }

    return false;
  }

  /**
   * Evaluate an action for approval based on trust profile and risk level.
   */
  evaluateAction(params: {
    action: string;
    resource: string;
    riskLevel: RiskLevel;
  }): PermissionApprovalRequest {
    const { action, riskLevel } = params;
    const isAllowed = this.isActionAllowed(action);

    if (!isAllowed) {
      return {
        action,
        resource: params.resource,
        riskLevel,
        reason: `Action blocked by ${this.profileName} trust profile`,
        trustProfile: this.profileName,
        autoApproved: false,
        requiresUserInput: true,
      };
    }

    // Auto-approve low-risk actions
    if (riskLevel === 'low' && this.currentProfile.autoApproveLowRisk) {
      return {
        action,
        resource: params.resource,
        riskLevel,
        reason: `Auto-approved (low risk, ${this.profileName} profile)`,
        trustProfile: this.profileName,
        autoApproved: true,
        requiresUserInput: false,
      };
    }

    // Medium risk requires approval in safe mode
    if (riskLevel === 'medium' && this.currentProfile.requireApprovalForMedium) {
      return {
        action,
        resource: params.resource,
        riskLevel,
        reason: `Medium risk action requires approval in ${this.profileName} mode`,
        trustProfile: this.profileName,
        autoApproved: false,
        requiresUserInput: true,
      };
    }

    // Full auto mode auto-approves everything that's not blocked
    if (this.profileName === 'full_auto' && isAllowed) {
      return {
        action,
        resource: params.resource,
        riskLevel,
        reason: `Auto-approved (full_auto profile)`,
        trustProfile: this.profileName,
        autoApproved: true,
        requiresUserInput: false,
      };
    }

    // Default: require approval for medium+ risk in balanced mode
    return {
      action,
      resource: params.resource,
      riskLevel,
      reason: `Requires approval (${riskLevel} risk, ${this.profileName} profile)`,
      trustProfile: this.profileName,
      autoApproved: false,
      requiresUserInput: riskLevel === 'high',
    };
  }

  /**
   * Get a list of profiles with descriptions.
   */
  static getProfileDescriptions(): Array<{
    name: TrustProfile;
    description: string;
    allowDangerous: boolean;
  }> {
    return [
      {
        name: 'safe',
        description: 'Read-only operations, all writes/changes require approval',
        allowDangerous: false,
      },
      {
        name: 'balanced',
        description: 'Common operations auto-approved, dangerous actions require approval',
        allowDangerous: false,
      },
      {
        name: 'full_auto',
        description: 'Full autonomous execution with safety boundaries',
        allowDangerous: true,
      },
    ];
  }
}
