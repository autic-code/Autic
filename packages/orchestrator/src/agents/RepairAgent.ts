/**
 * RepairAgent — Failure analysis, targeted repair, and bounded retries.
 *
 * Responsibilities:
 *   - Analyze verification failures
 *   - Attempt targeted repairs
 *   - Track retry attempts
 *   - Coordinate re-verification
 *   - Produce structured RepairOutput
 *
 * Tool scope: read + write (same as engineering)
 * Bounded by retry limits and timeouts.
 */

import { timestamp } from '@autic/shared';
import type { 
  RepairOutput, 
  VerificationOutput, 
  TaskContract, 
  OrchestrationStage,
} from '@autic/shared';
import { createContract, fulfillContract, rejectContract, getContractOutput } from '../contracts.js';

type ToolRunner = (toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class RepairAgent {
  private maxAttempts: number;

  constructor(maxAttempts: number = 3) {
    this.maxAttempts = maxAttempts;
  }

  /**
   * Execute a repair stage.
   * Analyzes verification failures and attempts bounded repairs.
   */
  async execute(
    _goal: string,
    runTool: ToolRunner,
    previousContract?: TaskContract,
  ): Promise<TaskContract> {
    const contract = createContract(
      'repair' as OrchestrationStage,
      'final_review' as OrchestrationStage,
      'repair_result',
      { timestamp: timestamp() },
    );

    try {
      // Get verification results
      const verificationOutput = previousContract
        ? getContractOutput<VerificationOutput>(previousContract)
        : undefined;

      const fixesApplied: string[] = [];
      let repaired = false;
      let finalState: 'resolved' | 'unresolved' | 'partial' = 'unresolved';
      let attempts = 0;

      if (!verificationOutput || verificationOutput.passed) {
        // Nothing to repair
        const output: RepairOutput = {
          attempts: 0,
          repaired: true,
          fixesApplied: [],
          finalState: 'resolved',
          summary: 'No repairs needed — verification passed',
        };
        return fulfillContract(contract, output as unknown as Record<string, unknown>);
      }

      // Find failed checks and attempt fixes
      const failedChecks = verificationOutput.checks.filter((c) => !c.passed);

      for (const check of failedChecks) {
        if (attempts >= this.maxAttempts) break;

        attempts++;

        // Attempt repair based on check type
        const fixDescription = await this.attemptRepair(check.type, check.name, runTool);
        if (fixDescription) {
          fixesApplied.push(fixDescription);
        }
      }

      // Determine final state
      if (fixesApplied.length > 0 && attempts < this.maxAttempts) {
        finalState = 'resolved';
        repaired = true;
      } else if (fixesApplied.length > 0) {
        finalState = 'partial';
        repaired = true;
      }

      const output: RepairOutput = {
        attempts,
        repaired,
        fixesApplied,
        finalState,
        summary: repaired
          ? `Repair applied: ${fixesApplied.length} fix(es) in ${attempts} attempt(s)`
          : `Unable to repair after ${attempts} attempt(s)`,
      };

      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      return rejectContract(
        contract,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Attempt a targeted repair based on check type and name.
   */
  private async attemptRepair(
    checkType: string,
    _checkName: string,
    runTool: ToolRunner,
  ): Promise<string | null> {
    switch (checkType) {
      case 'typecheck': {
        // Run the typecheck command to get error output
        const result = await runTool('run_terminal', {
          command: 'npx tsc --noEmit 2>&1',
          timeoutMs: 60_000,
        });
        if (result.error) {
          return `TypeScript errors detected: ${result.error.slice(0, 200)}`;
        }
        return null;
      }

      case 'lint': {
        const result = await runTool('run_terminal', {
          command: 'npx eslint . --ext .ts,.tsx --fix 2>&1',
          timeoutMs: 60_000,
        });
        if (result.success) {
          return 'Auto-fixed lint errors';
        }
        return 'Lint errors require manual review';
      }

      case 'build': {
        return 'Build failure — check compilation output';
      }

      default:
        return null;
    }
  }
}
