/**
 * Encrypted local vault for API keys and sensitive data.
 * Stores secrets in an encrypted JSON file on disk.
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface VaultStore {
  entries: Record<string, VaultEntry>;
  salt: string;
  version: number;
}

interface VaultEntry {
  value: string;
  createdAt: number;
  updatedAt: number;
}

const VAULT_VERSION = 1;
const VAULT_DIR = join(homedir(), '.autic');
const VAULT_PATH = join(VAULT_DIR, 'vault.enc');
const ALGORITHM = 'aes-256-gcm';

export class Vault {
  private entries: Record<string, VaultEntry> = {};
  private masterKey: Buffer;
  private initialized = false;

  constructor(private password?: string) {
    this.masterKey = Buffer.alloc(0);
  }

  async init(password?: string): Promise<void> {
    const pw = password || this.password || process.env.AUTIC_VAULT_KEY;
    if (!pw) {
      throw new Error(
        'Vault requires a password. Set AUTIC_VAULT_KEY environment variable or pass a password to getVault().',
      );
    }
    this.masterKey = this.deriveKey(pw);

    try {
      await access(VAULT_DIR);
    } catch {
      await writeFile(
        VAULT_PATH,
        JSON.stringify({ entries: {}, salt: '', version: VAULT_VERSION }),
      );
    }

    await this.load();
    this.initialized = true;
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.initialized) await this.init();
    this.entries[key] = {
      value,
      createdAt: this.entries[key]?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await this.save();
  }

  async get(key: string): Promise<string | undefined> {
    if (!this.initialized) await this.init();
    return this.entries[key]?.value;
  }

  async delete(key: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    if (!this.entries[key]) return false;
    delete this.entries[key];
    await this.save();
    return true;
  }

  async has(key: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    return key in this.entries;
  }

  async list(): Promise<string[]> {
    if (!this.initialized) await this.init();
    return Object.keys(this.entries);
  }

  /**
   * List all keys with their metadata (prefix only, no full values).
   */
  async listKeys(): Promise<Array<{ key: string; createdAt: number; updatedAt: number }>> {
    if (!this.initialized) await this.init();
    return Object.entries(this.entries).map(([key, entry]) => ({
      key,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  }

  /**
   * Check if a specific provider key exists in the vault.
   */
  async hasProviderKey(providerId: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    const keyNames = [
      `provider:${providerId}`,
      `provider:${providerId}:key`,
      `${providerId}_api_key`,
    ];
    return keyNames.some((k) => k in this.entries);
  }

  /**
   * Rotate a key by updating its value.
   */
  async rotateKey(key: string, newValue: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    if (!this.entries[key]) return false;
    this.entries[key] = {
      value: newValue,
      createdAt: this.entries[key].createdAt,
      updatedAt: Date.now(),
    };
    await this.save();
    return true;
  }

  /**
   * Get the key prefix (first 8 chars) for masked display.
   */
  async getKeyPrefix(key: string): Promise<string | undefined> {
    const value = await this.get(key);
    if (!value) return undefined;
    return value.slice(0, 8) + '...';
  }

  /**
   * Get all keys that have not expired (no expiration logic — all keys are non-expiring by default).
   */
  async getNonExpiringKeys(): Promise<string[]> {
    return this.list();
  }

  async clear(): Promise<void> {
    this.entries = {};
    await this.save();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async load(): Promise<void> {
    try {
      const data = await readFile(VAULT_PATH, 'utf-8');
      const decrypted = this.decrypt(data);

      // Handle both old format (just entries) and new format (with store)
      try {
        const store = JSON.parse(decrypted) as VaultStore;
        this.entries = store.entries || {};
      } catch {
        this.entries = JSON.parse(decrypted);
      }
    } catch {
      this.entries = {};
    }
  }

  private async save(): Promise<void> {
    const store: VaultStore = {
      entries: this.entries,
      salt: '',
      version: VAULT_VERSION,
    };
    const encrypted = this.encrypt(JSON.stringify(store));
    await writeFile(VAULT_PATH, encrypted, 'utf-8');
  }

  private deriveKey(password: string): Buffer {
    return scryptSync(password, 'autic-salt', 32);
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted.toString('hex'),
    });
  }

  private decrypt(ciphertext: string): string {
    const { iv, authTag, data } = JSON.parse(ciphertext);
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
    return decrypted.toString('utf-8');
  }
}

let vaultInstance: Vault | null = null;

export function getVault(password?: string): Vault {
  if (!vaultInstance) {
    vaultInstance = new Vault(password);
  }
  return vaultInstance;
}
