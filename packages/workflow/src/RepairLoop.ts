/**
 * RepairLoop — Controlled repair workflow for failed execution steps.
 *
 * Flow: detect failure → classify issue → retry safely → attempt targeted fix → re-verify
 * Bounded retries prevent infinite loops.
 */

import { generateId } from '@autic/shared';
import type { FailureClassification, WorkflowStep, WorkflowState } from '@autic/shared';
import { FailureClassifier } from './FailureClassifier.js';
import { VerificationEngine } from './VerificationEngine.js';

export interface RepairLoopOptions {
  maxRepairAttempts?: number;
  maxTotalRetries?: number;
  cooldownMs?: number;
}

export interface RepairResult {
  repaired: boolean;
  newStep?: WorkflowStep;
  classification: FailureClassification;
  attempts: number;
  durationMs: number;
  finalError?: string;
}

export class RepairLoop {
  private classifier: FailureClassifier;
  private verifier: VerificationEngine;
  private totalRetries = 0;

  constructor(private options: RepairLoopOptions = {}) {
    this.classifier = new FailureClassifier();
    this.verifier = new VerificationEngine();
  }

  getClassifier(): FailureClassifier {
    return this.classifier;
  }

  getVerifier(): VerificationEngine {
    return this.verifier;
  }

  /**
   * Execute a full repair attempt for a failed step.
   * Returns whether the repair was successful and the new step if applicable.
   */
  async attemptRepair(params: {
    failedStep: WorkflowStep;
    workflowState: WorkflowState;
    error: string;
    exitCode?: number;
    execute: (step: WorkflowStep) => Promise<{ success: boolean; output?: string; error?: string }>;
    verify: (step: WorkflowStep) => Promise<boolean>;
  }): Promise<RepairResult> {
    const { failedStep, workflowState: _ws, error, exitCode, execute, verify } = params;
    const maxAttempts = this.options.maxRepairAttempts || 3;
    const startTime = Date.now();

    // 1. Classify the failure
    const classification = this.classifier.classify({
      error,
      stepType: failedStep.type,
      toolName: failedStep.toolName,
      exitCode,
      durationMs: failedStep.durationMs,
    });

    // 2. Check if retryable
    if (!classification.retryable || this.totalRetries >= (this.options.maxTotalRetries || 10)) {
      return {
        repaired: false,
        classification,
        attempts: 0,
        durationMs: Date.now() - startTime,
        finalError:
          this.totalRetries >= (this.options.maxTotalRetries || 10)
            ? 'Maximum total retries exceeded'
            : `Non-retryable failure: ${classification.description}`,
      };
    }

    // 3. Execute bounded retries
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.totalRetries++;
      const retryDelay = this.classifier.getRetryDelay(
        classification.retryStrategy || 'backoff',
        attempt,
      );

      // Wait for cooldown if needed
      if (retryDelay > 0) {
        await this.sleep(retryDelay);
      }

      // Retry the failed step
      const result = await execute(failedStep);

      if (result.success) {
        // Verify the repair
        const verified = await verify(failedStep);
        if (verified) {
          return {
            repaired: true,
            classification,
            attempts: attempt + 1,
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Check if we should abort based on strategy
      if (classification.retryStrategy === 'abort') {
        break;
      }
    }

    // 4. All retries exhausted — create a repair step for human intervention
    const repairStep: WorkflowStep = {
      id: generateId(),
      description: `Manual repair needed: ${failedStep.description}`,
      type: 'repair',
      dependencies: failedStep.dependencies,
      status: 'failed',
      retries: maxAttempts,
      maxRetries: failedStep.maxRetries,
      error: `Auto-repair failed after ${maxAttempts} attempts: ${error.slice(0, 200)}`,
    };

    return {
      repaired: false,
      newStep: repairStep,
      classification,
      attempts: maxAttempts,
      durationMs: Date.now() - startTime,
      finalError: error.slice(0, 300),
    };
  }

  /**
   * Reset retry counter (e.g., for a new workflow).
   */
  resetRetries(): void {
    this.totalRetries = 0;
  }

  /**
   * Get total retry count across repairs.
   */
  getTotalRetries(): number {
    return this.totalRetries;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
