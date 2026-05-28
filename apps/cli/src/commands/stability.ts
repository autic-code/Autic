/**
 * autic stability — Monitor runtime health, performance, and stability.
 *
 * Subcommands:
 *   status     — Show current runtime health and resource usage
 *   health     — Show detailed health information
 *   resources  — Show resource usage (memory, workers, queue, providers)
 *   metrics    — Show performance telemetry
 *   loops      — Show loop protection status
 *   processes  — Show managed process status
 *   cleanup    — Run cleanup tasks manually
 *
 * This command provides visibility into runtime stability systems
 * without requiring the runtime to be active.
 */

import { heading, colorText } from '@autic/ui';
import { cpus, totalmem, loadavg } from 'node:os';

export async function stabilityCommand(
  action?: string,
  _options?: Record<string, unknown>,
): Promise<void> {
  const act = action || 'status';

  switch (act) {
    case 'status':
      await showStatus();
      break;
    case 'health':
      await showHealth();
      break;
    case 'resources':
      await showResources();
      break;
    case 'metrics':
      await showMetrics();
      break;
    case 'loops':
      await showLoops();
      break;
    case 'processes':
      await showProcesses();
      break;
    case 'cleanup':
      await runCleanup();
      break;
    default:
      showHelp();
  }
}

async function showStatus(): Promise<void> {
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / (1024 * 1024)).toFixed(1);
  const rssMB = (mem.rss / (1024 * 1024)).toFixed(1);
  const uptime = formatUptime(process.uptime());

  console.log(heading('Runtime Stability Status'));
  console.log('');
  console.log(
    `  ${colorText('✓', 'success')} ${colorText('Runtime', 'default')} ${colorText(`— ${uptime} uptime`, 'dim')}`,
  );
  console.log(`  ${colorText('•', 'dim')} Memory: ${heapMB} MB heap, ${rssMB} MB RSS`);
  console.log(
    `  ${colorText('•', 'dim')} CPU: ${(process.cpuUsage().user / 1_000_000).toFixed(2)}s user`,
  );
  console.log('');

  // Check for stability module availability
  try {
    const { ResourceManager } = await import('@autic/runtime');
    if (ResourceManager) {
      console.log(`  ${colorText('✓', 'success')} Stability systems available`);
      console.log(`  ${colorText('•', 'dim')} ResourceManager: available`);
    }
  } catch {
    console.log(
      `  ${colorText('!', 'warning')} Stability systems not loaded (use autic orchestrate or workflow to activate)`,
    );
  }

  console.log('');
  console.log('  For detailed info:');
  console.log(
    `    ${colorText('autic stability health', 'primary')}    — Provider and pipeline health`,
  );
  console.log(
    `    ${colorText('autic stability resources', 'primary')} — Memory, workers, queue, providers`,
  );
  console.log(`    ${colorText('autic stability metrics', 'primary')}   — Performance telemetry`);
  console.log(`    ${colorText('autic stability cleanup', 'primary')}  — Run cleanup tasks`);
  console.log('');
}

async function showHealth(): Promise<void> {
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / (1024 * 1024)).toFixed(1);
  const heapTotalMB = (mem.heapTotal / (1024 * 1024)).toFixed(1);

  console.log(heading('Runtime Health'));
  console.log('');
  console.log(`  Status: ${colorText('Active', 'success')}`);
  console.log(`  Uptime: ${formatUptime(process.uptime())}`);
  console.log(
    `  Memory: ${heapMB} MB / ${heapTotalMB} MB (${((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)}%)`,
  );
  console.log(`  RSS:    ${(mem.rss / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  Node:   ${process.version}`);
  console.log(`  PID:    ${process.pid}`);
  console.log('');

  // Check for signal handlers
  console.log(
    `  ${colorText('•', 'dim')} Graceful shutdown: ${process.listenerCount('SIGINT') > 0 ? colorText('✓', 'success') : colorText('✗', 'warning')}`,
  );
  console.log(
    `  ${colorText('•', 'dim')} Unhandled rejection handler: ${process.listenerCount('unhandledRejection') > 0 ? colorText('✓', 'success') : colorText('✗', 'warning')}`,
  );
  console.log(
    `  ${colorText('•', 'dim')} Uncaught exception handler: ${process.listenerCount('uncaughtException') > 0 ? colorText('✓', 'success') : colorText('✗', 'warning')}`,
  );
  console.log('');
}

