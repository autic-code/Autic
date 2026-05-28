/**
 * LoopProtection — Runtime loop and runaway execution prevention.
 *
 * Detects and prevents:
 * - Recursion loops: excessive depth in task/agent delegation
 * - Repeated failures: same failure occurring N times in a row
 * - Infinite verification: verification → fix → verify cycle without progress
 * - Runaway repair: repair attempts that keep failing at the same step
 *
 * All detection is deterministic with configurable thresholds.
 */

import type { LoopDetection } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface LoopProtectionOptions {
  maxRecursionDepth?: number;
  maxRepeatedFailures?: number;
  maxVerificationCycles?: number;
  maxRepairAttempts?: number;
  windowSizeMs?: number;
}

export interface LoopProtectionEvents {
  loopDetected: (detection: LoopDetection) => void;
  loopMitigated: (detection: LoopDetection, action: string) => void;
}

interface FailureRecord {
  stepId: string;
  error: string;
  timestamp: number;
}

interface VerificationCycle {
  stepId: string;
  startTime: number;
  attempts: number;
  lastError: string;
}

interface RepairRecord {
  stepId: string;
  attempts: number;
  lastError: string;
  startedAt: number;
}

interface RecursionRecord {
  source: string;
  depth: number;
  lastIncrease: number;
  maxReached: number;
}

export class LoopProtection extends EventEmitter {
  private options: Required<LoopProtectionOptions>;
  private failureHistory: FailureRecord[] = [];
  private verificationCycles: Map<string, VerificationCycle> = new Map();
  private repairRecords: Map<string, RepairRecord> = new Map();
  private recursionRecords: Map<string, RecursionRecord> = new Map();

  constructor(options: LoopProtectionOptions = {}) {
    super();
    this.options = {
      maxRecursionDepth: options.maxRecursionDepth || 50,
      maxRepeatedFailures: options.maxRepeatedFailures || 5,
      maxVerificationCycles: options.maxVerificationCycles || 5,
      maxRepairAttempts: options.maxRepairAttempts || 3,
      windowSizeMs: options.windowSizeMs || 300_000, // 5 minutes
    };
  }

  // --- Cycle Detection for All Types ---

  checkAll(source: string, stepId: string, error?: string): LoopDetection[] {
    const detections: LoopDetection[] = [];

    // 1. Recursion check
    const recursionCheck = this.checkRecursion(source);
    if (recursionCheck.detected) detections.push(recursionCheck);

    // 2. Repeated failure check
    if (error) {
      const repeatedFailCheck = this.checkRepeatedFailure(stepId, error);
      if (repeatedFailCheck.detected) detections.push(repeatedFailCheck);
    }

    // 3. Verification cycle check
    const verifyCheck = this.checkVerificationCycle(stepId, error || '');
    if (verifyCheck.detected) detections.push(verifyCheck);

    // 4. Runaway repair check
    const repairCheck = this.checkRunawayRepair(stepId, error || '');
    if (repairCheck.detected) detections.push(repairCheck);

    return detections;
  }

  // --- Recursion Detection ---

  trackRecursion(source: string): void {
    const record = this.recursionRecords.get(source) || {
      source,
      depth: 0,
      lastIncrease: Date.now(),
      maxReached: 0,
    };
    record.depth++;
    record.lastIncrease = Date.now();
    if (record.depth > record.maxReached) {
      record.maxReached = record.depth;
    }
    this.recursionRecords.set(source, record);
  }

  decrementRecursion(source: string): void {
    const record = this.recursionRecords.get(source);
    if (record) {
      record.depth = Math.max(0, record.depth - 1);
    }
  }

  checkRecursion(source: string): LoopDetection {
    const record = this.recursionRecords.get(source);
    const currentDepth = record?.depth || 0;

    return {
      detected: currentDepth >= this.options.maxRecursionDepth,
      type: 'recursion',
      pattern: [source],
      threshold: this.options.maxRecursionDepth,
      currentCount: currentDepth,
      source,
      recommendation: `Recursion depth ${currentDepth}/${this.options.maxRecursionDepth} reached. Consider restructuring ${source} to avoid deep nesting.`,
    };
  }

