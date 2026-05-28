/**
 * SwarmRecovery — Failed delegation and pipeline recovery (#11)
 *
 * Provides:
 *   - Failed delegation recovery (retry, reassign, or skip)
 *   - Isolated pipeline retries (retry only the failed pipeline)
 *   - Worker reassignment (move tasks from failed worker)
 *   - Stalled swarm recovery (detect and restart stalled pipelines)
 *
 * All recovery is bounded — no infinite retry loops.
 */

import type { DelegationContract } from '@autic/shared';
import { AgentDelegation } from './AgentDelegation.js';
import { SwarmObservability } from './SwarmObservability.js';

export type RecoveryStrategy = 'retry' | 'reassign' | 'skip' | 'abort';

export interface RecoveryPlan {
  contractId: string;
  strategy: RecoveryStrategy;
  newAgentId?: string;
  reason: string;
}

export class SwarmRecovery {
  private delegationManager: AgentDelegation;
  private observability: SwarmObservability;
  private swarmId: string = '';
  private maxRetries = 3;
  private recoveryHistory: Array<{
    contractId: string;
    strategy: RecoveryStrategy;
    timestamp: number;
    success: boolean;
  }> = [];
  private historyLimit = 100;

  constructor(delegationManager: AgentDelegation, observability: SwarmObservability) {
    this.delegationManager = delegationManager;
    this.observability = observability;
  }

  /** Set the swarm ID for event records */
  setSwarmId(id: string): void {
    this.swarmId = id;
  }

  /** Analyze a failed delegation and recommend a recovery strategy */
  analyzeFailure(contractId: string, availableAgents: string[]): RecoveryPlan {
    const contract = this.delegationManager.getContract(contractId);
    if (!contract) {
      return { contractId, strategy: 'skip', reason: 'Contract not found' };
    }

    // Check retry count
    const retryCount = this.recoveryHistory.filter((h) => h.contractId === contractId).length;

    if (retryCount < this.maxRetries) {
      // Try retrying on the same agent first
      return {
        contractId,
        strategy: 'retry',
        reason: `Retry ${retryCount + 1}/${this.maxRetries}`,
      };
    }

    // If retries exhausted, try reassigning
    if (availableAgents.length > 0) {
      const newAgent = availableAgents.find((a) => a !== contract.targetAgentId);
      if (newAgent) {
        return {
          contractId,
          strategy: 'reassign',
          newAgentId: newAgent,
          reason: `Reassigning to ${newAgent}`,
        };
      }
    }

    // If no alternatives, skip
    return {
      contractId,
      strategy: 'skip',
      reason: 'All recovery options exhausted',
    };
  }

  /** Execute a recovery plan */
  async executeRecovery(plan: RecoveryPlan): Promise<boolean> {
    const contract = this.delegationManager.getContract(plan.contractId);
    if (!contract) return false;

    let success = false;

    try {
      switch (plan.strategy) {
        case 'retry': {
          // Reset the contract to retry
          contract.status = 'pending';
          contract.error = undefined;
          contract.completedAt = undefined;
          success = true;
          break;
        }
        case 'reassign': {
          if (!plan.newAgentId) {
            success = false;
            break;
          }
          // Create a new contract with the reassigned agent
          const newContract = await this.delegationManager.createContract({
            sourceAgentId: contract.sourceAgentId,
            targetAgentId: plan.newAgentId,
            role: contract.role,
            task: contract.task,
            input: contract.input,
            depth: contract.depth,
          });
          // Cancel the old contract
          this.delegationManager.cancelContract(plan.contractId);
          success = newContract.status === 'pending';
          break;
        }
        case 'skip': {
          // Mark as completed with no output (skipped)
          this.delegationManager.completeContract(plan.contractId, {
            skipped: true,
            reason: plan.reason,
          });
          success = true;
          break;
        }
        case 'abort': {
          // Fail the contract permanently
          this.delegationManager.failContract(plan.contractId, `Aborted: ${plan.reason}`);
          success = true;
          break;
        }
      }
    } catch (error) {
      success = false;
    }

    this.recoveryHistory.push({
      contractId: plan.contractId,
      strategy: plan.strategy,
      timestamp: Date.now(),
      success,
    });

    if (this.recoveryHistory.length > this.historyLimit) {
      this.recoveryHistory = this.recoveryHistory.slice(-this.historyLimit);
    }

    this.observability.record({
      type: success ? 'recovery:completed' : 'recovery:failed',
      timestamp: Date.now(),
      swarmId: this.swarmId,
      delegationId: plan.contractId,
      message: `Recovery ${success ? 'succeeded' : 'failed'}: ${plan.strategy} - ${plan.reason}`,
      error: success ? undefined : 'Recovery execution failed',
    });

    return success;
  }

  /** Recover multiple failed contracts */
  async recoverBatch(
    failedContracts: DelegationContract[],
    availableAgents: string[],
  ): Promise<{
    recovered: number;
    failed: number;
    skipped: number;
  }> {
    let recovered = 0;
    let failed = 0;
    let skipped = 0;

    for (const contract of failedContracts) {
      const plan = this.analyzeFailure(contract.id, availableAgents);
      const success = await this.executeRecovery(plan);

      if (success) {
        if (plan.strategy === 'skip') skipped++;
        else recovered++;
      } else {
        failed++;
      }
    }

    return { recovered, failed, skipped };
  }

  /** Check for stalled delegations (running for too long) */
  detectStalledContracts(): DelegationContract[] {
    const running = this.delegationManager.getContractsByStatus('running');
    const now = Date.now();
    const stalledThreshold = 120_000; // 2 minutes

    return running.filter((c) => now - c.startedAt > stalledThreshold);
  }

  /** Get recovery metrics */
  getMetrics(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    strategiesUsed: Record<string, number>;
  } {
    const strategiesUsed: Record<string, number> = {};

    for (const h of this.recoveryHistory) {
      strategiesUsed[h.strategy] = (strategiesUsed[h.strategy] || 0) + 1;
    }

    return {
      totalRecoveries: this.recoveryHistory.length,
      successfulRecoveries: this.recoveryHistory.filter((h) => h.success).length,
      failedRecoveries: this.recoveryHistory.filter((h) => !h.success).length,
      strategiesUsed,
    };
  }

  /** Reset recovery state */
  reset(): void {
    this.recoveryHistory = [];
  }
}
