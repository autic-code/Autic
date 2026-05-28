/**
 * VerificationEngine — Deterministic verification layer for autonomous workflows.
 *
 * Validates command success, build/test output, lint results, file existence,
 * and custom checks. All verification is deterministic and structured.
 */

import type { VerificationResult, VerificationCheck } from '@autic/shared';

export interface VerificationEngineOptions {
  defaultTimeoutMs?: number;
}

export class VerificationEngine {
  constructor(_options: VerificationEngineOptions = {}) {}

  /**
   * Verify a build/typecheck command output.
   * Returns structured result with all checks.
   */
  async verifyBuild(
    output: string,
    exitCode: number,
    durationMs: number,
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];

    // Check exit code
    checks.push({
      type: 'command_success',
      name: 'Build exit code',
      passed: exitCode === 0,
      output:
        exitCode === 0 ? 'Build completed successfully' : `Build failed with exit code ${exitCode}`,
      error: exitCode !== 0 ? `Exit code ${exitCode}` : undefined,
      durationMs,
    });

    // Parse TypeScript error patterns
    if (exitCode !== 0) {
      const tsErrors = this.extractTypeScriptErrors(output);
      for (const err of tsErrors.slice(0, 5)) {
        checks.push({
          type: 'typecheck',
          name: `TS Error: ${err.code}`,
          passed: false,
          output: err.message,
          error: err.message,
          durationMs,
        });
      }
    }

