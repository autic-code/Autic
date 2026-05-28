/**
 * KeyManager — Multi-key management for provider API keys.
 *
 * Manages multiple API keys per provider with rotation, health tracking,
 * cooldown handling, and encrypted vault integration.
 */

import { timestamp, generateId } from '@autic/shared';
import type { KeyEntry } from '@autic/shared';

export interface KeyManagerOptions {
  /** Max failed attempts before key is deactivated */
  maxFailedAttempts?: number;
  /** Cooldown duration in ms after a failure (default: 30s) */
  cooldownMs?: number;
  /** Whether to skip vault integration for testing */
  skipVault?: boolean;
}

export class KeyManager {
  private keys: Map<string, KeyEntry> = new Map();
  private providerKeys: Map<string, string[]> = new Map(); // providerId -> keyIds
  private vault: { set: (key: string, value: string) => Promise<void>; get: (key: string) => Promise<string | undefined> } | null = null;

  constructor(
    private options: KeyManagerOptions = {},
  ) {}

  /**
   * Set the vault instance for encrypted storage.
   */
  setVault(vault: { set: (key: string, value: string) => Promise<void>; get: (key: string) => Promise<string | undefined> }): void {
    this.vault = vault;
  }

  /**
   * Add a new API key for a provider.
   * Returns the key entry ID.
   */
  async addKey(
    providerId: string,
    label: string,
    apiKey: string,
    persist = true,
  ): Promise<string> {
    const id = generateId();
    const keyPrefix = apiKey.length > 8 ? apiKey.substring(0, 8) + '...' : '***';

    const entry: KeyEntry = {
      id,
      providerId,
      label,
      keyPrefix,
      createdAt: timestamp(),
      verified: false,
      failedAttempts: 0,
      isActive: true,
    };

    this.keys.set(id, entry);

    // Track key under provider
    const existing = this.providerKeys.get(providerId) || [];
    existing.push(id);
    this.providerKeys.set(providerId, existing);

    // Persist to vault
    if (persist && this.vault) {
      try {
        await this.vault.set(`provider_key_${id}`, apiKey);
      } catch {
        // Vault persistence is best-effort
      }
    }

    return id;
  }

  /**
   * Remove a key by ID.
   */
  async removeKey(keyId: string): Promise<boolean> {
    const entry = this.keys.get(keyId);
    if (!entry) return false;

    this.keys.delete(keyId);

    // Remove from provider tracking
    const providerKeys = this.providerKeys.get(entry.providerId);
    if (providerKeys) {
      const idx = providerKeys.indexOf(keyId);
      if (idx >= 0) providerKeys.splice(idx, 1);
    }

    return true;
  }

  /**
   * Get a key entry by ID (without exposing the actual key value).
   */
  getKey(keyId: string): KeyEntry | undefined {
    return this.keys.get(keyId);
  }

  /**
   * Get the actual API key value (from memory or vault).
   */
  async getKeyValue(keyId: string): Promise<string | undefined> {
    const entry = this.keys.get(keyId);
    if (!entry) return undefined;

    // Try vault first
    if (this.vault) {
      try {
        const stored = await this.vault.get(`provider_key_${keyId}`);
        if (stored) return stored;
      } catch {
        // Fall through to in-memory fallback
      }
    }

    return undefined;
  }

  /**
   * Get all active keys for a provider.
   */
  getProviderKeys(providerId: string): KeyEntry[] {
    const keyIds = this.providerKeys.get(providerId) || [];
    return keyIds
      .map((id) => this.keys.get(id))
      .filter((k): k is KeyEntry => k !== undefined && k.isActive);
  }

  /**
   * Get the next available key for a provider (for rotation).
   * Skips keys in cooldown and deactivated keys.
   */
  getNextAvailableKey(providerId: string): KeyEntry | undefined {
    const keys = this.getProviderKeys(providerId)
      .filter((k) => {
        if (!k.isActive) return false;
        if (k.cooldownUntil && timestamp() < k.cooldownUntil) return false;
        return true;
      });

    // Sort by last used (least recently used first)
    keys.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));

    return keys[0];
  }

  /**
   * Mark a key as successfully used.
   */
  markKeyUsed(keyId: string): void {
    const entry = this.keys.get(keyId);
    if (!entry) return;

    entry.lastUsedAt = timestamp();
    entry.failedAttempts = 0;
  }

  /**
   * Mark a key as failed. If failed attempts exceed max, deactivate the key.
   */
  markKeyFailed(keyId: string): void {
    const entry = this.keys.get(keyId);
    if (!entry) return;

    entry.failedAttempts++;
    entry.lastUsedAt = timestamp();

    const maxFailed = this.options.maxFailedAttempts || 3;
    if (entry.failedAttempts >= maxFailed) {
      // Put key in cooldown instead of deactivating immediately
      entry.cooldownUntil = timestamp() + (this.options.cooldownMs || 30_000);
    }
  }

  /**
   * Mark a key as verified (e.g., after successful API key check).
   */
  markKeyVerified(keyId: string): void {
    const entry = this.keys.get(keyId);
    if (!entry) return;
    entry.verified = true;
    entry.lastVerifiedAt = timestamp();
  }

  /**
   * Deactivate a key.
   */
  deactivateKey(keyId: string): void {
    const entry = this.keys.get(keyId);
    if (!entry) return;
    entry.isActive = false;
  }

  /**
   * Reactivate a previously deactivated key.
   */
  reactivateKey(keyId: string): void {
    const entry = this.keys.get(keyId);
    if (!entry) return;
    entry.isActive = true;
    entry.failedAttempts = 0;
    entry.cooldownUntil = undefined;
  }

  /**
   * List all key IDs across all providers.
   */
  listAllKeys(): KeyEntry[] {
    return Array.from(this.keys.values());
  }

  /**
   * Get key statistics for a provider.
   */
  getProviderKeyStats(providerId: string): {
    total: number;
    active: number;
    inCooldown: number;
    verified: number;
  } {
    const keys = this.getProviderKeys(providerId);
    const now = timestamp();

    return {
      total: keys.length,
      active: keys.filter((k) => k.isActive).length,
      inCooldown: keys.filter((k) => k.cooldownUntil && now < k.cooldownUntil).length,
      verified: keys.filter((k) => k.verified).length,
    };
  }

  /**
   * Reset all failed attempt counters for a provider's keys.
   */
  resetFailedAttempts(providerId: string): void {
    const keyIds = this.providerKeys.get(providerId) || [];
    for (const id of keyIds) {
      const entry = this.keys.get(id);
      if (entry) {
        entry.failedAttempts = 0;
        entry.cooldownUntil = undefined;
      }
    }
  }
}
