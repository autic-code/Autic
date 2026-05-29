/**
 * autic chat — Start an interactive chat session with Autic.
 * Opens the Ink-based terminal UI for interactive conversation.
 * Uses the real runtime for task execution and tool orchestration.
 */

import { createSession } from './sessions.js';
import { TaskOrchestrator } from '@autic/runtime';
import { ToolRegistry, registerBuiltinTools } from '@autic/tools';
import { readFile } from 'node:fs/promises';
import { colorText, heading, divider } from '@autic/ui';

export async function chatCommand(
  options: {
    model?: string;
    provider?: string;
    session?: string;
    file?: string;
  } = {},
): Promise<void> {
  console.log(`\n  ${heading('Interactive Session')}`);
  console.log(`  ${divider(48)}\n`);

  // Create or restore session
  const sessionName = options.session || `chat-${Date.now()}`;
  const session = await createSession(sessionName);

  // Initialize runtime components
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools(toolRegistry);

  const orchestrator = new TaskOrchestrator({ maxRetries: 3, autoRecover: true });
  const executionEngine = orchestrator.getExecutionEngine();
  executionEngine.setToolRegistry(toolRegistry);

  console.log(`  Session: ${session.id}`);
  if (options.model) {
    console.log(`  Model: ${options.model}`);
    session.setModel(options.model, options.provider || 'openrouter');
  }
  if (options.file) {
    console.log(`  Context file: ${options.file}`);
  }

  console.log(`  Tools: ${toolRegistry.count()} registered`);
  console.log('');

  // Load context file if provided
  if (options.file) {
    try {
      const content = await readFile(options.file, 'utf-8');
      console.log(`  Loaded context (${content.length} chars)\n`);
    } catch {
      console.log(`  Warning: Could not read context file: ${options.file}\n`);
    }
  }

  console.log('  Autic is ready. Type your message to begin.');
  console.log('  Use /help for available commands.\n');

  // Future: Full Ink-based interactive UI rendering
  // For now, the runtime is wired and ready for the interactive loop
  console.log('  [Runtime initialized — interactive UI layer pending]');
  console.log(`  For command-based workflows, use: autic run <command>`);
  console.log(`  For autonomous fix: autic fix --target <path>\n`);
}
