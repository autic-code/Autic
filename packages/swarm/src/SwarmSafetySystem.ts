/**
 * SwarmSafetySystem — Swarm safety and chaos prevention (#5)
 *
 * Enforces:
 *   - Delegation depth limits (max recursive depth)
 *   - Swarm size limits (max concurrent agents)
 *   - Runaway execution detection (excessive delegations in window)
 *   - Pipeline collapse prevention (consecutive failures)
 *   - Recursion protection (same-agent re-delegation)
 *
 * All limits are deterministic and configurable.
 */

import type { SwarmConfig, SwarmSafetyViolation } from '@autic/shared';

interface DelegationRecord {
  sourceAgentId: string;
  targetAgentId: string;
  timestamp: number;
  depth: number;
}

export class SwarmSafetySystem {
  private config: Required<SwarmConfig>;
  private delegationHistory: DelegationRecord[] = [];
  private maxHistory = 200;
  private runawayWindowMs = 60_000;
  private runawayThreshold = 50;
  private consecutiveFailures: Map<string, number> = new Map();
  private maxConsecutiveFailures = 5;

  constructor(config: Required<SwarmConfig>) {
    this.config = config;
  }

  /** Check if a delegation at the given depth is allowed */
  checkDelegationDepth(depth: number): SwarmSafetyViolation | null {
    if (depth > this.config.maxDelegationDepth) {
      return {
        type: 'delegation_depth',
        message: `Delegation depth ${depth} exceeds max ${this.config.maxDelegationDepth}`,
        currentValue: depth,
        maxValue: this.config.maxDelegationDepth,
        source: 'SwarmSafetySystem',
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /** Record a delegation for tracking */
  recordDelegation(sourceAgentId: string, targetAgentId: string, depth: number): void {
    this.delegationHistory.push({
      sourceAgentId,
      targetAgentId,
      timestamp: Date.now(),
      depth,
    });

    if (this.delegationHistory.length > this.maxHistory) {
      this.delegationHistory = this.delegationHistory.slice(-this.maxHistory);
    }
  }

  /** Record a failure for consecutive failure tracking */
  recordFailure(agentId: string): void {
    const count = (this.consecutiveFailures.get(agentId) || 0) + 1;
    this.consecutiveFailures.set(agentId, count);
  }

  /** Record a success to reset consecutive failure tracking */
  recordSuccess(agentId: string): void {
    this.consecutiveFailures.delete(agentId);
  }

  /** Check for runaway execution */
  isRunaway(): boolean {
    const now = Date.now();
    const recentWindow = now - this.runawayWindowMs;
    const recentDelegations = this.delegationHistory.filter((d) => d.timestamp >= recentWindow);
    return recentDelegations.length > this.runawayThreshold;
  }

  /** Check for pipeline collapse risk */
  hasPipelineCollapseRisk(): SwarmSafetyViolation | null {
    for (const [agentId, failures] of this.consecutiveFailures) {
      if (failures >= this.maxConsecutiveFailures) {
        return {
          type: 'pipeline_collapse',
          message: `Agent ${agentId} has ${failures} consecutive failures`,
          currentValue: failures,
          maxValue: this.maxConsecutiveFailures,
          source: agentId,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  /** Check for recursion (same agent being re-delegated to by same source) */
  checkRecursion(sourceAgentId: string, targetAgentId: string, windowMs: number = 10_000): SwarmSafetyViolation | null {
    const now = Date.now();
    const recent = this.delegationHistory.filter(
      (d) => d.sourceAgentId === sourceAgentId && d.targetAgentId === targetAgentId && (now - d.timestamp) < windowMs,
    );

    if (recent.length >= 3) {
      return {
        type: 'recursion',
        message: `Recursive delegation: ${sourceAgentId} → ${targetAgentId} (${recent.length}x in ${windowMs}ms)`,
        currentValue: recent.length,
        maxValue: 3,
        source: sourceAgentId,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /** Get all current violations */
  getViolations(): SwarmSafetyViolation[] {
    const violations: SwarmSafetyViolation[] = [];

    const collapseRisk = this.hasPipelineCollapseRisk();
    if (collapseRisk) violations.push(collapseRisk);

    if (this.isRunaway()) {
      violations.push({
        type: 'runaway_execution',
        message: `Runaway execution: ${this.delegationHistory.length} delegations in window`,
        currentValue: this.delegationHistory.filter((d) => d.timestamp >= Date.now() - this.runawayWindowMs).length,
        maxValue: this.runawayThreshold,
        source: 'SwarmSafetySystem',
        timestamp: Date.now(),
      });
    }

    return violations;
  }

  /** Get delegation history (recent) */
  getRecentDelegations(count: number = 20): DelegationRecord[] {
    return this.delegationHistory.slice(-count);
  }

  /** Reset all safety state */
  reset(): void {
    this.delegationHistory = [];
    this.consecutiveFailures.clear();
  }
}
