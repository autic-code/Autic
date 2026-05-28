/**
 * Release Channels — manages release channel isolation,
 * version management, and safe update support.
 */

import { EventEmitter } from 'events';
import { timestamp } from '@autic/shared';

/**
 * Release channel types
 */
export type ReleaseChannel = 'stable' | 'beta' | 'dev';

/**
 * Release version information
 */
export interface ReleaseVersion {
  /** Semantic version string */
  version: string;
  /** Release channel */
  channel: ReleaseChannel;
  /** Release date */
  releasedAt: number;
  /** Release notes */
  notes?: string;
  /** Whether this release is the latest in its channel */
  latest: boolean;
  /** Minimum version that can upgrade to this version */
  minUpgradableVersion?: string;
  /** Breaking changes summary */
  breakingChanges?: string[];
  /** New features summary */
  features?: string[];
  /** Bug fixes summary */
  fixes?: string[];
}

/**
 * Release channel configuration
 */
export interface ReleaseChannelConfig {
  /** Current channel */
  channel: ReleaseChannel;
  /** Whether to receive beta updates when on stable */
  optInBeta: boolean;
  /** Whether to receive dev updates when on beta */
  optInDev: boolean;
  /** Whether to auto-update to latest patch */
  autoUpdatePatch: boolean;
  /** Whether to auto-update to latest minor */
  autoUpdateMinor: boolean;
  /** Whether to skip major version upgrades */
  skipMajorUpgrades: boolean;
}

/**
 * Update availability check result
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Current version */
  currentVersion: string;
  /** Latest available version in current channel */
  latestVersion?: ReleaseVersion;
  /** All available versions in current channel */
  availableVersions: ReleaseVersion[];
  /** Recommended action */
  recommendation?: string;
}

/**
 * Update candidate
 */
export interface UpdateCandidate {
  /** Target version */
  version: ReleaseVersion;
  /** Whether update is safe */
  safe: boolean;
  /** Reasons for safety determination */
  reasons: string[];
  /** Migration notes */
  migrationNotes?: string;
}

/**
 * Default release channel config
 */
const DEFAULT_CHANNEL_CONFIG: ReleaseChannelConfig = {
  channel: 'stable',
  optInBeta: false,
  optInDev: false,
  autoUpdatePatch: true,
  autoUpdateMinor: false,
  skipMajorUpgrades: true,
};

/**
 * Release Channel Manager
 */
export class ReleaseChannelManager extends EventEmitter {
  private versions: Map<string, ReleaseVersion> = new Map();
  private config: ReleaseChannelConfig;
  private currentVersion: string;

  constructor(currentVersion: string = '0.1.0', config?: Partial<ReleaseChannelConfig>) {
    super();
    this.currentVersion = currentVersion;
    this.config = { ...DEFAULT_CHANNEL_CONFIG, ...config };
  }

  /**
   * Register a release version
   */
  registerRelease(
    version: string,
    channel: ReleaseChannel,
    options?: {
      notes?: string;
      breakingChanges?: string[];
      features?: string[];
      fixes?: string[];
      minUpgradableVersion?: string;
    },
  ): ReleaseVersion {
    const release: ReleaseVersion = {
      version,
      channel,
      releasedAt: timestamp(),
      latest: true,
      notes: options?.notes,
      breakingChanges: options?.breakingChanges,
      features: options?.features,
      fixes: options?.fixes,
      minUpgradableVersion: options?.minUpgradableVersion,
    };

    // Mark previous releases in same channel as not latest
    for (const [, existing] of this.versions) {
      if (existing.channel === channel) {
        existing.latest = false;
      }
    }

    this.versions.set(`${channel}-${version}`, release);
    this.emit('releaseRegistered', { version, channel });
    return release;
  }

  /**
   * Check for available updates
   */
  checkForUpdates(): UpdateCheckResult {
    const currentChannel = this.config.channel;
    const available: ReleaseVersion[] = [];

    // Collect versions from current and opted-in channels
    const channels: ReleaseChannel[] = [currentChannel];
    if (currentChannel === 'stable' && this.config.optInBeta) {
      channels.push('beta');
    }
    if (currentChannel !== 'dev' && this.config.optInDev) {
      channels.push('dev');
    }

    for (const [, version] of this.versions) {
      if (channels.includes(version.channel)) {
        available.push(version);
      }
    }

    // Sort by version (descending)
    available.sort((a, b) => this.compareVersions(b.version, a.version));

    const latest = available[0];

    return {
      updateAvailable: latest
        ? this.compareVersions(latest.version, this.currentVersion) > 0
        : false,
      currentVersion: this.currentVersion,
      latestVersion: latest,
      availableVersions: available,
      recommendation: this.getUpdateRecommendation(latest),
    };
  }

