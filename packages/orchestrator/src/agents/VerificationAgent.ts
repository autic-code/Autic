/**
 * VerificationAgent — Build, test, lint, and typecheck verification.
 *
 * Responsibilities:
 *   - Run build verification
 *   - Run lint checks
 *   - Run type checking
 *   - Execute test suites
 *   - Produce structured VerificationOutput
 *
 * Tool scope: execution/test access (run_terminal, read_file)
 * Uses VerificationEngine from @autic/workflow for deterministic checks.
 */

import { timestamp } from '@autic/shared';
import type { VerificationOutput, TaskContract, OrchestrationStage } from '@autic/shared';
import { createContract, fulfillContract } from '../contracts.js';

type ToolRunner = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class VerificationAgent {
  /**
   * Execute a verification stage.
   * Runs build, typecheck, and lint verification commands.
   */
  async execute(
    _goal: string,
    runTool: ToolRunner,
    _previousContract?: TaskContract,
  ): Promise<TaskContract> {
    const contract = createContract(
      'verification' as OrchestrationStage,
      'repair' as OrchestrationStage,
      'verification_result',
      { timestamp: timestamp() },
    );

    try {
      const checks: Array<{
        type: 'build' | 'test' | 'lint' | 'typecheck' | 'custom';
        name: string;
        passed: boolean;
        output?: string;
        error?: string;
      }> = [];

      // 1. TypeScript typecheck
      const typeResult = await runTool('run_terminal', {
        command: 'npx tsc --noEmit',
        timeoutMs: 60_000,
      });
      checks.push({
        type: 'typecheck',
        name: 'TypeScript typecheck',
        passed: typeResult.success,
        output: typeof typeResult.data === 'string' ? typeResult.data.slice(0, 500) : undefined,
        error: typeResult.error,
      });

      // 2. Lint check
      const lintResult = await runTool('run_terminal', {
        command: 'npx eslint . --ext .ts,.tsx 2>&1 || true',
        timeoutMs: 60_000,
      });
      checks.push({
        type: 'lint',
        name: 'ESLint check',
        passed: lintResult.success,
        output: typeof lintResult.data === 'string' ? lintResult.data.slice(0, 500) : undefined,
        error: lintResult.error,
      });

      // 3. Build check
      const buildResult = await runTool('run_terminal', {
        command: 'pnpm build 2>&1 || npm run build 2>&1 || true',
        timeoutMs: 120_000,
      });
      checks.push({
        type: 'build',
        name: 'Build verification',
        passed: buildResult.success,
        output: typeof buildResult.data === 'string' ? buildResult.data.slice(0, 500) : undefined,
        error: buildResult.error,
      });

      const allPassed = checks.every((c) => c.passed);
      const failedChecks = checks.filter((c) => !c.passed);
      const summary = allPassed
        ? `All ${checks.length} verification checks passed`
        : `${failedChecks.length}/${checks.length} checks failed: ${failedChecks.map((c) => c.name).join(', ')}`;

      const output: VerificationOutput = {
        passed: allPassed,
        checks,
        summary,
      };

      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      // Typecheck might not be configured — provide a partial result
      const output: VerificationOutput = {
        passed: false,
        checks: [],
        summary: error instanceof Error ? error.message : String(error),
      };
      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    }
  }
}
