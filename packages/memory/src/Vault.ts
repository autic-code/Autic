/**
 * Memory vault for persistent storage of session data.
 * Foundation for hybrid JSON + SQLite storage architecture.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface MemoryEntry {
  key: string;
  value: unknown;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export class MemoryVault {
  private entries: Map<string, MemoryEntry> = new Map();
  private initialized = false;
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || join(homedir(), '.autic', 'memory');
  }

  async init(): Promise<void> {
    try {
      await access(this.basePath);
    } catch {
      await mkdir(this.basePath, { recursive: true });
    }

    await this.loadIndex();
    this.initialized = true;
  }

  async set(key: string, value: unknown, tags: string[] = []): Promise<void> {
    if (!this.initialized) await this.init();

    const existing = this.entries.get(key);
    this.entries.set(key, {
      key,
      value,
      tags,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });

    await this.saveIndex();
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    if (!this.initialized) await this.init();
    return this.entries.get(key)?.value as T | undefined;
  }

  async delete(key: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    const existed = this.entries.has(key);
    this.entries.delete(key);
    if (existed) await this.saveIndex();
    return existed;
  }

  async findByTag(tag: string): Promise<MemoryEntry[]> {
    if (!this.initialized) await this.init();
    return Array.from(this.entries.values()).filter((e) => e.tags.includes(tag));
  }

  async list(): Promise<string[]> {
    if (!this.initialized) await this.init();
    return Array.from(this.entries.keys());
  }

  async clear(): Promise<void> {
    this.entries.clear();
    await this.saveIndex();
  }

  private indexPath(): string {
    return join(this.basePath, 'index.json');
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await readFile(this.indexPath(), 'utf-8');
      const parsed = JSON.parse(data) as MemoryEntry[];
      this.entries = new Map(parsed.map((e) => [e.key, e]));
    } catch {
      this.entries = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const data = JSON.stringify(Array.from(this.entries.values()), null, 2);
    await writeFile(this.indexPath(), data, 'utf-8');
  }
}