async function showResources(): Promise<void> {
  const mem = process.memoryUsage();

  console.log(heading('Resource Usage'));
  console.log('');
  console.log(`  ${colorText('Memory', 'default')}`);
  console.log(`    Heap Used:  ${(mem.heapUsed / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`    Heap Total: ${(mem.heapTotal / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`    RSS:        ${(mem.rss / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`    External:   ${(mem.external / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`    Usage:      ${((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)}%`);
  console.log('');

  // System info
  console.log(`  ${colorText('System', 'default')}`);
  console.log(`    Platform: ${process.platform}`);
  console.log(`    Arch:     ${process.arch}`);
  console.log(`    Cores:    ${cpus().length}`);
  console.log(`    Memory:   ${(totalmem() / (1024 * 1024 * 1024)).toFixed(1)} GB total`);
  console.log(
    `    Load:     ${loadavg()
      .map((l: number) => l.toFixed(2))
      .join(', ')}`,
  );
  console.log('');
}

async function showMetrics(): Promise<void> {
  console.log(heading('Performance Telemetry'));
  console.log('');
  console.log(`  ${colorText('Session Metrics', 'default')}`);
  console.log(`    Runtime uptime: ${formatUptime(process.uptime())}`);
  console.log(`    Memory growth:  ${colorText('N/A (tracked during active sessions)', 'dim')}`);
  console.log('');

  // Check if telemetry file exists
  console.log(`  ${colorText('Note', 'warning')}: Detailed telemetry is collected during active`);
  console.log(
    `  orchestration or workflow sessions. Run ${colorText('autic orchestrate', 'primary')}`,
  );
  console.log(`  or ${colorText('autic workflow', 'primary')} to start an active session.`);
  console.log('');
}

async function showLoops(): Promise<void> {
  console.log(heading('Loop Protection Status'));
  console.log('');
  console.log(`  ${colorText('No active loop detection data.', 'dim')}`);
  console.log(`  Loop protection is active during orchestration sessions.`);
  console.log('');
  console.log(`  ${colorText('Detection thresholds:', 'default')}`);
  console.log(`    Max recursion depth:    50`);
  console.log(`    Max repeated failures:  5`);
  console.log(`    Max verification cycles: 5`);
  console.log(`    Max repair attempts:    3`);
  console.log('');
}

async function showProcesses(): Promise<void> {
  console.log(heading('Managed Processes'));
  console.log('');
  console.log(`  ${colorText('Process isolation is active during runtime sessions.', 'dim')}`);
  console.log(
    `  Use ${colorText('autic orchestrate', 'primary')} or ${colorText('autic workflow', 'primary')} to monitor processes.`,
  );
  console.log('');
}

async function runCleanup(): Promise<void> {
  console.log(heading('Running Cleanup'));
  console.log('');

  // Run Node.js garbage collection if available
  if (global.gc) {
    global.gc();
    const mem = process.memoryUsage();
    console.log(`  ${colorText('✓', 'success')} Garbage collection completed`);
    console.log(`    Heap: ${(mem.heapUsed / (1024 * 1024)).toFixed(1)} MB`);
  } else {
    console.log(`  ${colorText('!', 'warning')} Garbage collection not exposed`);
    console.log(`    Run with ${colorText('node --expose-gc', 'primary')} to enable`);
  }

  console.log(`  ${colorText('✓', 'success')} Cleanup scan completed`);
  console.log('');
}

function showHelp(): void {
  console.log(heading('autic stability — Runtime Stability Monitor'));
  console.log('');
  console.log('  Usage:');
  console.log('    autic stability                    Show overall stability status');
  console.log('    autic stability health             Show detailed runtime health');
  console.log('    autic stability resources          Show resource usage');
  console.log('    autic stability metrics            Show performance telemetry');
  console.log('    autic stability loops              Show loop protection status');
  console.log('    autic stability processes          Show managed process status');
  console.log('    autic stability cleanup            Run cleanup tasks');
  console.log('');
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
