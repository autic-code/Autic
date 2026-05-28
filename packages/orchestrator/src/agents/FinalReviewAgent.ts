/**
 * FinalReviewAgent — Final execution gate and validation.
 *
 * Responsibilities:
 *   - Final architecture validation
 *   - Runtime consistency checks
 *   - Security verification
 *   - Workflow completion approval
 *   - Produce structured FinalReviewOutput
 *
 * Acts as the final gate before pipeline completion.
 * Reviews all previous stage outputs and validates overall quality.
 */

import { timestamp } from '@autic/shared';
import type { 
  FinalReviewOutput, 
  TaskContract, 
  OrchestrationStage,
  PipelineState,
} from '@autic/shared';
import { createContract, fulfillContract, rejectContract } from '../contracts.js';

type ToolRunner = (toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class FinalReviewAgent {
  /**
   * Execute a final review stage.
   * Reviews pipeline state and produces an approval decision.
   */
  async execute(
    _goal: string,
    runTool: ToolRunner,
    _previousContract?: TaskContract,
    pipelineState?: PipelineState,
  ): Promise<TaskContract> {
    const contract = createContract(
      'final_review' as OrchestrationStage,
      'completed' as OrchestrationStage,
      'final_review',
      { timestamp: timestamp() },
    );

    try {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // 1. Check if all stages completed
      const allStagesComplete = pipelineState
        ? pipelineState.stagesFailed.length === 0 && pipelineState.status === 'running'
        : true;

      if (!allStagesComplete && pipelineState) {
        issues.push(`Pipeline has ${pipelineState.stagesFailed.length} failed stage(s)`);
        recommendations.push('Review failed stages before considering this complete');
      }

      // 2. Quick security check — look for exposed secrets in code
      try {
        const envResult = await runTool('list_files', { path: '.' });
        if (envResult.success && Array.isArray(envResult.data)) {
          const hasEnvFile = envResult.data.some((f: string) => f === '.env');
          if (hasEnvFile) {
            recommendations.push('.env file detected — ensure it is in .gitignore');
          }
        }
      } catch {
        // Skip if can't check
      }

      // 3. Architecture quick check
      let architectureScore = 85;
      try {
        const pkgResult = await runTool('read_file', { path: 'package.json', maxLength: 2000 });
        if (pkgResult.success && typeof pkgResult.data === 'string') {
          try {
            const pkg = JSON.parse(pkgResult.data);
            const hasBuild = !!pkg.scripts?.build;
            const hasTest = !!pkg.scripts?.test;
            if (!hasBuild) {
              issues.push('No build script configured');
              architectureScore -= 15;
            }
            if (!hasTest) {
              issues.push('No test script configured');
              architectureScore -= 10;
            }
          } catch {
            architectureScore -= 5;
          }
        }
      } catch {
        architectureScore -= 5;
      }

      // 4. Check git status for uncommitted changes
      try {
        const gitResult = await runTool('run_terminal', {
          command: 'git status --porcelain 2>&1 | head -20',
          timeoutMs: 10_000,
        });
        if (gitResult.success && typeof gitResult.data === 'string' && gitResult.data.length > 0) {
          const changedFiles = gitResult.data.split('\n').filter((l) => l.trim()).length;
          if (changedFiles > 0) {
            issues.push(`${changedFiles} uncommitted file(s) detected`);
            recommendations.push('Commit changes after review');
          }
        }
      } catch {
        // Not a git repo, skip
      }

      // Score calculations
      const securityScore = issues.filter((i) =>
        i.toLowerCase().includes('secret') || i.toLowerCase().includes('env'),
      ).length > 0 ? 60 : 90;

      const verificationScore = issues.filter((i) =>
        i.toLowerCase().includes('test') || i.toLowerCase().includes('build'),
      ).length > 0 ? 70 : 90;

      const approved = issues.length === 0;

      const summary = approved
        ? 'Final review approved — pipeline execution is complete'
        : `Final review identified ${issues.length} issue(s) — review recommendations before proceeding`;

      const output: FinalReviewOutput = {
        approved,
        architectureScore: Math.max(0, architectureScore),
        securityScore,
        verificationScore,
        issues,
        recommendations,
        summary,
      };

      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      return rejectContract(
        contract,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
