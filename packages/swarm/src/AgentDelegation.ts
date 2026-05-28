/**
 * AgentDelegation — Safe delegation architecture (#2)
 *
 * Manages structured delegation contracts between swarm agents:
 *   - Delegation limits and depth tracking
 *   - Structured contract creation and fulfillment
 *   - Execution ownership tracking
 *   - Deterministic transitions
 *   - Timeout enforcement
 *
 * Delegation contracts are typed I/O — no free-form agent chatter.
 */

import { generateId, timestamp } from '@autic/shared';
import type { SwarmConfig, SwarmAgentRole, DelegationContract } from '@autic/shared';

export class AgentDelegation {
  private contracts: Map<string, DelegationContract> = new Map();
  private config: Required<SwarmConfig>;

  constructor(config: Required<SwarmConfig>) {
    this.config = config;
  }

  /** Create a new delegation contract */
  async createContract(params: {
    sourceAgentId: string;
    targetAgentId: string;
    role: SwarmAgentRole;
    task: string;
    input: Record<string, unknown>;
    depth: number;
  }): Promise<DelegationContract> {
    if (params.depth > this.config.maxDelegationDepth) {
      throw new Error(
        `Delegation depth ${params.depth} exceeds max ${this.config.maxDelegationDepth}`,
      );
    }

    const contract: DelegationContract = {
      id: generateId(),
      sourceAgentId: params.sourceAgentId,
      targetAgentId: params.targetAgentId,
      role: params.role,
      task: params.task,
      input: params.input,
      status: 'pending',
      depth: params.depth,
      maxDepth: this.config.maxDelegationDepth,
      startedAt: timestamp(),
      metadata: {},
    };

    this.contracts.set(contract.id, contract);
    return contract;
  }

  /** Accept a delegation contract */
  acceptContract(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract || contract.status !== 'pending') return false;
    contract.status = 'accepted';
    return true;
  }

  /** Mark a delegation contract as running */
  startContract(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract || (contract.status !== 'accepted' && contract.status !== 'pending'))
      return false;
    contract.status = 'running';
    return true;
  }

  /** Complete a delegation contract with output */
  completeContract(contractId: string, output: Record<string, unknown>): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract || contract.status !== 'running') return false;
    contract.status = 'completed';
    contract.output = output;
    contract.completedAt = timestamp();
    return true;
  }

  /** Fail a delegation contract with an error */
  failContract(contractId: string, error: string): boolean {
    const contract = this.contracts.get(contractId);
    if (
      !contract ||
      (contract.status !== 'running' &&
        contract.status !== 'accepted' &&
        contract.status !== 'pending')
    )
      return false;
    contract.status = 'failed';
    contract.error = error;
    contract.completedAt = timestamp();
    return true;
  }

  /** Cancel a delegation contract */
  cancelContract(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract || contract.status === 'completed' || contract.status === 'failed') return false;
    contract.status = 'cancelled';
    contract.completedAt = timestamp();
    return true;
  }

  /** Get a contract by id */
  getContract(contractId: string): DelegationContract | undefined {
    return this.contracts.get(contractId);
  }

  /** Get contracts by status */
  getContractsByStatus(status: DelegationContract['status']): DelegationContract[] {
    return Array.from(this.contracts.values()).filter((c) => c.status === status);
  }

  /** Get contracts for a specific agent */
  getContractsForAgent(agentId: string): DelegationContract[] {
    return Array.from(this.contracts.values()).filter(
      (c) => c.sourceAgentId === agentId || c.targetAgentId === agentId,
    );
  }

  /** Get count of pending delegations */
  getPendingCount(): number {
    return this.getContractsByStatus('pending').length;
  }

  /** Get count of active (accepted + running) delegations */
  getActiveCount(): number {
    return (
      this.getContractsByStatus('accepted').length + this.getContractsByStatus('running').length
    );
  }

  /** Get count of completed delegations */
  getCompletedCount(): number {
    return this.getContractsByStatus('completed').length;
  }

  /** Get count of failed delegations */
  getFailedCount(): number {
    return this.getContractsByStatus('failed').length;
  }

  /** Get total delegation count */
  getTotalCount(): number {
    return this.contracts.size;
  }

  /** Check for timed-out contracts and fail them */
  checkTimeouts(): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [id, contract] of this.contracts) {
      if (contract.status === 'running' || contract.status === 'accepted') {
        const elapsed = now - contract.startedAt;
        if (elapsed > this.config.delegationTimeoutMs) {
          contract.status = 'failed';
          contract.error = `Timed out after ${elapsed}ms (max ${this.config.delegationTimeoutMs}ms)`;
          contract.completedAt = timestamp();
          timedOut.push(id);
        }
      }
    }

    return timedOut;
  }

  /** Reset all contracts */
  reset(): void {
    this.contracts.clear();
  }
}
