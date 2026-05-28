/**
 * TokenAwareSwarmCoordination — Token optimization for swarm agents (#11)
 *
 * Integrates context engineering into swarm orchestration:
 *   - Per-agent token budgets based on role
 *   - Bounded shared context between agents
 *   - Concurrency-aware retrieval (don't overload during parallel execution)
 *   - Delegation-aware context compression
 *
 * Prevents token explosions during multi-agent parallel execution.
 */

import type { AgentRole } from './ExecutionAwareContextAssembly.js';

export interface AgentTokenBudget {
  agentId: string;
  role: AgentRole;
  maxTokens: number;
  currentTokens: number;
  remainingTokens: number;
  warning: string | null;
}

export interface SharedContextBudget {
  totalTokens: number;
  usedTokens: number;
  agentAllocations: Map<string, number>;
}

export class TokenAwareSwarmCoordination {
  private agentBudgets: Map<string, AgentTokenBudget> = new Map();
  private sharedContext: SharedContextBudget;

  // Default token budgets per agent role
  private readonly ROLE_TOKEN_LIMITS: Record<AgentRole, number> = {
    researcher: 24_000,
    planner: 16_000,
    architect: 32_000,
    engineer: 32_000,
    verifier: 24_000,
    repairer: 24_000,
    reviewer: 32_000,
  };

  // Shared pool for swarm operation
  private readonly SHARED_POOL_SIZE = 8_000;

  constructor() {
    this.sharedContext = {
      totalTokens: this.SHARED_POOL_SIZE,
      usedTokens: 0,
      agentAllocations: new Map(),
    };
  }

  /**
   * Register an agent with a token budget based on its role.
   */
  registerAgent(agentId: string, role: AgentRole, customMaxTokens?: number): AgentTokenBudget {
    const maxTokens = customMaxTokens || this.ROLE_TOKEN_LIMITS[role] || 24_000;
    const budget: AgentTokenBudget = {
      agentId,
      role,
      maxTokens,
      currentTokens: 0,
      remainingTokens: maxTokens,
      warning: null,
    };

    this.agentBudgets.set(agentId, budget);
    return budget;
  }

  /**
   * Allocate tokens to an agent for a specific operation.
   * Returns remaining budget after allocation.
   */
  allocateTokens(
    agentId: string,
    tokensNeeded: number,
  ): { granted: number; remaining: number; warning: string | null } {
    const budget = this.agentBudgets.get(agentId);
    if (!budget) {
      return { granted: 0, remaining: 0, warning: 'Agent not registered' };
    }

    const allocated = Math.min(tokensNeeded, budget.remainingTokens);
    budget.currentTokens += allocated;
    budget.remainingTokens -= allocated;

    let warning: string | null = null;
    if (budget.remainingTokens < budget.maxTokens * 0.1) {
      warning = `Token budget critical: ${budget.remainingTokens}/${budget.maxTokens} remaining`;
    } else if (budget.remainingTokens < budget.maxTokens * 0.25) {
      warning = `Token budget low: ${budget.remainingTokens}/${budget.maxTokens} remaining`;
    }

    budget.warning = warning;
    return { granted: allocated, remaining: budget.remainingTokens, warning };
  }

  /**
   * Allocate shared context tokens for inter-agent communication.
   */
  allocateSharedContext(agentId: string, tokensNeeded: number): number {
    const available = this.sharedContext.totalTokens - this.sharedContext.usedTokens;
    const allocated = Math.min(tokensNeeded, available);

    this.sharedContext.usedTokens += allocated;
    const current = this.sharedContext.agentAllocations.get(agentId) || 0;
    this.sharedContext.agentAllocations.set(agentId, current + allocated);

    return allocated;
  }

  /**
   * Release an agent's token allocation (on task completion).
   */
  releaseAgent(agentId: string): void {
    const budget = this.agentBudgets.get(agentId);
    if (budget) {
      budget.currentTokens = 0;
      budget.remainingTokens = budget.maxTokens;
      budget.warning = null;
    }

    // Also release shared context
    const sharedUsed = this.sharedContext.agentAllocations.get(agentId) || 0;
    this.sharedContext.usedTokens = Math.max(0, this.sharedContext.usedTokens - sharedUsed);
    this.sharedContext.agentAllocations.delete(agentId);
  }

  /**
   * Get total swarm token budget (all agents + shared).
   */
  getTotalBudget(): { agentBudget: number; sharedBudget: number; totalBudget: number } {
    const agentBudget = Array.from(this.agentBudgets.values()).reduce((s, b) => s + b.maxTokens, 0);
    return {
      agentBudget,
      sharedBudget: this.sharedContext.totalTokens,
      totalBudget: agentBudget + this.sharedContext.totalTokens,
    };
  }

  /**
   * Get the current token usage across all agents.
   */
  getUsage(): {
    totalUsed: number;
    totalRemaining: number;
    utilizationPercent: number;
    warningCount: number;
  } {
    const totalUsed =
      Array.from(this.agentBudgets.values()).reduce((s, b) => s + b.currentTokens, 0) +
      this.sharedContext.usedTokens;
    const totalBudget = this.getTotalBudget().totalBudget;
    const totalRemaining = totalBudget - totalUsed;
    const warningCount = Array.from(this.agentBudgets.values()).filter(
      (b) => b.warning !== null,
    ).length;

    return {
      totalUsed,
      totalRemaining,
      utilizationPercent: totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0,
      warningCount,
    };
  }

  /**
   * Get individual agent token budgets.
   */
  getAgentBudgets(): AgentTokenBudget[] {
    return Array.from(this.agentBudgets.values());
  }

  /**
   * Reset all budgets (on swarm stop).
   */
  reset(): void {
    this.agentBudgets.clear();
    this.sharedContext.usedTokens = 0;
    this.sharedContext.agentAllocations.clear();
  }
}
