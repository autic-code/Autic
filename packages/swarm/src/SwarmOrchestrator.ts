/**
 * SwarmOrchestrator — Centralized controlled swarm runtime (#1)
 *
 * The SwarmOrchestrator manages bounded multi-agent coordination:
 *   - Agent registration and lifecycle
 *   - Delegation management with depth limits
 *   - Parallel batch execution
 *   - Integration with safety, load balancing, and recovery
 *
 * All coordination is bounded, deterministic, and inspectable.
 * NO recursive delegation, NO free-form agent chatter, NO giant graphs.
 */

import { generateId, timestamp } from '@autic/shared';
import type {
  SwarmConfig,
  SwarmStatus,
  SwarmAgentRole,
  DelegationContract,
  SwarmEvent,
  SwarmEventType,
  LoadBalancerMetrics,
  ResourceProtectionState,
} from '@autic/shared';
import { AgentDelegation } from './AgentDelegation.js';
import { SwarmSafetySystem } from './SwarmSafetySystem.js';
import { SwarmObservability } from './SwarmObservability.js';
import { SwarmRecovery } from './SwarmRecovery.js';
import { ResourceProtection } from './ResourceProtection.js';
import { LongWorkflowStability } from './LongWorkflowStability.js';

export interface SwarmOrchestratorOptions {
  config?: Partial<SwarmConfig>;
  swarmName?: string;
}

export interface SwarmAgent {
  id: string;
  name: string;
  role: SwarmAgentRole;
  capabilities: string[];
  maxDepth: number;
  timeoutMs: number;
}

export class SwarmOrchestrator {
  private agents: Map<string, SwarmAgent> = new Map();
  private delegationManager: AgentDelegation;
  private safety: SwarmSafetySystem;
  private observability: SwarmObservability;
  private recovery: SwarmRecovery;
  private protection: ResourceProtection;
  private longWorkflow: LongWorkflowStability;
  private config: Required<SwarmConfig>;
  private swarmId: string;
  private swarmName: string;
  private status: SwarmStatus['status'] = 'idle';
  private startedAt = 0;
  private defaultConfig: Required<SwarmConfig> = {
    maxAgents: 20,
    maxDelegationDepth: 5,
    maxParallelBatches: 3,
    concurrencyPerPartition: 4,
    providerTimeoutMs: 60_000,
    delegationTimeoutMs: 120_000,
    cooldownMs: 30_000,
    idleWorkerTimeoutMs: 60_000,
    safetyProfile: 'balanced',
    localOnly: true,
  };

  constructor(options: SwarmOrchestratorOptions = {}) {
    this.swarmId = generateId();
    this.swarmName = options.swarmName || `swarm-${this.swarmId.slice(0, 8)}`;
    this.config = { ...this.defaultConfig, ...options.config };
    this.delegationManager = new AgentDelegation(this.config);
    this.safety = new SwarmSafetySystem(this.config);
    this.observability = new SwarmObservability(this.swarmId);
    this.recovery = new SwarmRecovery(this.delegationManager, this.observability);
    this.protection = new ResourceProtection(this.config, this.observability);
    this.longWorkflow = new LongWorkflowStability(this.config, this.observability);

    // Set swarm IDs on subsystems that need them for event records
    this.protection.setSwarmId(this.swarmId);
    this.longWorkflow.setSwarmId(this.swarmId);
    this.recovery.setSwarmId(this.swarmId);
  }

  /** Register an agent into the swarm */
  registerAgent(agent: SwarmAgent): boolean {
    if (this.agents.size >= this.config.maxAgents) {
      this.emitEvent('safety:blocked', { message: `Max agents (${this.config.maxAgents}) reached` });
      return false;
    }
    if (this.agents.has(agent.id)) {
      return false;
    }
    this.agents.set(agent.id, agent);
    this.emitEvent('agent:registered', { message: `Agent registered: ${agent.name}`, agentId: agent.id });
    return true;
  }

  /** Unregister an agent from the swarm */
  unregisterAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /** Get a registered agent by id */
  getAgent(agentId: string): SwarmAgent | undefined {
    return this.agents.get(agentId);
  }

