/**
 * EnhancedRecoveryManager — Extended recovery with partial workflow recovery,
 * crash-safe continuation, provider recovery hooks, and failed-step resumption.
 *
 * Builds on the existing RecoveryManager with additional recovery strategies.
 */

import { RecoveryManager } from './RecoveryManager.js';
import type { RecoveryOptions } from './RecoveryManager.js';
import type { ExecutionSnapshot } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface EnhancedRecoveryOptions extends RecoveryOptions {
  crashRecoveryEnabled?: boolean;
  providerRecoveryEnabled?: boolean;
  partialRecoveryEnabled?: boolean;
  maxRecoveryAttempts?: number;
}

export interface EnhancedRecoveryEvents {
  recoveryStarted: (taskId: string, type: string) => void;
  partialRecovery: (taskId: string, recoveredSteps: number, totalSteps: number) => void;
  fullRecovery: (taskId: string) => void;
  recoveryFailed: (taskId: string, error: string) => void;
  providerRecovered: (providerId: string, retryCount: number) => void;
  snapshotSaved: (taskId: string) => void;
}

export class EnhancedRecoveryManager extends RecoveryManager {
  private options: Required<EnhancedRecoveryOptions>;
  private crashRecoveryEnabled: boolean;
  private providerRecoveryEnabled: boolean;
  private evm = new EventEmitter();
  private recoveryAttempts = new Map<string, number>();

  constructor(options: EnhancedRecoveryOptions = {}) {
    super(options);
    this.options = {
      crashRecoveryEnabled: options.crashRecoveryEnabled ?? true,
      providerRecoveryEnabled: options.providerRecoveryEnabled ?? true,
      partialRecoveryEnabled: options.partialRecoveryEnabled ?? true,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
    } as Required<EnhancedRecoveryOptions>;
    this.crashRecoveryEnabled = this.options.crashRecoveryEnabled;
    this.providerRecoveryEnabled = this.options.providerRecoveryEnabled;
  }

  /** @deprecated Use EnhancedRecoveryManager directly — it extends RecoveryManager */
  getBaseManager(): RecoveryManager {
    return this;
  }

  // --- Typed event helpers ---

  on<K extends keyof EnhancedRecoveryEvents>(event: K, listener: EnhancedRecoveryEvents[K]): this {
    this.evm.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit<K extends keyof EnhancedRecoveryEvents>(event: K, ...args: Parameters<EnhancedRecoveryEvents[K]>): boolean {
    return this.evm.emit(event, ...args);
  }

  // --- Partial Workflow Recovery ---

  /**
   * Attempt partial recovery — resume from the last successfully completed step.
   * Returns the step index to resume from, or -1 if recovery is not possible.
   */
  async attemptPartialRecovery(taskId: string): Promise<{
    recoverable: boolean;
    resumeFromStep: number;
    snapshot: ExecutionSnapshot | null;
  }> {
    const snapshot = await this.loadSnapshot(taskId);
    if (!snapshot) {
      return { recoverable: false, resumeFromStep: -1, snapshot: null };
    }

    // Validate snapshot
    if (!this.validateSnapshot(snapshot)) {
      return { recoverable: false, resumeFromStep: -1, snapshot: null };
    }

    this.emit('recoveryStarted', taskId, 'partial');

    const completedCount = snapshot.completedSteps.length;
    const totalSteps = completedCount + snapshot.pendingSteps.length;

    if (completedCount === 0) {
      // No completed steps — resume from beginning
      this.emit('partialRecovery', taskId, 0, totalSteps);
      return { recoverable: true, resumeFromStep: 0, snapshot };
    }

    // Resume from step index after last completed step
    this.emit('partialRecovery', taskId, completedCount, totalSteps);
    return { recoverable: true, resumeFromStep: snapshot.currentStepIndex, snapshot };
  }

  /**
   * Attempt crash-safe continuation — checks for snapshots and resumes if possible.
   */
  async attemptCrashRecovery(taskId: string): Promise<{
    recovered: boolean;
    snapshot: ExecutionSnapshot | null;
    reason?: string;
  }> {
    if (!this.crashRecoveryEnabled) {
      return { recovered: false, snapshot: null, reason: 'Crash recovery disabled' };
    }

    const snapshot = await this.loadSnapshot(taskId);
    if (!snapshot) {
      return { recovered: false, snapshot: null, reason: 'No recovery snapshot found' };
    }

    if (!this.validateSnapshot(snapshot)) {
      return { recovered: false, snapshot: null, reason: 'Snapshot is stale or invalid' };
    }

    // Check recovery attempt limit
    const attempts = this.recoveryAttempts.get(taskId) || 0;
    if (attempts >= this.options.maxRecoveryAttempts) {
      return { recovered: false, snapshot: null, reason: 'Max recovery attempts exceeded' };
    }

    this.recoveryAttempts.set(taskId, attempts + 1);
    this.emit('recoveryStarted', taskId, 'crash');

    // Valid snapshot found — recoverable
    return { recovered: true, snapshot };
  }

  /**
   * Mark a workflow as fully recovered.
   */
  markRecovered(taskId: string): void {
    this.recoveryAttempts.delete(taskId);
    this.emit('fullRecovery', taskId);
  }

  // --- Provider Recovery Hooks ---

  /**
   * Attempt provider recovery with backoff.
   * Returns true if the provider should be retried.
   */
  shouldRetryProvider(_providerId: string, errorCode: string, retryCount: number): {
    retry: boolean;
    delayMs: number;
  } {
    if (!this.providerRecoveryEnabled) {
      return { retry: false, delayMs: 0 };
    }

    // Non-retryable error codes
    const nonRetryableCodes = ['auth_failed', 'invalid_key', 'invalid_request'];
    if (nonRetryableCodes.includes(errorCode)) {
      return { retry: false, delayMs: 0 };
    }

    // Check max attempts
    if (retryCount >= this.options.maxRecoveryAttempts) {
      return { retry: false, delayMs: 0 };
    }

    // Exponential backoff
    const delayMs = Math.min(1000 * Math.pow(2, retryCount), 60_000);

    return { retry: true, delayMs };
  }

  /**
   * Record a successful provider recovery.
   */
  recordProviderRecovery(providerId: string, retryCount: number): void {
    this.emit('providerRecovered', providerId, retryCount);
  }

  // --- Queue Recovery ---

  /**
   * Recover persisted queue tasks and resume them.
   * Returns list of recovered task IDs.
   */
  async recoverQueueTasks(): Promise<string[]> {
    const snapshotIds = await this.listSnapshots();
    const recovered: string[] = [];

    for (const taskId of snapshotIds) {
      const result = await this.attemptCrashRecovery(taskId);
      if (result.recovered && result.snapshot) {
        recovered.push(taskId);
      }
    }

    return recovered;
  }

  // --- Snapshot Delegation (forwarded to self via inheritance) ---

  async saveSnapshot(snapshot: ExecutionSnapshot): Promise<void> {
    await super.saveSnapshot(snapshot);
    this.emit('snapshotSaved', snapshot.taskId);
  }

  resetRecoveryAttempts(taskId: string): void {
    this.recoveryAttempts.delete(taskId);
  }
}
