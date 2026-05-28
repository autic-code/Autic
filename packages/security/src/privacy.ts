/**
 * PrivacyMode — Local-only privacy isolation for the runtime.
 *
 * Provides:
 *   - offline mode (fully isolated, no outbound requests)
 *   - local_only mode (local providers only, no cloud)
 *   - normal mode (full connectivity)
 *
 * In privacy mode:
 *   - Cloud sync hooks are disabled
 *   - Telemetry is disabled
 *   - Only local providers (Ollama) are available
 *   - Outbound requests are blocked
 */

import { type PrivacyConfig } from '@autic/shared';
import { SecurityEventSystem } from './security-events.js';

export type PrivacyMode = 'offline' | 'local_only' | 'normal';

const PRIVACY_CONFIGS: Record<PrivacyMode, PrivacyConfig> = {
  offline: {
    mode: 'offline',
    disableTelemetry: true,
    disableCloudSync: true,
    restrictLocalProviders: true,
    blockOutboundRequests: true,
  },
  local_only: {
    mode: 'local_only',
    disableTelemetry: true,
    disableCloudSync: true,
    restrictLocalProviders: false,
    blockOutboundRequests: true,
  },
  normal: {
    mode: 'normal',
    disableTelemetry: false,
    disableCloudSync: false,
    restrictLocalProviders: false,
    blockOutboundRequests: false,
  },
};

export class PrivacyManager {
  private currentMode: PrivacyMode;
  private config: PrivacyConfig;
  private securityEvents: SecurityEventSystem;
  private allowedLocalProviders = new Set(['ollama']);

  constructor(
    initialMode: PrivacyMode = 'normal',
    securityEvents?: SecurityEventSystem,
  ) {
    this.currentMode = initialMode;
    this.config = { ...PRIVACY_CONFIGS[initialMode] };
    this.securityEvents = securityEvents || new SecurityEventSystem();
  }

  /**
   * Set the privacy mode.
   */
  setMode(mode: PrivacyMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.config = { ...PRIVACY_CONFIGS[mode] };

    this.securityEvents.record({
      type: 'privacy:mode_changed',
      severity: mode === 'offline' ? 'warning' : 'info',
      message: `Privacy mode changed: ${previousMode} → ${mode}`,
      details: { previousMode, newMode: mode, config: this.config },
    });
  }

  /**
   * Get the current privacy mode.
   */
  getMode(): PrivacyMode {
    return this.currentMode;
  }

  /**
   * Get the current privacy configuration.
   */
  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  /**
   * Check if a provider is allowed in the current privacy mode.
   */
  isProviderAllowed(providerType: string): boolean {
    if (this.currentMode === 'normal') return true;

    // Offline mode: only local providers
    if (this.currentMode === 'offline') {
      return this.allowedLocalProviders.has(providerType);
    }

    // Local-only mode: local providers allowed, cloud depends on config
    if (this.currentMode === 'local_only') {
      if (this.config.restrictLocalProviders) {
        return this.allowedLocalProviders.has(providerType);
      }
      return true;
    }

    return true;
  }

  /**
   * Check if an outbound request is allowed.
   */
  isOutboundAllowed(): boolean {
    return !this.config.blockOutboundRequests;
  }

  /**
   * Check if telemetry is enabled.
   */
  isTelemetryEnabled(): boolean {
    return !this.config.disableTelemetry;
  }

  /**
   * Check if cloud sync is enabled.
   */
  isCloudSyncEnabled(): boolean {
    return !this.config.disableCloudSync;
  }

  /**
   * Get allowed provider types for the current mode.
   */
  getAllowedProviders(): string[] {
    if (this.currentMode === 'normal') {
      return ['openrouter', 'ollama', 'openai', 'anthropic', 'custom'];
    }

    return ['ollama'];
  }

  /**
   * Add a provider to the local-only allowlist.
   */
  addLocalProvider(providerType: string): void {
    this.allowedLocalProviders.add(providerType);
  }

  /**
   * Get the security events system.
   */
  getSecurityEvents(): SecurityEventSystem {
    return this.securityEvents;
  }

  /**
   * Get available privacy modes with descriptions.
   */
  static getModeDescriptions(): Array<{
    name: PrivacyMode;
    description: string;
    blockOutbound: boolean;
  }> {
    return [
      {
        name: 'normal',
        description: 'Full connectivity. Telemetry and cloud sync enabled.',
        blockOutbound: false,
      },
      {
        name: 'local_only',
        description: 'Local providers only. Telemetry and cloud sync disabled.',
        blockOutbound: true,
      },
      {
        name: 'offline',
        description: 'Fully isolated. No outbound requests. Local providers only.',
        blockOutbound: true,
      },
    ];
  }
}
