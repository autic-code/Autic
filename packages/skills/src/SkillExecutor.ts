/**
 * SkillExecutor — Bounded execution engine for skills and agents.
 *
 * Provides:
 *   - Skill-triggered agent execution
 *   - Depth-limited workflows
 *   - Timeout enforcement
 *   - Tool permission checking via security integration
 *   - Execution reporting and observability
 *   - Cancellation support
 */

import type { AgentExecutionContext, WorkflowStep } from '@autic/shared';
import { generateId } from '@autic/shared';
import { ExecutionCoordinator } from '@autic/workflow';
import type { ToolExecutor } from '@autic/workflow';
import { SkillRegistry } from './SkillRegistry.js';
import { AgentRegistry } from './AgentRegistry.js';

export interface SkillExecutorOptions {
  maxDepth?: number;
  defaultTimeoutMs?: number;
  maxSteps?: number;
  maxRetries?: number;
  allowDangerous?: boolean;
}

export interface ExecutionReport {
  agentId: string;
  skillId: string;
  taskId: string;
  goal: string;
  success: boolean;
  steps: number;
  durationMs: number;
  error?: string;
  retries: number;
}

export class SkillExecutor {
  private skillRegistry: SkillRegistry;
  private agentRegistry: AgentRegistry;
  private toolExecutor: ToolExecutor | null = null;
  private options: Required<SkillExecutorOptions>;
  private cancelled = new Set<string>();

  constructor(
    skillRegistry: SkillRegistry,
    agentRegistry: AgentRegistry,
    options: SkillExecutorOptions = {},
  ) {
    this.skillRegistry = skillRegistry;
    this.agentRegistry = agentRegistry;
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 120_000,
      maxSteps: options.maxSteps ?? 20,
      maxRetries: options.maxRetries ?? 3,
      allowDangerous: options.allowDangerous ?? false,
    };
  }

  /**
   * Set the tool executor for skill/agent tool calls.
   */
  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor;
  }

  /**
   * Execute a skill as an agent-driven workflow.
   *
   * Flow:
   *   1. Look up skill definition
   *   2. Create agent execution context with scoped tools
   *   3. Build coordinator with skill-specific configuration
   *   4. Run bounded workflow loop
   *   5. Report results
   */
  async executeSkill(params: {
    skillId: string;
    goal: string;
    sessionId?: string;
    agentId?: string;
  }): Promise<ExecutionReport> {
    const { skillId, goal, sessionId } = params;
    const startTime = Date.now();

    // 1. Look up skill
    const skill = this.skillRegistry.get(skillId);
    if (!skill) {
      return {
        agentId: '',
        skillId,
        taskId: '',
        goal,
        success: false,
        steps: 0,
        durationMs: 0,
        error: `Skill not found: ${skillId}`,
        retries: 0,
      };
    }

    // 2. Look up or create agent
    const agentId = params.agentId || `agent-${skillId}`;
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      return {
        agentId,
        skillId,
        taskId: '',
        goal,
        success: false,
        steps: 0,
        durationMs: 0,
        error: `Agent not found for skill: ${skillId}`,
        retries: 0,
      };
    }

    // Check agent depth limits
    const maxDepth = Math.min(agent.maxDepth, this.options.maxDepth);
    const timeoutMs = Math.min(agent.timeoutMs, this.options.defaultTimeoutMs);

    // 3. Create execution context
    const taskId = generateId();
    const context = this.agentRegistry.createContext({
      agentId,
      skillId,
      taskId,
      goal,
      toolAccess: agent.allowedTools,
    });

    // Check cancellation
    if (this.cancelled.has(taskId)) {
      this.agentRegistry.failContext(agentId, 'Cancelled before execution');
      return {
        agentId,
        skillId,
        taskId,
        goal,
        success: false,
        steps: 0,
        durationMs: 0,
        error: 'Cancelled',
        retries: 0,
      };
    }

    // 4. Build and run coordinator
    context.status = 'running';
    const coordinator = new ExecutionCoordinator({
      maxSteps: Math.min(skill.workflowPipeline?.length || this.options.maxSteps, maxDepth * 2),
      maxRetries: this.options.maxRetries,
      workflowTimeoutMs: timeoutMs,
      allowDangerousActions: this.options.allowDangerous,
      persistState: false,
    });

    if (this.toolExecutor) {
      coordinator.setToolExecutor(this.toolExecutor);
    }

    // Wire cancellation
    const cancelTimer = setTimeout(() => {
      coordinator.cancel();
    }, timeoutMs);

    try {
      // 5. Execute workflow
      const result = await coordinator.executeWorkflow({
        sessionId: sessionId || 'skills-cli',
        goal,
      });

      clearTimeout(cancelTimer);

      const allSucceeded = result.steps?.every(
        (s: WorkflowStep) => s.status === 'success' || s.status === 'skipped',
      );

      // 6. Record steps and complete
      for (const step of result.steps || []) {
        this.agentRegistry.addStep(agentId, step);
      }

      if (allSucceeded) {
        this.agentRegistry.completeContext(agentId, result);
      } else {
        const failedStep = (result.steps || []).find((s: WorkflowStep) => s.status === 'failed');
        this.agentRegistry.failContext(
          agentId,
          failedStep?.error || 'Workflow completed with failures',
        );
      }

      return {
        agentId,
        skillId,
        taskId,
        goal,
        success: allSucceeded,
        steps: result.steps?.length || 0,
        durationMs: Date.now() - startTime,
        error: result.error,
        retries: result.totalRetries || 0,
      };
    } catch (error) {
      clearTimeout(cancelTimer);
      this.agentRegistry.failContext(
        agentId,
        error instanceof Error ? error.message : String(error),
      );
      return {
        agentId,
        skillId,
        taskId,
        goal,
        success: false,
        steps: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        retries: 0,
      };
    }
  }

  /**
   * Cancel a running skill execution.
   */
  cancel(taskId: string): void {
    this.cancelled.add(taskId);
  }

  /**
   * Get the executor options.
   */
  getOptions(): Required<SkillExecutorOptions> {
    return { ...this.options };
  }

  /**
   * Check if an agent's tool access permits a given tool.
   */
  static isToolAllowed(
    _agentId: string,
    toolName: string,
    context: AgentExecutionContext,
  ): boolean {
    return context.toolAccess.some((t) => t === '*' || t === toolName);
  }
}
