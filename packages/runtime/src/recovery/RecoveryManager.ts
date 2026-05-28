/**
 * Recovery Manager — Handles task retry logic and crash-safe state persistence.
 * Supports execution snapshots for resuming interrupted workflows.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { timestamp } from '@autic/shared';
import type { ExecutionSnapshot, TaskState, ExecutionStep } from '@autic/shared';

export interface RecoveryOptions {
  snapshotDir?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class RecoveryManager {
  private snapshotDir: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private initialized = false;

  constructor(options: RecoveryOptions = {}) {
    this.snapshotDir = options.snapshotDir || join(homedir(), '.autic', 'snapshots');
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
  }

  async init(): Promise<void> {
    try {
      await access(this.snapshotDir);
    } catch {
      await mkdir(this.snapshotDir, { recursive: true });
    }
    this.initialized = true;
  }

  /**
   * Save an execution snapshot to disk for crash recovery.
   */
  async saveSnapshot(snapshot: ExecutionSnapshot): Promise<void> {
    if (!this.initialized) await this.init();
    const filePath = join(this.snapshotDir, `${snapshot.taskId}.json`);
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * Load a saved snapshot for recovery.
   */
  async loadSnapshot(taskId: string): Promise<ExecutionSnapshot | null> {
    if (!this.initialized) await this.init();
    try {
      const data = await readFile(join(this.snapshotDir, `${taskId}.json`), 'utf-8');
      return JSON.parse(data) as ExecutionSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Delete a snapshot after successful completion.
   */
  async deleteSnapshot(taskId: string): Promise<void> {
    try {
      const filePath = join(this.snapshotDir, `${taskId}.json`);
      const { unlink } = await import('node:fs/promises');
      await unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  /**
   * Create a snapshot from current execution state.
   */
  createSnapshot(
    taskId: string,
    state: TaskState,
    completedSteps: ExecutionStep[],
    pendingSteps: ExecutionStep[],
    currentStepIndex: number,
    metadata: Record<string, string> = {},
  ): ExecutionSnapshot {
    return {
      taskId,
      state,
      completedSteps: completedSteps.map((s) => ({ ...s })),
      pendingSteps: pendingSteps.map((s) => ({ ...s })),
      currentStepIndex,
      timestamp: timestamp(),
      metadata,
    };
  }

  /**
   * Compute retry delay with exponential backoff.
   */
  getRetryDelay(retryCount: number): number {
    return Math.min(this.retryDelayMs * Math.pow(2, retryCount), 30_000);
  }

  /**
   * Determine if retry is allowed.
   */
  canRetry(retriesSoFar: number): boolean {
    return retriesSoFar < this.maxRetries;
  }

  /**
   * List all available snapshots for recovery.
   */
  async listSnapshots(): Promise<string[]> {
    if (!this.initialized) await this.init();
    const { readdir } = await import('node:fs/promises');
    try {
      const files = await readdir(this.snapshotDir);
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Validate that a snapshot can be safely resumed.
   * Returns false if the snapshot is too old or corrupted.
   */
  validateSnapshot(snapshot: ExecutionSnapshot): boolean {
    if (!snapshot.taskId || !snapshot.state || !snapshot.timestamp) return false;

    // Snapshots older than 24 hours are considered stale
    const maxAge = 24 * 60 * 60 * 1000;
    if (timestamp() - snapshot.timestamp > maxAge) return false;

    return true;
  }

  /**
   * Clean up all snapshots older than the specified age.
   */
  async cleanOldSnapshots(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const ids = await this.listSnapshots();
    let cleaned = 0;

    for (const id of ids) {
      const snapshot = await this.loadSnapshot(id);
      if (snapshot && timestamp() - snapshot.timestamp > maxAgeMs) {
        await this.deleteSnapshot(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}
