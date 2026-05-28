/**
 * autic workflow — Execute an autonomous engineering workflow.
 *
 * Uses the full Phase 5 execution loop:
 *   Analyze → Plan → Execute → Verify → Repair → Complete
 *
 * Displays real-time TODO progress with structured UI.
 */

import { ExecutionCoordinator, ExecutionMemory, ContextSelector } from '@autic/workflow';
import { ToolRegistry, registerBuiltinTools } from '@autic/tools';
import * as toolHandlers from '@autic/tools';
import {
  renderTodoList,
  todoBoardHeader,
  statusLine,
  executionSummary,
  colorText,
} from '@autic/ui';
import type { TodoItem } from '@autic/ui';

export async function workflowCommand(
  goal?: string,
  options: {
    steps?: string;
    timeout?: string;
    allowDangerous?: boolean;
    verbose?: boolean;
  } = {},
): Promise<void> {
  // Initialize runtime
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools(toolRegistry);

  const coordinator = new ExecutionCoordinator({
    maxSteps: parseInt(options.steps || '20', 10),
    workflowTimeoutMs: parseInt(options.timeout || '300000', 10),
    allowDangerousActions: options.allowDangerous || false,
    persistState: true,
  });

  const memory = new ExecutionMemory();
  const contextSelector = new ContextSelector();

  if (!goal) {
    console.log(colorText('❯ Autic Workflow — Autonomous Engineering Loop', 'bold'));
    console.log('');
    console.log('  Usage:');
    console.log('');
    console.log('    autic workflow "Build a REST API"     Plan and execute a task');
    console.log('    autic workflow "Fix TypeScript errors" Autonomous fix workflow');
    console.log('    autic workflow "Run tests and deploy"  Multi-step workflow');
    console.log('');
    console.log('  Options:');
    console.log('    --steps <n>           Max execution steps (default: 20)');
    console.log('    --timeout <ms>        Workflow timeout in ms (default: 300000)');
    console.log('    --allow-dangerous     Allow potentially dangerous operations');
    console.log('    --verbose             Show detailed execution events');
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    autic workflow "Build the project"');
    console.log('    autic workflow "Fix lint errors" --steps 10');
    console.log('    autic workflow "Deploy to staging" --allow-dangerous');
    console.log('');
    return;
  }

  console.log(colorText('❯ Autic Workflow', 'bold'));
  console.log(colorText(`  Goal: ${goal}`, 'dim'));
  if (options.verbose) {
    console.log('');
    console.log(statusLine('Planning workflow...', 'running'));
    console.log('');
  }

  // Wire real tool executor
  coordinator.setToolExecutor(async (toolName: string, args: Record<string, unknown>) => {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    // Look up the handler from the statically imported module
    try {
      const handler = (toolHandlers as Record<string, unknown>)[tool.handler];

      if (typeof handler !== 'function') {
        return { success: false, error: `Tool handler not found: ${toolName}` };
      }

      const result = await (handler as (...args: unknown[]) => unknown)(args);
      return result as { success: boolean; data?: unknown; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get context-aware file selection
  const contextSelection = await contextSelector.selectForTask(goal, {
    maxFiles: 10,
    maxTokens: 8_000,
  });

  if (options.verbose && contextSelection.files.length > 0) {
    console.log(colorText(`  Context: ${contextSelection.strategy}`, 'dim'));
    console.log('');
  }

  // Listen for execution events
  const todoItems: Map<string, TodoItem> = new Map();

  coordinator.on('event', (event) => {
    if (event.stepId && event.type.includes('step')) {
      const existing = todoItems.get(event.stepId);
      if (existing) {
        existing.status = event.type.includes('completed')
          ? 'success'
          : event.type.includes('failed')
            ? 'failed'
            : 'running';
        existing.durationMs = (event.data?.durationMs as number) || undefined;
        existing.error = (event.data?.error as string) || undefined;
      }
    }
  });

  // Run the workflow
  const startTime = Date.now();

  try {
    const result = await coordinator.executeWorkflow({
      sessionId: 'cli',
      goal,
      files: contextSelection.files.map((f) => f.path),
    });

    const durationMs = Date.now() - startTime;

    // Build TODO display from result
    const displayItems: TodoItem[] = result.steps.map((step) => ({
      id: step.id,
      description: step.description,
      status:
        step.status === 'success'
          ? 'success'
          : step.status === 'failed'
            ? 'failed'
            : step.status === 'skipped'
              ? 'skipped'
              : step.status === 'running'
                ? 'running'
                : 'pending',
      type: step.type,
      durationMs: step.durationMs,
      error: step.error,
    }));

    const completed = displayItems.filter((i) => i.status === 'success').length;
    const failed = displayItems.filter((i) => i.status === 'failed').length;

    // Render TODO board
    console.log('');
    console.log(
      renderTodoList(displayItems, {
        title: goal.slice(0, 60),
        completed,
        total: displayItems.length,
        statusText:
          result.status === 'completed'
            ? 'All steps completed'
            : result.status === 'failed'
              ? `Failed: ${result.error?.slice(0, 80) || 'Unknown error'}`
              : `Status: ${result.status}`,
      }),
    );

    // Execution summary
    console.log(executionSummary(durationMs, completed, failed, result.totalRetries));

    // Detailed event log in verbose mode
    if (options.verbose) {
      const events = coordinator.getObservability().getRecentEvents(10);
      if (events.length > 0) {
        console.log(colorText('  Recent Events:', 'dim'));
        for (const event of events) {
          const ts = new Date(event.timestamp).toLocaleTimeString();
          console.log(colorText(`    [${ts}] ${event.message.slice(0, 80)}`, 'muted'));
        }
        console.log('');
      }
    }

    // Store completed task in memory
    const plan = coordinator.getPlanner().plan({ sessionId: 'cli', goal });
    await memory.storeCompletedTask(plan, result);

    process.exit(result.status === 'completed' ? 0 : 1);
  } catch (error) {
    console.error(
      `\n  ${colorText('✗', 'error')} Workflow execution error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
