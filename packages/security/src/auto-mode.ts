/**
 * AutoModeFoundation — Configurable autonomy levels for the runtime.
 *
 * Modes:
 *   SAFE      — User must approve medium+ risk actions. Read-only by default.
 *   GUIDED    — Auto-approves low-risk, prompts for medium, blocks high unless allowed.
 *   FULL_AUTO — Auto-approves all non-blocked actions within safety boundaries.
 *
 * Security systems always remain active regardless of mode.
 */

import { type TrustProfile, type RiskLevel } from '@autic/shared';
import { SecurityEventSystem } from './security-events.js';
import { TrustProfileSystem } from './trust-profile.js';

export type AutoMode = 'safe' | 'guided' | 'full_auto';

export interface AutoModeConfig {
  mode: AutoMode;
  requireApprovalForAll: boolean;
  requireApprovalForWrite: boolean;
  autoApproveRead: boolean;
  maxConsecutiveAutoApprovals: number;
}

/** Map from auto mode to trust profile */
const MODE_TO_PROFILE: Record<AutoMode, TrustProfile> = {
  safe: 'safe',
  guided: 'balanced',
  full_auto: 'full_auto',
};

const MODE_CONFIGS: Record<AutoMode, AutoModeConfig> = {
  safe: {
    mode: 'safe',
    requireApprovalForAll: true,
    requireApprovalForWrite: true,
    autoApproveRead: true,
    maxConsecutiveAutoApprovals: 5,
  },
  guided: {
    mode: 'guided',
    requireApprovalForAll: false,
    requireApprovalForWrite: true,
    autoApproveRead: true,
    maxConsecutiveAutoApprovals: 20,
  },
  full_auto: {
    mode: 'full_auto',
    requireApprovalForAll: false,
    requireApprovalForWrite: false,
    autoApproveRead: true,
    maxConsecutiveAutoApprovals: 100,
  },
};

export class AutoModeManager {
  private currentMode: AutoMode;
  private config: AutoModeConfig;
  private trustProfile: TrustProfileSystem;
  private securityEvents: SecurityEventSystem;
  private consecutiveAutoApprovals = 0;

  constructor(initialMode: AutoMode = 'guided', securityEvents?: SecurityEventSystem) {
    this.currentMode = initialMode;
    this.config = { ...MODE_CONFIGS[initialMode] };
    this.trustProfile = new TrustProfileSystem(MODE_TO_PROFILE[initialMode]);
    this.securityEvents = securityEvents || new SecurityEventSystem();
  }

  /**
   * Set the auto mode and update trust profile accordingly.
   */
  setMode(mode: AutoMode): void {
    this.currentMode = mode;
    this.config = { ...MODE_CONFIGS[mode] };
    this.trustProfile.setProfile(MODE_TO_PROFILE[mode]);
    this.consecutiveAutoApprovals = 0;

    this.securityEvents.record({
      type: 'trust:escalated',
      severity: 'info',
      message: `Auto mode changed to: ${mode}`,
      details: { previousMode: this.currentMode, newMode: mode },
    });
  }

  /**
   * Get the current auto mode.
   */
  getMode(): AutoMode {
    return this.currentMode;
  }

  /**
   * Get the underlying trust profile system.
   */
  getTrustProfile(): TrustProfileSystem {
    return this.trustProfile;
  }

  /**
   * Get the security events system.
   */
  getSecurityEvents(): SecurityEventSystem {
    return this.securityEvents;
  }

  /**
   * Evaluate whether an action should be auto-approved or requires user input.
   */
  evaluateAction(params: { action: string; resource: string; riskLevel: RiskLevel }): {
    approved: boolean;
    requiresInput: boolean;
    reason: string;
  } {
    const { action, riskLevel } = params;

    // Check if action is blocked by trust profile
    const profileApproval = this.trustProfile.evaluateAction(params);
    if (!profileApproval.autoApproved && this.currentMode === 'safe') {
      return {
        approved: false,
        requiresInput: true,
        reason: profileApproval.reason,
      };
    }

    // Read operations are auto-approved in all modes
    if (riskLevel === 'low' && this.config.autoApproveRead) {
      this.consecutiveAutoApprovals++;
      return {
        approved: true,
        requiresInput: false,
        reason: `Auto-approved (read operation, ${this.currentMode} mode)`,
      };
    }

    // Safe mode requires approval for everything non-read
    if (this.currentMode === 'safe') {
      return {
        approved: false,
        requiresInput: true,
        reason: `Requires approval (safe mode): ${action} on ${params.resource}`,
      };
    }

    // Full auto: auto-approve everything within safety boundaries
    if (this.currentMode === 'full_auto') {
      this.consecutiveAutoApprovals++;

      // Record escalation warning for high-risk actions
      if (riskLevel === 'high') {
        this.securityEvents.record({
          type: 'permission:escalation',
          severity: 'warning',
          message: `High-risk action auto-approved in full_auto mode: ${action}`,
          action,
          resource: params.resource,
          details: { riskLevel },
        });
      }

      return {
        approved: true,
        requiresInput: false,
        reason: `Auto-approved (full_auto mode): ${action}`,
      };
    }

    // Guided mode: medium risk requires approval for write operations
    if (
      this.currentMode === 'guided' &&
      riskLevel === 'medium' &&
      this.config.requireApprovalForWrite
    ) {
      return {
        approved: false,
        requiresInput: true,
        reason: `Write operation requires approval (guided mode): ${action} on ${params.resource}`,
      };
    }

    // Guided mode: high risk always requires approval
    if (riskLevel === 'high') {
      return {
        approved: false,
        requiresInput: true,
        reason: `High-risk action requires approval: ${action} on ${params.resource}`,
      };
    }

    // Default: auto-approve
    this.consecutiveAutoApprovals++;
    return {
      approved: true,
      requiresInput: false,
      reason: `Auto-approved (${this.currentMode} mode): ${action}`,
    };
  }

  /**
   * Check if the consecutive auto-approval limit has been reached.
   * Used to periodically prompt user for confirmation.
   */
  hasReachedAutoApprovalLimit(): boolean {
    return this.consecutiveAutoApprovals >= this.config.maxConsecutiveAutoApprovals;
  }

  /**
   * Reset the consecutive auto-approval counter.
   */
  resetAutoApprovalCounter(): void {
    this.consecutiveAutoApprovals = 0;
  }

  /**
   * Get the current auto mode configuration.
   */
  getConfig(): AutoModeConfig {
    return { ...this.config };
  }

  /**
   * Get available modes with descriptions.
   */
  static getModeDescriptions(): Array<{
    name: AutoMode;
    description: string;
    trustProfile: TrustProfile;
  }> {
    return [
      {
        name: 'safe',
        description: 'User must approve medium+ risk actions. Read-only by default.',
        trustProfile: 'safe',
      },
      {
        name: 'guided',
        description: 'Auto-approves low-risk, prompts for medium, blocks high unless allowed.',
        trustProfile: 'balanced',
      },
      {
        name: 'full_auto',
        description: 'Auto-approves all non-blocked actions within safety boundaries.',
        trustProfile: 'full_auto',
      },
    ];
  }
}