    // Check for common failure patterns
    const hasErrors = this.hasFailurePatterns(output);
    if (hasErrors && exitCode === 0) {
      checks.push({
        type: 'build',
        name: 'Build output inspection',
        passed: false,
        output: 'Build output contains error patterns despite zero exit code',
        error: 'Error patterns found in output',
        durationMs,
      });
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
      summary:
        checks.length > 0
          ? `${checks.filter((c) => c.passed).length}/${checks.length} checks passed`
          : 'No verification checks performed',
      durationMs,
    };
  }

  /**
   * Verify test output.
   */
  async verifyTestOutput(
    output: string,
    exitCode: number,
    durationMs: number,
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];

    // Exit code check
    checks.push({
      type: 'command_success',
      name: 'Test exit code',
      passed: exitCode === 0,
      output: exitCode === 0 ? 'Tests passed' : `Tests failed (exit ${exitCode})`,
      error: exitCode !== 0 ? `Exit code ${exitCode}` : undefined,
      durationMs,
    });

    // Parse test results
    const parsed = this.parseTestResults(output);
    if (parsed) {
      checks.push({
        type: 'test',
        name: 'Test results',
        passed: parsed.failed === 0,
        output: `${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped`,
        error: parsed.failed > 0 ? `${parsed.failed} test(s) failed` : undefined,
        durationMs,
      });
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
      summary:
        checks.length > 0
          ? `${checks.filter((c) => c.passed).length}/${checks.length} checks passed`
          : 'No test output to verify',
      durationMs,
    };
  }

  /**
   * Verify lint output.
   */
  async verifyLintOutput(
    output: string,
    exitCode: number,
    durationMs: number,
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [
      {
        type: 'lint',
        name: 'Lint check',
        passed: exitCode === 0,
        output: exitCode === 0 ? 'No lint errors' : `Lint found issues (exit ${exitCode})`,
        error: exitCode !== 0 ? `Lint failed with exit code ${exitCode}` : undefined,
        durationMs,
      },
    ];

    // Extract warning/error counts
    const warningCount = (output.match(/warning/gi) || []).length;
    const errorCount = (output.match(/error/gi) || []).length;
    if (warningCount > 0 || errorCount > 0) {
      checks.push({
        type: 'lint',
        name: 'Lint issues count',
        passed: errorCount === 0,
        output: `${warningCount} warnings, ${errorCount} errors`,
        error: errorCount > 0 ? `${errorCount} lint error(s) found` : undefined,
        durationMs,
      });
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
      summary: `${checks.filter((c) => c.passed).length}/${checks.length} checks passed`,
      durationMs,
    };
  }

  /**
   * Verify that a file or set of files exists.
   */
  async verifyFileExists(
    filePaths: string[],
    accessCheck: (path: string) => Promise<boolean>,
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];
    const startTime = Date.now();

    for (const filePath of filePaths) {
      try {
        const exists = await accessCheck(filePath);
        checks.push({
          type: 'file_exists',
          name: `File: ${filePath}`,
          passed: exists,
          output: exists ? 'File exists' : 'File not found',
          error: exists ? undefined : `File not found: ${filePath}`,
        });
      } catch {
        checks.push({
          type: 'file_exists',
          name: `File: ${filePath}`,
          passed: false,
          output: 'File access check failed',
          error: `Could not verify file: ${filePath}`,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      passed: checks.every((c) => c.passed),
      checks,
      summary: `${checks.filter((c) => c.passed).length}/${checks.length} files verified`,
      durationMs,
    };
  }

  /**
   * Verify a generic command success.
   */
  async verifyCommandSuccess(
    output: string,
    exitCode: number,
    durationMs: number,
  ): Promise<VerificationResult> {
    return {
      passed: exitCode === 0,
      checks: [
        {
          type: 'command_success',
          name: 'Command success',
          passed: exitCode === 0,
          output: exitCode === 0 ? 'Command completed successfully' : output.slice(0, 200),
          error: exitCode !== 0 ? `Non-zero exit code: ${exitCode}` : undefined,
          durationMs,
        },
      ],
      summary: exitCode === 0 ? 'Command succeeded' : `Command failed (exit ${exitCode})`,
      durationMs,
    };
  }

  /**
   * Run multiple verification checks and aggregate results.
   */
  async verifyAll(checks: Array<() => Promise<VerificationResult>>): Promise<VerificationResult> {
    const allChecks: VerificationCheck[] = [];
    let totalDuration = 0;
    let allPassed = true;

    for (const check of checks) {
      try {
        const result = await check();
        allChecks.push(...result.checks);
        totalDuration += result.durationMs;
        if (!result.passed) allPassed = false;
      } catch (error) {
        allPassed = false;
        allChecks.push({
          type: 'custom',
          name: 'Verification check',
          passed: false,
          error: error instanceof Error ? error.message : 'Verification check threw',
        });
      }
    }

    return {
      passed: allPassed,
      checks: allChecks,
      summary: `${allChecks.filter((c) => c.passed).length}/${allChecks.length} checks passed`,
      durationMs: totalDuration,
    };
  }

  // ---- Private helpers ----

  private extractTypeScriptErrors(output: string): Array<{ code: string; message: string }> {
    const errors: Array<{ code: string; message: string }> = [];
    const tsPattern = /(?:src\/.*\.ts\(\d+,\d+\)|TS\d+):\s*(error\s+(TS\d+):\s*(.+))/gi;

    let match: RegExpExecArray | null;
    while ((match = tsPattern.exec(output)) !== null) {
      errors.push({
        code: match[2] || 'TSERROR',
        message: (match[3] || match[1] || '').trim(),
      });
    }

    return errors;
  }

  private hasFailurePatterns(output: string): boolean {
    const failurePatterns = [
      /error/i,
      /failure/i,
      /failed/i,
      /cannot find/i,
      /not found/i,
      /TS\d{4}/,
      /ERR!/,
      /✗/,
    ];
    return failurePatterns.some((p) => p.test(output));
  }

  private parseTestResults(
    output: string,
  ): { passed: number; failed: number; skipped: number } | null {
    const passed = this.extractCount(output, /(\d+)\s+passed/i);
    const failed = this.extractCount(output, /(\d+)\s+failed/i);
    const skipped = this.extractCount(output, /(\d+)\s+skipped/i);

    if (passed === null && failed === null) return null;

    return {
      passed: passed || 0,
      failed: failed || 0,
      skipped: skipped || 0,
    };
  }

  private extractCount(output: string, pattern: RegExp): number | null {
    const match = output.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }
}
