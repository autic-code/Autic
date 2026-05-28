/**
 * ExecutionPartitioning — Workspace partitioning (#7)
 *
 * Isolates execution domains to reduce context collisions:
 *   - Frontend tasks isolated from backend tasks
 *   - Verification isolated from engineering
 *   - Provider-aware partitioning
 *   - Bounded jobs per partition
 *
 * Each partition has its own concurrency limit and agent pool.
 */

import { generateId } from '@autic/shared';
import type { ExecutionPartition } from '@autic/shared';

export interface PartitionConfig {
  name: string;
  domain: ExecutionPartition['domain'];
  concurrency?: number;
  maxJobs?: number;
}

export class ExecutionPartitioning {
  private partitions: Map<string, ExecutionPartition> = new Map();
  private defaultConcurrency = 4;
  private defaultMaxJobs = 10;

  /** Create a new execution partition */
  createPartition(config: PartitionConfig): ExecutionPartition {
    const partition: ExecutionPartition = {
      id: generateId(),
      name: config.name,
      domain: config.domain,
      agents: [],
      concurrency: config.concurrency ?? this.defaultConcurrency,
      activeJobs: 0,
      maxJobs: config.maxJobs ?? this.defaultMaxJobs,
    };

    this.partitions.set(partition.id, partition);
    return partition;
  }

  /** Remove a partition */
  removePartition(partitionId: string): boolean {
    return this.partitions.delete(partitionId);
  }

  /** Assign an agent to a partition */
  assignAgent(partitionId: string, agentId: string): boolean {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;
    if (partition.agents.includes(agentId)) return false;
    partition.agents.push(agentId);
    return true;
  }

  /** Remove an agent from a partition */
  unassignAgent(partitionId: string, agentId: string): boolean {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;
    const idx = partition.agents.indexOf(agentId);
    if (idx === -1) return false;
    partition.agents.splice(idx, 1);
    return true;
  }

  /** Get a partition by id */
  getPartition(partitionId: string): ExecutionPartition | undefined {
    return this.partitions.get(partitionId);
  }

  /** List all partitions */
  listPartitions(): ExecutionPartition[] {
    return Array.from(this.partitions.values());
  }

  /** Find a partition by domain */
  findPartitionByDomain(domain: ExecutionPartition['domain']): ExecutionPartition | undefined {
    return this.listPartitions().find((p) => p.domain === domain);
  }

  /** Check if a partition can accept more jobs */
  canAcceptJob(partitionId: string): boolean {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;
    return partition.activeJobs < partition.maxJobs;
  }

  /** Increment active job count */
  incrementJobs(partitionId: string): boolean {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;
    if (partition.activeJobs >= partition.maxJobs) return false;
    partition.activeJobs++;
    return true;
  }

  /** Decrement active job count */
  decrementJobs(partitionId: string): boolean {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;
    partition.activeJobs = Math.max(0, partition.activeJobs - 1);
    return true;
  }

  /** Select the best partition for a given agent based on role */
  selectPartitionForRole(role: string): ExecutionPartition | undefined {
    if (role === 'verifier' || role === 'repairer') {
      return this.findPartitionByDomain('testing') || this.listPartitions()[0];
    }
    if (role === 'researcher' || role === 'planner' || role === 'architect') {
      return this.findPartitionByDomain('documentation') || this.listPartitions()[0];
    }
    return (
      this.listPartitions().find((p) => p.activeJobs < p.maxJobs * 0.8) || this.listPartitions()[0]
    );
  }

  /** Get total active jobs across all partitions */
  getTotalActiveJobs(): number {
    return this.listPartitions().reduce((sum, p) => sum + p.activeJobs, 0);
  }

  /** Get overall utilization */
  getUtilization(): { activeJobs: number; maxJobs: number; percent: number } {
    const totalActive = this.getTotalActiveJobs();
    const totalMax = this.listPartitions().reduce((sum, p) => sum + p.maxJobs, 0);
    return {
      activeJobs: totalActive,
      maxJobs: totalMax,
      percent: totalMax > 0 ? Math.round((totalActive / totalMax) * 100) : 0,
    };
  }

  /** Reset all partitions */
  reset(): void {
    this.partitions.clear();
  }
}
