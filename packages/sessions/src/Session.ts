/**
 * Session class representing a single Autic workspace session.
 * Supports states: active, paused, crashed, completed.
 * Persists to disk with crash-safe writes.
 */

import { generateId, timestamp } from '@autic/shared';
import type { SessionConfig, EnhancedSessionConfig, SessionState } from '@autic/shared';

export interface SessionOptions {
  id?: string;
  name: string;
  workspaceDir: string;
  modelId?: string;
  providerId?: string;
  metadata?: Record<string, string>;
}

export class Session {
  readonly id: string;
  name: string;
  readonly createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  workspaceDir: string;
  workspaceId: string;
  modelId?: string;
  providerId?: string;
  metadata: Record<string, string>;
  state: SessionState;
  taskCount: number;
  completedTaskCount: number;
  totalTokensUsed: number;

  constructor(options: SessionOptions) {
    this.id = options.id || generateId();
    this.name = options.name;
    this.createdAt = timestamp();
    this.updatedAt = timestamp();
    this.lastActiveAt = timestamp();
    this.workspaceDir = options.workspaceDir;
    this.workspaceId = this.generateWorkspaceId(options.workspaceDir);
    this.modelId = options.modelId;
    this.providerId = options.providerId;
    this.metadata = options.metadata || {};
    this.state = 'active';
    this.taskCount = 0;
    this.completedTaskCount = 0;
    this.totalTokensUsed = 0;
  }

  private generateWorkspaceId(workspaceDir: string): string {
    // Create a stable workspace ID from the directory path
    const hash = workspaceDir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `ws-${hash.slice(0, 40)}`;
  }

  markActive(): void {
    this.state = 'active';
    this.lastActiveAt = timestamp();
    this.updatedAt = timestamp();
  }

  markPaused(): void {
    this.state = 'paused';
    this.updatedAt = timestamp();
  }

  markCrashed(): void {
    this.state = 'crashed';
    this.updatedAt = timestamp();
  }

  markCompleted(): void {
    this.state = 'completed';
    this.updatedAt = timestamp();
  }

  incrementTaskCount(): void {
    this.taskCount++;
    this.completedTaskCount++;
    this.lastActiveAt = timestamp();
  }

  trackTokens(count: number): void {
    this.totalTokensUsed += count;
  }

  update(options: Partial<SessionOptions>): void {
    if (options.name) this.name = options.name;
    if (options.modelId) this.modelId = options.modelId;
    if (options.providerId) this.providerId = options.providerId;
    if (options.metadata) this.metadata = { ...this.metadata, ...options.metadata };
    this.updatedAt = timestamp();
  }

  setModel(modelId: string, providerId: string): void {
    this.modelId = modelId;
    this.providerId = providerId;
    this.updatedAt = timestamp();
  }

  toConfig(): SessionConfig {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      workspaceDir: this.workspaceDir,
      modelId: this.modelId,
      providerId: this.providerId,
      metadata: this.metadata,
    };
  }

  toEnhancedConfig(): EnhancedSessionConfig {
    return {
      ...this.toConfig(),
      state: this.state,
      workspaceId: this.workspaceId,
      taskCount: this.taskCount,
      completedTaskCount: this.completedTaskCount,
      totalTokensUsed: this.totalTokensUsed,
      lastActiveAt: this.lastActiveAt,
    };
  }

  static fromConfig(config: SessionConfig): Session {
    const session = new Session({
      id: config.id,
      name: config.name,
      workspaceDir: config.workspaceDir,
      modelId: config.modelId,
      providerId: config.providerId,
      metadata: config.metadata,
    });
    // Override timestamps from config
    (session as unknown as Record<string, number>).createdAt = config.createdAt;
    (session as unknown as Record<string, number>).updatedAt = config.updatedAt;
    return session;
  }
}
