/**
 * audit — CLI commands for Phase 14 hardening systems.
 *
 * Exposes all 17 subsystems through:
 *   autic audit           — Full runtime audit (#1)
 *   autic stress          — Long-workflow stress testing (#2)
 *   autic protect         — Provider hardening + safety (#3, #6, #11)
 *   autic memory          — Memory leak detection (#4)
 *   autic validate        — Production validation suite (#15) + release readiness (#16)
 *   autic diagnose        — Error diagnostics (#13) + CLI UX hardening (#17)
 *   autic system          — Performance (#14), CLI resilience (#12), context hardening (#7)
 */

import type { AuditReport, StressTestResult, MemoryLeakReport, DeadlockReport } from '@autic/shared';
import { RuntimeAuditSystem } from '@autic/hardening';
import { StressTestRunner } from '@autic/hardening';
import { MemoryLeakDetector } from '@autic/hardening';
import { DeadlockStallProtector } from '@autic/hardening';
import { ProviderFailureHardener } from '@autic/hardening';
import { ExecutionSafetyValidator } from '@autic/hardening';
import { ContextHardeningSystem } from '@autic/hardening';
import { SwarmStabilityValidator } from '@autic/hardening';
import { CrashRecoveryHardener } from '@autic/hardening';
import { FilesystemSafetyValidator } from '@autic/hardening';
import { SecurityHardeningSystem } from '@autic/hardening';
import { CLIResilienceEnhancer } from '@autic/hardening';
import { ErrorDiagnosticsEnhancer } from '@autic/hardening';
import { PerformanceHardener } from '@autic/hardening';
import { ProductionValidationSuite } from '@autic/hardening';
import { ReleaseReadinessChecker } from '@autic/hardening';
import { CLIUXHardener } from '@autic/hardening';

// ─── autic audit — Full Runtime Audit (#1) ─────────────────────────

export async function auditCommand(action?: string): Promise<void> {
  if (!action || action === 'run') {
    console.log('\n  Running full runtime audit...');
    const audit = new RuntimeAuditSystem({ detailedMode: true });
    const report = await audit.runFullAudit();
    printAuditReport(report);
    return;
  }

  if (action === 'health') {
    const audit = new RuntimeAuditSystem();
    const check = await audit.checkSubsystem('runtime');
    console.log(`\n  [${check.status.toUpperCase()}] ${check.message}`);
    return;
  }

  console.log(`\n  Usage: autic audit [run|health]`);
}

function printAuditReport(report: AuditReport): void {
  const { summary } = report;
  const statusIcon = (s: string) => s === 'pass' ? '✓' : s === 'warn' ? '⚠' : '✗';

  console.log(`\n  Audit Report — ${new Date(report.timestamp).toISOString()}`);
  console.log(`  Duration: ${report.durationMs}ms | Status: ${report.overallStatus}`);
  console.log(`  Summary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed, ${summary.errors} errors\n`);

  for (const check of report.checks) {
    console.log(`  ${statusIcon(check.status)} [${check.category}] ${check.name}`);
    console.log(`    ${check.message}`);
    if (check.recommendation) console.log(`    → ${check.recommendation}`);
    if (check.details) console.log(`    Details: ${check.details}`);
    console.log('');
  }

  if (report.recommendations.length > 0) {
    console.log('  Recommendations:');
    for (const rec of report.recommendations) {
      console.log(`    • ${rec}`);
    }
    console.log('');
  }
}

// ─── autic stress — Long-Workflow Stress Testing (#2) ──────────────

export async function stressCommand(action?: string): Promise<void> {
  if (!action || action === 'run') {
    const runner = new StressTestRunner({ reportIntervalMs: 2000 });
    const result = await runner.runStressTest({
      durationMs: 30_000,
      concurrency: 4,
      workflowCount: 10,
      providerFailures: true,
      memoryPressure: true,
      queueSaturation: true,
      simulateOutages: ['openrouter'],
      taskTypes: ['code', 'review', 'test'],
    });
    printStressResult(result);
    return;
  }

  console.log(`\n  Usage: autic stress [run]`);
}

