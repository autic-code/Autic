/**
 * UpdateChecker — Lightweight update system foundation.
 *
 * Checks npm registry for latest version, notifies about updates,
 * provides safe update workflows. No forced auto-updates.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { UpdateCheckResult, UpdateConfig } from '@autic/shared';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/autic/latest';
const CURRENT_VERSION = '0.1.0';
const UPDATE_CACHE_PATH = join(homedir(), '.autic', 'update-cache.json');

interface UpdateCache {
  lastChecked: number;
  latestVersion?: string;
  updateAvailable: boolean;
}

export class UpdateChecker {
  private config: UpdateConfig;
  private cache: UpdateCache = {
    lastChecked: 0,
    updateAvailable: false,
  };

  constructor(config: UpdateConfig) {
    this.config = config;
  }

  /** Check for updates — respects check interval and cache */
  async check(): Promise<UpdateCheckResult> {
    const now = Date.now();
    const timeSinceLastCheck = now - this.cache.lastChecked;

    // If recently checked and within interval, return cached result
    if (this.cache.lastChecked > 0 && timeSinceLastCheck < this.config.checkIntervalMs) {
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: this.cache.latestVersion,
        updateAvailable: this.cache.updateAvailable,
        isPrerelease: false,
        checkedAt: this.cache.lastChecked,
      };
    }

    // Skip if checking is disabled
    if (!this.config.checkEnabled) {
      return {
        currentVersion: CURRENT_VERSION,
        updateAvailable: false,
        isPrerelease: false,
        checkedAt: now,
      };
    }

    try {
      const result = await this.fetchLatestVersion();
      this.cache = {
        lastChecked: now,
        latestVersion: result.version,
        updateAvailable: result.version !== CURRENT_VERSION,
      };
      await this.persistCache();
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: result.version,
        updateAvailable: result.version !== CURRENT_VERSION,
        isPrerelease: result.isPrerelease,
        releaseDate: result.releaseDate,
        releaseNotesUrl: `https://github.com/autic/autic/releases/tag/v${result.version}`,
        downloadUrl: `https://www.npmjs.com/package/autic/v/${result.version}`,
        checkedAt: now,
      };
    } catch {
      return {
        currentVersion: CURRENT_VERSION,
        updateAvailable: false,
        isPrerelease: false,
        checkedAt: now,
      };
    }
  }

  /** Load cached update state from disk */
  async loadCache(): Promise<void> {
    try {
      const content = await readFile(UPDATE_CACHE_PATH, 'utf-8');
      this.cache = JSON.parse(content) as UpdateCache;
    } catch {
      this.cache = { lastChecked: 0, updateAvailable: false };
    }
  }

  /** Format update notification message */
  formatUpdateMessage(result: UpdateCheckResult): string {
    if (!result.updateAvailable || !result.latestVersion) {
      return '';
    }
    return [
      `  ○ Update available: v${result.currentVersion} → v${result.latestVersion}`,
      `  ○ Run: npm install -g autic@latest`,
      '',
    ].join('\n');
  }

  /** Get update install command */
  getUpdateCommand(): string {
    return 'npm install -g autic@latest';
  }

  /** Get rollback command */
  getRollbackCommand(version?: string): string {
    const target = version || CURRENT_VERSION;
    return `npm install -g autic@${target}`;
  }

  // ─── Private ───────────────────────────────────────────────────────

  private async fetchLatestVersion(): Promise<{
    version: string;
    isPrerelease: boolean;
    releaseDate?: string;
  }> {
    const response = await fetch(NPM_REGISTRY_URL, {
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}`);
    }

    const data = (await response.json()) as {
      version?: string;
    };

    const version = data.version || CURRENT_VERSION;
    const isPrerelease =
      version.includes('-') || version.includes('alpha') || version.includes('beta');

    return { version, isPrerelease };
  }

  private async persistCache(): Promise<void> {
    try {
      await writeFile(UPDATE_CACHE_PATH, JSON.stringify(this.cache), 'utf-8');
    } catch {
      // Silently fail — cache is non-critical
    }
  }
}
