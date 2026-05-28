/**
 * AgentRegistry — Registry for specialized agent definitions.
 *
 * Agents are NOT fake AGI entities. They are bounded execution coordinators
 * with strict depth limits, scoped tool access, and capability metadata.
 *
 * Each agent:
 *   - Has a defined max execution depth
 *   - Has a timeout
 *   - Has a list of allowed tools
 *   - Can prefer a specific model/provider
 *   - Carries capability metadata for routing
 */

import type { AgentDefinition, AgentExecutionContext, WorkflowStep } from '@autic/shared';
import { generateId } from '@autic/shared';

export interface AgentRegistryOptions {
  maxAgents?: number;
}

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();
  private executionContexts: Map<string, AgentExecutionContext> = new Map();
  private maxAgents: number;

  constructor(options: AgentRegistryOptions = {}) {
    this.maxAgents = options.maxAgents || 20;
  }

  /**
   * Register an agent definition.
   */
  register(agent: AgentDefinition): void {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Agent registry full (max ${this.maxAgents})`);
    }
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, { ...agent });
  }

  /**
   * Unregister an agent by id.
   */
  unregister(id: string): boolean {
    this.executionContexts.delete(id);
    return this.agents.delete(id);
  }

  /**
   * Get an agent definition.
   */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * Find agents by capability.
   */
  findByCapability(capability: string): AgentDefinition[] {
    return this.list().filter((a) =>
      a.capabilities.some((c) => c.toLowerCase().includes(capability.toLowerCase())),
    );
  }

  /**
   * List all registered agents.
   */
  list(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Create an execution context for an agent.
   * Returns a bounded, isolated runtime context.
   */
  createContext(params: {
    agentId: string;
    skillId: string;
    taskId: string;
    goal: string;
    toolAccess?: string[];
  }): AgentExecutionContext {
    const agent = this.agents.get(params.agentId);
    if (!agent) throw new Error(`Agent not found: ${params.agentId}`);

    const context: AgentExecutionContext = {
      agentId: params.agentId,
      skillId: params.skillId,
      taskId: params.taskId,
      goal: params.goal,
      status: 'idle',
      depth: 0,
      startedAt: Date.now(),
      steps: [],
      toolAccess: params.toolAccess || agent.allowedTools,
      memoryAccess: ['session', 'workflow'],
    };

    this.executionContexts.set(params.agentId, context);
    return context;
  }

  /**
   * Get the current execution context for an agent.
   */
  getContext(agentId: string): AgentExecutionContext | undefined {
    return this.executionContexts.get(agentId);
  }

  /**
   * Update an agent execution context.
   */
  updateContext(
    agentId: string,
    updates: Partial<AgentExecutionContext>,
  ): AgentExecutionContext | undefined {
    const context = this.executionContexts.get(agentId);
    if (!context) return undefined;
    Object.assign(context, updates);
    return context;
  }

  /**
   * Add a step to an agent's execution context.
   */
  addStep(agentId: string, step: WorkflowStep): void {
    const context = this.executionContexts.get(agentId);
    if (context) {
      context.steps.push(step);
    }
  }

  /**
   * Complete an agent's execution.
   */
  completeContext(agentId: string, output?: unknown): void {
    const context = this.executionContexts.get(agentId);
    if (context) {
      context.status = 'completed';
      context.completedAt = Date.now();
      context.output = output;
    }
  }

  /**
   * Fail an agent's execution.
   */
  failContext(agentId: string, error: string): void {
    const context = this.executionContexts.get(agentId);
    if (context) {
      context.status = 'failed';
      context.completedAt = Date.now();
      context.error = error;
    }
  }

  /**
   * Check if an agent is currently running.
   */
  isRunning(agentId: string): boolean {
    const context = this.executionContexts.get(agentId);
    return context?.status === 'running';
  }

  /**
   * Get all active execution contexts.
   */
  getActiveContexts(): AgentExecutionContext[] {
    return Array.from(this.executionContexts.values()).filter(
      (c) => c.status === 'running' || c.status === 'idle',
    );
  }

  /**
   * Clear all execution contexts.
   */
  clearContexts(): void {
    this.executionContexts.clear();
  }

  /**
   * Clear all agents and contexts.
   */
  clear(): void {
    this.agents.clear();
    this.executionContexts.clear();
  }

  /**
   * Count registered agents.
   */
  count(): number {
    return this.agents.size;
  }
}

export { generateId };