  /**
   * Get update candidates for current version
   */
  getUpdateCandidates(): UpdateCandidate[] {
    const candidates: UpdateCandidate[] = [];

    for (const [, version] of this.versions) {
      if (this.compareVersions(version.version, this.currentVersion) <= 0) {
        continue;
      }

      const reasons: string[] = [];
      let safe = true;

      // Check channel eligibility
      if (!this.isChannelEligible(version.channel)) {
        reasons.push(`Channel ${version.channel} not eligible`);
        safe = false;
      }

      // Check min upgradable version
      if (version.minUpgradableVersion) {
        if (this.compareVersions(this.currentVersion, version.minUpgradableVersion) < 0) {
          reasons.push(
            `Current version ${this.currentVersion} is below minimum ${version.minUpgradableVersion}`,
          );
          safe = false;
        }
      }

      // Major version check
      if (this.config.skipMajorUpgrades) {
        const [currentMajor] = this.currentVersion.split('.').map(Number);
        const [targetMajor] = version.version.split('.').map(Number);
        if (targetMajor > currentMajor) {
          reasons.push(`Major version upgrade (${currentMajor} → ${targetMajor}) skipped`);
          safe = false;
        }
      }

      // Check breaking changes
      if (version.breakingChanges?.length) {
        reasons.push(`Contains ${version.breakingChanges.length} breaking change(s)`);
      }

      candidates.push({
        version,
        safe,
        reasons,
        migrationNotes: safe
          ? undefined
          : `Manual migration may be required for ${version.version}`,
      });
    }

    return candidates.sort((a, b) => this.compareVersions(b.version.version, a.version.version));
  }

  /**
   * Apply an update (switch current version)
   */
  applyUpdate(version: string): boolean {
    const found = Array.from(this.versions.values()).find((v) => v.version === version);
    if (!found) return false;

    this.currentVersion = version;
    this.emit('updateApplied', { version, channel: found.channel });
    return true;
  }

  /**
   * Switch release channels
   */
  switchChannel(channel: ReleaseChannel): void {
    this.config.channel = channel;
    this.emit('channelSwitched', { channel });
  }

  /**
   * Get current configuration
   */
  getConfig(): ReleaseChannelConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReleaseChannelConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Get all registered releases
   */
  getAllReleases(): ReleaseVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * Get releases by channel
   */
  getReleasesByChannel(channel: ReleaseChannel): ReleaseVersion[] {
    return this.getAllReleases().filter((r) => r.channel === channel);
  }

  /**
   * Get the latest version in a channel
   */
  getLatestInChannel(channel: ReleaseChannel): ReleaseVersion | undefined {
    const channelReleases = this.getReleasesByChannel(channel);
    return channelReleases.find((r) => r.latest);
  }

  /**
   * Check if a channel is eligible given current config
   */
  private isChannelEligible(channel: ReleaseChannel): boolean {
    const current = this.config.channel;

    if (channel === current) return true;
    if (current === 'stable') {
      if (channel === 'beta' && this.config.optInBeta) return true;
      if (channel === 'dev' && this.config.optInDev) return true;
    }
    if (current === 'beta') {
      if (channel === 'dev' && this.config.optInDev) return true;
    }

    return false;
  }

  /**
   * Get update recommendation
   */
  private getUpdateRecommendation(latest?: ReleaseVersion): string | undefined {
    if (!latest) return undefined;

    const cmp = this.compareVersions(latest.version, this.currentVersion);
    if (cmp <= 0) return 'Up to date';

    const candidates = this.getUpdateCandidates();
    const safeCandidates = candidates.filter((c) => c.safe);

    if (safeCandidates.length > 0) {
      return `Update available: ${this.currentVersion} → ${safeCandidates[0].version.version} (${safeCandidates[0].version.channel})`;
    }

    return `Update available but requires manual migration: ${this.currentVersion} → ${latest.version}`;
  }

  /**
   * Compare semantic versions
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
}
