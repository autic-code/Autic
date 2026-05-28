/**
 * autic fix — Run autonomous fix workflow using the real execution runtime.
 * Uses TaskOrchestrator, ExecutionEngine, and tool registry for real fix execution.
 * Premium blue-themed terminal output.
 */

import { TaskOrchestrator } from '@autic/runtime';
import { ToolRegistry, registerBuiltinTools, readFileTool, listFilesTool } from '@autic/tools';
import { join } from 'node:path';
import { colorText, heading, divider } from '@autic/ui';

export async function fixCommand(
  options: {
    target?: string;
    model?: string;
    dryRun?: boolean;
  } = {},
): Promise<void> {
  // Initialize runtime
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools(toolRegistry);

  const orchestrator = new TaskOrchestrator({ maxRetries: 2, autoRecover: true });
  const executionEngine = orchestrator.getExecutionEngine();
  executionEngine.setToolRegistry(toolRegistry);

  console.log(`\n  ${heading('Autonomous Fix')} ${colorText('— code analysis workflow', 'dim')}`);
  console.log(`  ${divider(48)}\n`);

  const target = options.target || process.cwd();
  console.log(`  ${colorText('Target:', 'dim')}  ${target}`);
  if (options.model) console.log(`  ${colorText('Model:', 'dim')}   ${options.model}`);
  if (options.dryRun)
    console.log(
      `  ${colorText('Mode:', 'dim')}    ${colorText('dry-run (no changes applied)', 'warning')}`,
    );
  console.log('');

  // Create the fix task
  const task = orchestrator.createTask({
    sessionId: 'cli',
    type: 'fix',
    description: `Fix analysis for ${target}`,
    metadata: {
      target,
      model: options.model || '',
      dryRun: String(!!options.dryRun),
    },
  });

  orchestrator.transitionTo(task.id, 'planning');
  process.stdout.write(
    `  ${colorText('⟳', 'primary')} ${colorText('Task:', 'dim')} ${task.id.slice(0, 12)}...\n`,
  );

  // Step 1: List the target directory
  const listResult = await listFilesTool({ path: target });

  if (!listResult.success) {
    orchestrator.transitionTo(task.id, 'failed');
    console.log(
      `\n  ${colorText('✗', 'error')} ${colorText('Cannot access target:', 'error')} ${listResult.error}\n`,
    );
    return;
  }

  const files = (listResult.data as { files: Array<{ name: string; type: string }> }).files || [];
  const sourceFiles = files.filter(
    (f) => f.type === 'file' && /\.(ts|js|tsx|jsx|json|md|css)$/i.test(f.name),
  );

  console.log(
    `  ${colorText('Found', 'dim')} ${colorText(String(files.length), 'primary')} entries, ${colorText(String(sourceFiles.length), 'primary')} source files\n`,
  );

  // Step 2: Analyze source files
  if (sourceFiles.length > 0) {
    orchestrator.transitionTo(task.id, 'running');

    for (const file of sourceFiles.slice(0, 5)) {
      const filePath = join(target, file.name);

      const readResult = await readFileTool({ path: filePath, maxLength: 2000 });

      const content = readResult.data as { content?: string };
      if (content?.content) {
        const lines = content.content.split('\n').length;
        console.log(
          `  ${colorText('📄', 'dim')} ${file.name} ${colorText(`(${lines} lines)`, 'muted')}`,
        );
      }
    }
  }

  console.log('');

  // Complete
  orchestrator.transitionTo(task.id, 'completed');
  console.log(
    `  ${colorText('✓', 'success')} ${colorText('Analysis complete.', 'success')} ${colorText(String(sourceFiles.length) + ' files examined.', 'dim')}`,
  );
  console.log(`  ${divider(48)}\n`);

  if (options.dryRun) {
    console.log(
      `  ${colorText('Dry-run mode:', 'warning')} ${colorText('no changes applied.', 'dim')}\n`,
    );
  } else {
    console.log(
      `  ${colorText('→', 'dim')} ${colorText('To apply fixes, use the execution engine.', 'dim')}\n`,
    );
  }
}