function printStressResult(result: StressTestResult): void {
  console.log(`\n  Stress Test Result — ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Tasks: ${result.completedTasks} completed, ${result.failedTasks} failed`);
  console.log(`  Error rate: ${result.errorRate.toFixed(1)}%`);
  console.log(`  Peak memory: ${result.peakMemoryMB.toFixed(0)}MB`);
  console.log(`  Avg latency: ${result.avgLatencyMs.toFixed(0)}ms\n`);

  for (const phase of result.phases) {
    const icon = phase.errors.length === 0 && phase.tasksFailed === 0 ? '✓' : '⚠';
    console.log(`  ${icon} ${phase.name}`);
    console.log(`    Tasks: ${phase.tasksCompleted} ok, ${phase.tasksFailed} failed | Latency: ${phase.avgLatencyMs}ms`);
    if (phase.errors.length > 0) {
      for (const err of phase.errors) console.log(`    Error: ${err}`);
    }
    console.log('');
  }

  if (result.issues.length > 0) {
    console.log('  Issues:');
    for (const issue of result.issues) console.log(`    • ${issue}`);
    console.log('');
  }
}

// ─── autic protect — Provider Hardening + Safety (#3, #6, #11) ────

export async function protectCommand(action?: string, name?: string): Promise<void> {
  if (!action || action === 'providers') {
    const hardener = new ProviderFailureHardener({
      maxConsecutiveFailures: 3,
      cooldownMs: 30_000,
      isolationPeriodMs: 120_000,
    });
    hardener.registerProvider('openrouter');
    hardener.registerProvider('ollama');
    const states = hardener.getAllProviderStates();
    console.log('\n  Provider Protection Status:');
    for (const s of states) {
      const icon = s.status === 'healthy' ? '✓' : s.status === 'degraded' ? '⚠' : '✗';
      console.log(`  ${icon} ${s.providerId} — ${s.status} (failures: ${s.consecutiveFailures})`);
    }
    console.log('');
    return;
  }

  if (action === 'safety') {
    const validator = new ExecutionSafetyValidator();
    const result = await validator.validateAll();
    console.log(`\n  Execution Safety: ${result.passed ? '✓ All checks passed' : '✗ Issues found'}`);
    for (const check of result.checks) {
      console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.message}`);
    }
    console.log('');
    return;
  }

  if (action === 'security') {
    const security = new SecurityHardeningSystem();
    const result = await security.validateAll();
    console.log(`\n  Security Hardening: ${result.passed ? '✓ All checks passed' : '✗ Issues found'}`);
    if (result.issues.length > 0) {
      for (const issue of result.issues) console.log(`  ✗ ${issue}`);
    }
    for (const rec of result.recommendations) console.log(`  → ${rec}`);
    console.log('');
    return;
  }

  if (action === 'stall') {
    const protector = new DeadlockStallProtector({ autoResolve: true });
    const deadlocks = protector.detectDeadlocks();
    const stalls = protector.detectStalls();
    console.log(`\n  Deadlocks: ${deadlocks.length} | Stalls: ${stalls.length}`);
    if (deadlocks.length > 0) {
      for (const d of deadlocks) console.log(`  ✗ Deadlock cycle: ${d.cycle?.join(' → ')}`);
    }
    if (stalls.length > 0) {
      for (const s of stalls) console.log(`  ⚠ Stalled: ${s.componentId} (${(s.stalledDurationMs / 1000).toFixed(0)}s)`);
    }
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic protect [providers|safety|security|stall]`);
}

// ─── autic memory — Memory Leak Detection (#4) ─────────────────────

export async function memoryCommand(action?: string): Promise<void> {
  if (!action || action === 'check') {
    const detector = new MemoryLeakDetector({ checkIntervalMs: 10_000 });
    const report = await detector.generateReport();
    printMemoryReport(report);
    return;
  }

  if (action === 'start') {
    const detector = new MemoryLeakDetector({ checkIntervalMs: 30_000 });
    detector.on('leakDetected', (report: MemoryLeakReport) => {
      console.log(`\n  ⚠ Potential leak detected (risk: ${report.riskLevel})`);
    });
    detector.on('warning', (msg: string) => console.log(`  ⚠ ${msg}`));
    detector.start();
    console.log('\n  Memory monitoring started (checking every 30s)');
    console.log('  Press Ctrl+C to stop\n');
    // Keep running
    await new Promise(() => {});
    return;
  }

  console.log(`\n  Usage: autic memory [check|start]`);
}

