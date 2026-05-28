/**
 * autic run — Execute a task, file, or workflow using the real execution runtime.
 * Uses TaskOrchestrator, Queue, and TerminalEngine for real task execution.
 * Premium blue-themed terminal output.
 */

import { TaskOrchestrator, Queue, TerminalEngine, Watchdog } from '@autic/runtime';
import { ToolRegistry, registerBuiltinTools } from '@autic/tools';
import { colorText, heading, divider } from '@autic/ui';

export async function runCommand(
  script?: string,
  options: { model?: string; args?: string[]; timeout?: number } = {},
): Promise<void> {
  // Initialize runtime
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools(toolRegistry);

  const orchestrator = new TaskOrchestrator({ maxRetries: 2 });
  const executionEngine = orchestrator.getExecutionEngine();
  executionEngine.setToolRegistry(toolRegistry);

  const queue = new Queue<string, void>({ concurrency: 1 });
  const terminal = new TerminalEngine(options.timeout || 120_000);
  const watchdog = new Watchdog({ checkIntervalMs: 15_000, stallThresholdMs: 60_000 });
  watchdog.start();

  if (!script) {
    console.log(`\n  ${heading('Task Execution Engine')} ${colorText('— run commands and scripts', 'dim')}`);
    console.log(`  ${divider(48)}\n`);
    console.log(`  ${colorText('Usage:', 'primary')}\n`);
    console.log(`    ${colorText('autic run <shell-command>', 'bold')}         Execute a shell command`);
    console.log(`    ${colorText('autic run <script-path>', 'bold')}           Run a script file`);
    console.log(`    ${colorText('autic run --model <model> <task>', 'bold')}  Run with AI model\n`);
    console.log(`  ${colorText('Examples:', 'dim')}\n`);
    console.log(`    ${colorText('autic run build', 'primary')}`);
    console.log(`    ${colorText('autic run "npm test" --timeout 30000', 'primary')}`);
    console.log(`    ${colorText('autic run deploy --model gpt-4o', 'primary')}`);
    console.log(`  ${divider(48)}\n`);

    watchdog.stop();
    return;
  }

  console.log(`\n  ${heading('Execute')} ${colorText(script, 'primary')}`);
  console.log(`  ${divider(48)}\n`);

  if (options.model) {
    console.log(`  ${colorText('Model:', 'dim')}   ${options.model}`);
  }
  if (options.timeout) {
    console.log(`  ${colorText('Timeout:', 'dim')} ${(options.timeout / 1000).toFixed(0)}s`);
  }

  // Create a task and enqueue it
  const task = orchestrator.createTask({
    sessionId: 'cli',
    type: 'run',
    description: script,
    metadata: { model: options.model || '', timeout: String(options.timeout || '') },
  });

  orchestrator.transitionTo(task.id, 'queued');
  process.stdout.write(`  ${colorText('⟳', 'primary')} ${colorText('Task:', 'dim')} ${task.id.slice(0, 12)}...\n`);

  // Execute via terminal engine
  orchestrator.transitionTo(task.id, 'running');

  try {
    const result = await terminal.execute({
      command: script,
      args: options.args || [],
      timeoutMs: options.timeout || 120_000,
    });

    // Output results
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }

    console.log('');
    if (result.exitCode === 0) {
      orchestrator.transitionTo(task.id, 'completed');
      console.log(`  ${colorText('✓', 'success')} ${colorText('Completed', 'success')} ${colorText(`(${(result.durationMs / 1000).toFixed(1)}s)`, 'dim')}`);
    } else {
      orchestrator.transitionTo(task.id, 'failed');
      console.log(`  ${colorText('✗', 'error')} ${colorText('Failed', 'error')} ${colorText(`exit code ${result.exitCode} (${(result.durationMs / 1000).toFixed(1)}s)`, 'dim')}`);
    }
    console.log(`  ${divider(48)}\n`);
  } catch (error) {
    orchestrator.transitionTo(task.id, 'failed');
    console.error(`  ${colorText('✗', 'error')} ${colorText('Execution error:', 'error')} ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  ${divider(48)}\n`);
  }

  watchdog.stop();
}