  /** List all registered agents */
  listAgents(): SwarmAgent[] {
    return Array.from(this.agents.values());
  }

  /** Start the swarm orchestration */
  start(): void {
    if (this.status === 'running') return;
    this.status = 'running';
    this.startedAt = timestamp();
    this.protection.start();
    this.longWorkflow.start();
    this.emitEvent('swarm:started', { message: `Swarm started: ${this.swarmName}` });
  }

  /** Stop the swarm orchestration */
  stop(): void {
    this.status = 'stopped';
    this.protection.stop();
    this.longWorkflow.stop();
    this.emitEvent('swarm:stopped', { message: 'Swarm stopped' });
  }

  /** Pause the swarm orchestration */
  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.emitEvent('swarm:paused', { message: 'Swarm paused' });
  }

  /** Resume the swarm orchestration */
  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.emitEvent('swarm:resumed', { message: 'Swarm resumed' });
  }

  /** Delegate a task from one agent to another */
  async delegate(params: {
    sourceAgentId: string;
    targetAgentId: string;
    role: SwarmAgentRole;
    task: string;
    input: Record<string, unknown>;
    depth?: number;
  }): Promise<DelegationContract> {
    const source = this.agents.get(params.sourceAgentId);
    const target = this.agents.get(params.targetAgentId);
    if (!source || !target) {
      throw new Error(`Unknown agent: source=${params.sourceAgentId}, target=${params.targetAgentId}`);
    }

    const violation = this.safety.checkDelegationDepth(params.depth ?? 0);
    if (violation) {
      this.emitEvent('safety:violation', { message: violation.message, error: violation.type });
      throw new Error(`Safety violation: ${violation.message}`);
    }

    const contract = await this.delegationManager.createContract({
      sourceAgentId: params.sourceAgentId,
      targetAgentId: params.targetAgentId,
      role: params.role,
      task: params.task,
      input: params.input,
      depth: params.depth ?? 0,
    });

    this.emitEvent('delegation:created', {
      message: `Delegation: ${source.name} → ${target.name} (${params.role})`,
      delegationId: contract.id,
      agentId: params.targetAgentId,
    });

    // Transition contract through lifecycle
    this.delegationManager.acceptContract(contract.id);
    this.delegationManager.startContract(contract.id);

    return contract;
  }

  /** Execute a batch of tasks in parallel with controlled concurrency */
  async parallelBatch(params: {
    jobs: Array<{
      id: string;
      agentId: string;
      task: string;
      input: Record<string, unknown>;
    }>;
    maxConcurrency?: number;
  }): Promise<{
    batchId: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    results: Array<{
      jobId: string;
      agentId: string;
      success: boolean;
      output?: unknown;
      error?: string;
      durationMs: number;
    }>;
    totalDurationMs: number;
  }> {
    const concurrency = Math.min(
      params.maxConcurrency ?? this.config.concurrencyPerPartition,
      this.config.maxParallelBatches,
    );
    const batchId = generateId();
    const startTime = Date.now();

    this.emitEvent('parallel:batch_started', {
      message: `Parallel batch started: ${params.jobs.length} jobs, concurrency ${concurrency}`,
      data: { batchId, jobCount: params.jobs.length, concurrency },
    });

    const results: Array<{
      jobId: string;
      agentId: string;
      success: boolean;
      output?: unknown;
      error?: string;
      durationMs: number;
    }> = [];

    // Execute in bounded chunks
    for (let i = 0; i < params.jobs.length; i += concurrency) {
      const chunk = params.jobs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (job) => {
          const agent = this.agents.get(job.agentId);
          if (!agent) {
            return { jobId: job.id, agentId: job.agentId, success: false, error: 'Unknown agent', durationMs: 0 };
          }
          const jobStart = Date.now();
          try {
            const contract = await this.delegationManager.createContract({
              sourceAgentId: 'coordinator',
              targetAgentId: job.agentId,
              role: agent.role,
              task: job.task,
              input: job.input,
              depth: 1,
            });
            // Full contract lifecycle for this simulated execution
            this.delegationManager.acceptContract(contract.id);
            this.delegationManager.startContract(contract.id);
            this.delegationManager.completeContract(contract.id, { simulated: true });
            this.emitEvent('parallel:worker_result', {
              message: `Worker completed: ${agent.name}`,
              delegationId: contract.id,
              agentId: job.agentId,
            });
            return {
              jobId: job.id,
              agentId: job.agentId,
              success: true,
              output: contract.output,
              durationMs: Date.now() - jobStart,
            };
          } catch (error) {
            this.emitEvent('parallel:worker_failed', {
              message: `Worker failed: ${agent.name}: ${error instanceof Error ? error.message : String(error)}`,
              agentId: job.agentId,
            });
            return {
              jobId: job.id,
              agentId: job.agentId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              durationMs: Date.now() - jobStart,
            };
          }
        }),
      );
      results.push(...chunkResults);

      // Safety check after each chunk
      if (this.safety.isRunaway()) {
        this.emitEvent('safety:violation', { message: 'Runaway execution detected, stopping batch' });
        break;
      }
    }

    const completedJobs = results.filter((r) => r.success).length;
    const failedJobs = results.filter((r) => !r.success).length;

    this.emitEvent('parallel:batch_completed', {
      message: `Batch completed: ${completedJobs}/${results.length} jobs succeeded`,
      data: { batchId, completedJobs, failedJobs, totalDurationMs: Date.now() - startTime },
    });

    return {
      batchId,
      totalJobs: results.length,
      completedJobs,
      failedJobs,
      results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /** Get the load balancer metrics */
  getLoadMetrics(): LoadBalancerMetrics {
    return {
      activeWorkers: 0,
      idleWorkers: 0,
      totalWorkers: this.agents.size,
      providerUtilization: 0,
      queuePressure: 0,
      memoryPressure: 0,
      cpuPressure: 0,
      pendingDelegations: this.delegationManager.getPendingCount(),
      activeDelegations: this.delegationManager.getActiveCount(),
      recommendation: 'normal',
      timestamp: timestamp(),
    };
  }

  /** Get the resource protection state */
  getProtectionState(): ResourceProtectionState {
    return this.protection.getState();
  }

  /** Get the safety system */
  getSafetySystem(): SwarmSafetySystem {
    return this.safety;
  }

  /** Get the delegation manager */
  getDelegationManager(): AgentDelegation {
    return this.delegationManager;
  }

  /** Get the recovery system */
  getRecoverySystem(): SwarmRecovery {
    return this.recovery;
  }

  /** Get the observability system */
  getObservability(): SwarmObservability {
    return this.observability;
  }

  /** Get the resource protection system */
  getResourceProtection(): ResourceProtection {
    return this.protection;
  }

  /** Get current swarm status */
  getStatus(): SwarmStatus {
    return {
      id: this.swarmId,
      name: this.swarmName,
      status: this.status,
      agents: this.agents.size,
      activeDelegations: this.delegationManager.getActiveCount(),
      completedDelegations: this.delegationManager.getCompletedCount(),
      failedDelegations: this.delegationManager.getFailedCount(),
      partitions: 0,
      startedAt: this.startedAt,
      uptimeMs: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
      config: this.config,
      loadMetrics: this.getLoadMetrics(),
      protection: this.protection.getState(),
    };
  }

  /** Reset the swarm to initial state */
  reset(): void {
    this.agents.clear();
    this.delegationManager.reset();
    this.safety.reset();
    this.observability.clear();
    this.recovery.reset();
    this.protection.reset();
    this.longWorkflow.reset();
    this.status = 'idle';
    this.startedAt = 0;
  }

  /** Register an event listener */
  onEvent(callback: (event: SwarmEvent) => void): void {
    this.observability.onEvent(callback);
  }

  /** Emit an event */
  private emitEvent(type: SwarmEventType, data: { message: string; agentId?: string; delegationId?: string; error?: string; data?: Record<string, unknown> }): void {
    this.observability.record({
      type,
      timestamp: timestamp(),
      swarmId: this.swarmId,
      agentId: data.agentId,
      delegationId: data.delegationId,
      message: data.message,
      error: data.error,
      data: data.data,
    });
  }
}