function printMemoryReport(report: MemoryLeakReport): void {
  const riskIcon = report.riskLevel === 'none' ? '✓' : report.riskLevel === 'low' || report.riskLevel === 'medium' ? '⚠' : '✗';
  console.log(`\n  Memory Report — Risk: ${report.riskLevel} ${riskIcon}`);
  console.log(`  Heap: ${report.heapUsedMB.toFixed(1)}MB / ${report.heapTotalMB.toFixed(1)}MB`);
  console.log(`  RSS: ${report.rssMB.toFixed(0)}MB | External: ${report.externalMB.toFixed(0)}MB`);
  console.log(`  Active sessions: ${report.sessionsActive} | Workers: ${report.workersActive}`);
  if (report.orphanedTasks.length > 0) {
    console.log(`  Orphaned tasks: ${report.orphanedTasks.length}`);
    for (const t of report.orphanedTasks) console.log(`    ${t.id} — idle ${(t.idleMs / 1000).toFixed(0)}s`);
  }
  if (report.suspiciousGrowth.length > 0) {
    console.log(`  Suspicious growth:`);
    for (const g of report.suspiciousGrowth) console.log(`    ${g.component}: +${g.growthMB}MB (${(g.timeWindowMs / 1000).toFixed(0)}s)`);
  }
  if (report.recommendations.length > 0) {
    console.log('  Recommendations:');
    for (const rec of report.recommendations) console.log(`    • ${rec}`);
  }
  console.log('');
}

// ─── autic validate — Production Validation (#15, #16) ─────────────

export async function validateCommand(action?: string): Promise<void> {
  if (!action || action === 'all') {
    const suite = new ProductionValidationSuite();
    const result = await suite.runAllSuites();
    printValidationResult(result);
    return;
  }

  if (action === 'suite') {
    const suite = new ProductionValidationSuite();
    const result = await suite.runSuite('custom');
    console.log(`\n  Suite: ${result.name} — ${result.passed ? '✓' : '✗'}`);
    console.log(`  Tests: ${result.testsPassed} passed, ${result.testsFailed} failed, ${result.testsSkipped} skipped`);
    console.log('');
    return;
  }

  if (action === 'release') {
    const checker = new ReleaseReadinessChecker();
    const result = await checker.checkAll('0.1.0');
    console.log(`\n  Release Readiness: ${result.passed ? '✓ Ready for release' : '✗ Issues found'}`);
    for (const check of result.checks) {
      console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.message}`);
    }
    if (result.recommendations.length > 0) {
      console.log('');
      for (const rec of result.recommendations) console.log(`  → ${rec}`);
    }
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic validate [all|suite|release]`);
}

function printValidationResult(result: { passed: boolean; summary: { totalSuites: number; passedSuites: number; failedSuites: number; totalTests: number; passedTests: number; failedTests: number }; suites: Array<{ name: string; passed: boolean; testsPassed: number; testsFailed: number }>; recommendations: string[] }): void {
  console.log(`\n  Validation Suite — ${result.passed ? '✓ ALL PASSED' : '✗ SOME FAILED'}`);
  console.log(`  Suites: ${result.summary.passedSuites}/${result.summary.totalSuites} passed`);
  console.log(`  Tests: ${result.summary.passedTests}/${result.summary.totalTests} passed, ${result.summary.failedTests} failed\n`);

  for (const suite of result.suites) {
    const icon = suite.passed ? '✓' : '✗';
    console.log(`  ${icon} ${suite.name}: ${suite.testsPassed} passed, ${suite.testsFailed} failed`);
  }
  console.log('');

  if (result.recommendations.length > 0) {
    for (const rec of result.recommendations) console.log(`  → ${rec}`);
    console.log('');
  }
}

// ─── autic diagnose — Error Diagnostics + UX (#13, #17) ────────────

