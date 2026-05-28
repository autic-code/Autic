/**
 * Execution Engine — Orchestrates tool execution within a task lifecycle.
 * Manages tool calls, result capture, and continuation flow.
 * Integrates with permission system via risk-aware execution hooks.
 * Real tool dispatch is wired externally via setToolDispatcher.
 */

import type { ExecutionStep, ToolResult, RiskLevel } from '@autic/shared';
import { timestamp, generateId } from '@autic/shared';
import { EventEmitter } from 'node:events';
import type { ToolDefinition } from '@autic/shared';

// Tool registry interface to avoid direct dependency on @autic/tools
interface ToolRegistryLike {
  get(id: string): ToolDefinition | undefined;
  count(): number;
}

/**
 * Tool dispatcher — executes a tool by name with given args.
 * Wired externally by the CLI layer with real tool implementations.
 */
export type ToolDispatcher = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<ToolResult>;

export interface EngineOptions {
  toolRegistry?: ToolRegistryLike;
}

export interface ExecutionEvents {
  toolExecuting: (step: ExecutionStep) => void;
  toolCompleted: (step: ExecutionStep, result: ToolResult) => void;
  toolFailed: (step: ExecutionStep, error: string) => void;
}

export class ExecutionEngine extends EventEmitter {
  private toolRegistry: ToolRegistryLike;
  private toolDispatcher: ToolDispatcher | null = null;

  constructor(options: EngineOptions = {}) {
    super();
    this.toolRegistry = { get: () => undefined, count: () => 0 };
    if (options.toolRegistry) {
      this.toolRegistry = options.toolRegistry;
    }
  }

  setToolRegistry(registry: ToolRegistryLike): void {
    this.toolRegistry = registry;
  }

  getToolRegistry(): ToolRegistryLike {
    return this.toolRegistry;
  }

  /**
   * Set the tool dispatcher that maps tool names to real implementations.
   * Called by the parent orchestrator or CLI layer with wired tool functions.
   */
  setToolDispatcher(dispatcher: ToolDispatcher): void {
    this.toolDispatcher = dispatcher;
  }

  getToolDispatcher(): ToolDispatcher | null {
    return this.toolDispatcher;
  }

  /**
   * Execute a tool as part of a task step.
   * Dispatches to the registered tool dispatcher for real execution.
   * Returns the tool result with timing and structured output.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    _options?: { riskLevel?: RiskLevel; taskId?: string },
  ): Promise<{ step: ExecutionStep; result: ToolResult }> {
    const step: ExecutionStep = {
      id: generateId(),
      type: 'tool_call',
      toolName,
      input: args,
      startedAt: timestamp(),
      status: 'running',
    };

    this.emit('toolExecuting', step);
    const startTime = Date.now();

    try {
      const tool = this.toolRegistry.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      if (!this.toolDispatcher) {
        throw new Error(
          `No tool dispatcher configured for ${toolName}. Call setToolDispatcher() with real implementations.`,
        );
      }

      // Real execution via the wired dispatcher
      const result = await this.toolDispatcher(toolName, args);

      const durationMs = Date.now() - startTime;
      step.output = result.data;
      step.status = result.success ? 'success' : 'failed';
      step.durationMs = durationMs;
      step.completedAt = timestamp();

      if (result.success) {
        this.emit('toolCompleted', step, result);
      } else {
        step.error = result.error;
        this.emit('toolFailed', step, result.error || 'Unknown error');
      }

      return { step, result };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      step.status = 'failed';
      step.error = errorMsg;
      step.durationMs = durationMs;
      step.completedAt = timestamp();

      this.emit('toolFailed', step, errorMsg);
      return {
        step,
        result: { success: false, error: errorMsg, durationMs },
      };
    }
  }

  /**
   * Assess risk level of a tool call based on the tool type and arguments.
   * Used by the permission system to determine if approval is needed.
   */
  assessRisk(toolName: string, _args: Record<string, unknown>): { level: RiskLevel; score: number; reasons: string[] } {
    const highRiskTools = ['run_terminal', 'write_file', 'delete_file'];
    const mediumRiskTools = ['create_file', 'install_package', 'modify_config'];
    const lowRiskTools = ['read_file', 'list_files', 'search_files', 'grep'];

    if (highRiskTools.includes(toolName)) {
      return { level: 'high', score: 0.8, reasons: [`${toolName} can modify system state`] };
    }
    if (mediumRiskTools.includes(toolName)) {
      return { level: 'medium', score: 0.5, reasons: [`${toolName} modifies project files`] };
    }
    if (lowRiskTools.includes(toolName)) {
      return { level: 'low', score: 0.2, reasons: [`${toolName} is read-only`] };
    }

    return { level: 'medium', score: 0.5, reasons: [`Unknown tool: ${toolName}`] };
  }
}