  // --- Repeated Failure Detection ---

  recordFailure(stepId: string, error: string): void {
    this.failureHistory.push({ stepId, error, timestamp: Date.now() });

    // Prune old entries beyond the window
    const cutoff = Date.now() - this.options.windowSizeMs;
    this.failureHistory = this.failureHistory.filter((f) => f.timestamp > cutoff);
  }

  checkRepeatedFailure(stepId: string, error: string): LoopDetection {
    // Count failures for this step in the current window
    const cutoff = Date.now() - this.options.windowSizeMs;
    const relevantFailures = this.failureHistory.filter(
      (f) => f.stepId === stepId && f.timestamp > cutoff,
    );

    const similarFailures = relevantFailures.filter((f) => f.error.includes(error.slice(0, 50)));

    return {
      detected: similarFailures.length >= this.options.maxRepeatedFailures,
      type: 'repeated_failure',
      pattern: similarFailures.map((f) => f.error.slice(0, 60)),
      threshold: this.options.maxRepeatedFailures,
      currentCount: similarFailures.length,
      source: stepId,
      recommendation: `Step ${stepId} failed ${similarFailures.length} times with similar error. Escalating to manual review.`,
    };
  }

  // --- Infinite Verification Detection ---

  trackVerificationCycle(stepId: string, error: string): void {
    const existing = this.verificationCycles.get(stepId) || {
      stepId,
      startTime: Date.now(),
      attempts: 0,
      lastError: '',
    };
    existing.attempts++;
    existing.lastError = error;
    this.verificationCycles.set(stepId, existing);
  }

  resolveVerificationCycle(stepId: string): void {
    this.verificationCycles.delete(stepId);
  }

  checkVerificationCycle(stepId: string, _error: string): LoopDetection {
    const cycle = this.verificationCycles.get(stepId);

    return {
      detected: (cycle?.attempts || 0) >= this.options.maxVerificationCycles,
      type: 'infinite_verification',
      pattern: ['verify', 'fix', 'verify'],
      threshold: this.options.maxVerificationCycles,
      currentCount: cycle?.attempts || 0,
      source: stepId,
      recommendation: `Verification cycling detected (${cycle?.attempts || 0} attempts). Breaking cycle — manual review required.`,
    };
  }

  // --- Runaway Repair Detection ---

  trackRepairAttempt(stepId: string, error: string): void {
    const existing = this.repairRecords.get(stepId) || {
      stepId,
      attempts: 0,
      lastError: '',
      startedAt: Date.now(),
    };
    existing.attempts++;
    existing.lastError = error;
    this.repairRecords.set(stepId, existing);
  }

  resolveRepair(stepId: string): void {
    this.repairRecords.delete(stepId);
  }

  checkRunawayRepair(stepId: string, _error: string): LoopDetection {
    const record = this.repairRecords.get(stepId);

    return {
      detected: (record?.attempts || 0) >= this.options.maxRepairAttempts,
      type: 'runaway_repair',
      pattern: ['repair', 'verify', 'repair'],
      threshold: this.options.maxRepairAttempts,
      currentCount: record?.attempts || 0,
      source: stepId,
      recommendation: `Repair looping detected (${record?.attempts || 0} attempts). Halting auto-repair — manual intervention needed.`,
    };
  }

  // --- Utility ---

  getFailureCount(stepId: string): number {
    return this.failureHistory.filter((f) => f.stepId === stepId).length;
  }

  getRecursionDepth(source: string): number {
    return this.recursionRecords.get(source)?.depth || 0;
  }

  reset(): void {
    this.failureHistory = [];
    this.verificationCycles.clear();
    this.repairRecords.clear();
    this.recursionRecords.clear();
  }

  resetStep(stepId: string): void {
    this.verificationCycles.delete(stepId);
    this.repairRecords.delete(stepId);
    this.failureHistory = this.failureHistory.filter((f) => f.stepId !== stepId);
  }
}