export async function diagnoseCommand(action?: string): Promise<void> {
  if (!action || action === 'errors') {
    const diagnostics = new ErrorDiagnosticsEnhancer();
    const report = await diagnostics.generateReport();
    console.log(`\n  Error Diagnostics Report`);
    console.log(`  Recent errors (5min): ${report.recentErrors.length}`);
    console.log(`  Provider errors (15min): ${report.providerErrors.length}`);
    if (report.recentErrors.length > 0) {
      console.log('\n  Recent errors:');
      for (const e of report.recentErrors) {
        console.log(`    [${e.source}] ${e.message.slice(0, 120)} (×${e.frequency})`);
      }
    }
    if (report.recommendations.length > 0) {
      console.log('\n  Recommendations:');
      for (const rec of report.recommendations) console.log(`    • ${rec}`);
    }
    console.log('');
    return;
  }

  if (action === 'ux') {
    const ux = new CLIUXHardener();
    const result = await ux.validateUX();
    console.log(`\n  CLI UX Hardening: ${result.passed ? '✓ Good' : '✗ Issues'}`);
    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'boolean' && key !== 'passed') {
        console.log(`  ${val ? '✓' : '✗'} ${key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
      }
    }
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic diagnose [errors|ux]`);
}

// ─── autic system — Performance, Resilience, Context (#7, #12, #14)

export async function systemCommand(action?: string): Promise<void> {
  if (!action || action === 'perf') {
    const perf = new PerformanceHardener();
    const report = await perf.validatePerformance();
    console.log(`\n  Performance Report`);
    console.log(`  Startup: ${report.startupMs}ms | Render: ${report.renderFrequencyMs}ms`);
    console.log(`  Queue throughput: ${report.queueThroughput}/min | Memory cleanup: ${report.memoryCleanupMs}ms`);
    if (report.issues.length > 0) {
      console.log('\n  Issues:');
      for (const issue of report.issues) console.log(`    • ${issue}`);
    }
    if (report.improvements.length > 0) {
      console.log('\n  Improvements:');
      for (const imp of report.improvements) console.log(`    → ${imp}`);
    }
    console.log('');
    return;
  }

  if (action === 'resilience') {
    const resilience = new CLIResilienceEnhancer();
    const report = await resilience.validateCLIResilience();
    console.log(`\n  CLI Resilience: ${report.passed ? '✓ All checks passed' : '✗ Issues found'}`);
    if (report.issues.length > 0) {
      for (const issue of report.issues) console.log(`  ✗ ${issue}`);
    }
    for (const rec of report.recommendations) console.log(`  → ${rec}`);
    console.log('');
    return;
  }

  if (action === 'context') {
    const context = new ContextHardeningSystem();
    const result = await context.validateAll();
    console.log(`\n  Context Hardening: ${result.passed ? '✓ All checks passed' : '✗ Issues found'}`);
    if (result.issues.length > 0) {
      for (const issue of result.issues) console.log(`  ✗ ${issue}`);
    }
    for (const rec of result.recommendations) console.log(`  → ${rec}`);
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic system [perf|resilience|context]`);
}

// ─── autic swarm-hardening — Swarm Stability (#8) ──────────────────

export async function swarmHardeningCommand(action?: string): Promise<void> {
  if (!action || action === 'check') {
    const validator = new SwarmStabilityValidator();
    const result = await validator.validateSwarmExecution({
      maxDelegationDepth: 5,
      concurrency: 4,
      totalAgents: 10,
      partitions: 2,
    });
    console.log(`\n  Swarm Stability: ${result.passed ? '✓ Safe' : '✗ Issues'}`);
    if (result.issues.length > 0) {
      for (const issue of result.issues) console.log(`  ⚠ ${issue}`);
    }
    for (const rec of result.recommendations) console.log(`  → ${rec}`);
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic swarm-hardening [check]`);
}

// ─── autic fs — Filesystem Safety (#10) ────────────────────────────

export async function fsCommand(action?: string, path?: string): Promise<void> {
  if (!action || action === 'check') {
    const validator = new FilesystemSafetyValidator();
    const result = await validator.validateAll();
    console.log(`\n  Filesystem Safety: ${result.passed ? '✓ All checks passed' : '✗ Issues found'}`);
    if (result.issues.length > 0) {
      for (const issue of result.issues) console.log(`  ✗ ${issue}`);
    }
    for (const rec of result.recommendations) console.log(`  → ${rec}`);
    console.log('');
    return;
  }

  if (action === 'path' && path) {
    const validator = new FilesystemSafetyValidator();
    const result = validator.isPathSafe(path, process.cwd());
    console.log(`\n  Path safety check: ${result.safe ? '✓ Safe' : '✗ Blocked'}`);
    if (result.reason) console.log(`  Reason: ${result.reason}`);
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic fs [check|path <target>]`);
}

// ─── autic recovery — Crash Recovery Hardening (#9) ────────────────

export async function recoveryCommand(action?: string): Promise<void> {
  if (!action || action === 'check') {
    const recovery = new CrashRecoveryHardener();
    const result = await recovery.validateRecoveryCapabilities();
    console.log(`\n  Crash Recovery: ${result.passed ? '✓ All checks passed' : '✗ Issues found'}`);
    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'boolean' && key !== 'passed') {
        console.log(`  ${val ? '✓' : '✗'} ${key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
      }
    }
    if (result.issues.length > 0) {
      console.log('\n  Issues:');
      for (const issue of result.issues) console.log(`    • ${issue}`);
    }
    for (const rec of result.recommendations) console.log(`  → ${rec}`);
    console.log('');
    return;
  }

  console.log(`\n  Usage: autic recovery [check]`);
}
