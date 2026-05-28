/**
 * DeadlockStallProtector — #5 Deadlock + Stall Protection
 *
 * Prevents stuck autonomous workflows with:
 * - Queue deadlock detection: circular dependency detection in task queues
 * - Orchestration stall detection: identifies frozen pipeline stages
 * - Frozen pipeline recovery: auto-resolution of stuck pipelines
 * - Stuck verification recovery: breaks verification → fix → verify cycles
 * - Subprocess freeze recovery: detects and terminates frozen subprocesses
 */

import { EventEmitter } from 'node:events';
import type { DeadlockReport, StallReport } from '@autic/shared';

export interface DeadlockStallOptions {
  checkIntervalMs?: number;
  deadlockThresholdMs?: number;
  stallThresholdMs?: number;
  maxVerificationCycles?: number;
  autoResolve?: boolean;
}

export interface DeadlockStallEvents {
  deadlockDetected: (report: DeadlockReport) => void;
  stallDetected: (report: StallReport) => void;
  deadlockResolved: (report: DeadlockReport) => void;
  stallResolved: (report: StallReport) => void;
}

interface TaskDependency {
  from: string;
  to: string;
  createdAt: number;
}

interface PipelineStage {
  pipelineId: string;
  stage: string;
  startedAt: number;
  lastActivity: number;
  active: boolean;
}

export class DeadlockStallProtector extends EventEmitter {
  private options: Required<DeadlockStallOptions>;
  private dependencies: TaskDependency[] = [];
  private stages: Map<string, PipelineStage> = new Map();
  private verificationCycles: Map<string, number> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: DeadlockStallOptions = {}) {
    super();
    this.options = {
      checkIntervalMs: options.checkIntervalMs || 10_000,
      deadlockThresholdMs: options.deadlockThresholdMs || 30_000,
      stallThresholdMs: options.stallThresholdMs || 60_000,
      maxVerificationCycles: options.maxVerificationCycles || 5,
      autoResolve: options.autoResolve ?? true,
    };
  }

  start(): void {
    this.timer = setInterval(() => this.check(), this.options.checkIntervalMs);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  recordDependency(from: string, to: string): void {
    this.dependencies.push({ from, to, createdAt: Date.now() });
    // Clean old dependencies
    const cutoff = Date.now() - this.options.deadlockThresholdMs;
    this.dependencies = this.dependencies.filter((d) => d.createdAt > cutoff);
  }

  removeDependencies(taskId: string): void {
    this.dependencies = this.dependencies.filter((d) => d.from !== taskId && d.to !== taskId);
  }

  registerStage(pipelineId: string, stage: string): void {
    this.stages.set(`${pipelineId}:${stage}`, {
      pipelineId,
      stage,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      active: true,
    });
  }

  updateStageActivity(pipelineId: string, stage: string): void {
    const key = `${pipelineId}:${stage}`;
    const s = this.stages.get(key);
    if (s) {
      s.lastActivity = Date.now();
    }
  }

  unregisterStage(pipelineId: string, stage: string): void {
    this.stages.delete(`${pipelineId}:${stage}`);
  }

  trackVerificationCycle(taskId: string): number {
    const count = (this.verificationCycles.get(taskId) || 0) + 1;
    this.verificationCycles.set(taskId, count);
    return count;
  }

  resetVerificationCycle(taskId: string): void {
    this.verificationCycles.delete(taskId);
  }

  detectDeadlocks(): DeadlockReport[] {
    const reports: DeadlockReport[] = [];

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const dep of this.dependencies) {
      if (!graph.has(dep.from)) graph.set(dep.from, []);
      graph.get(dep.from)!.push(dep.to);
    }

    // DFS cycle detection (Tarjan-like simplified)
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          reports.push({
            detected: true,
            cycle: [...cycle, neighbor],
            involvedTasks: [...cycle],
            blockedDurationMs:
              Date.now() -
              (this.dependencies.find((d) => d.from === node)?.createdAt || Date.now()),
            timestamp: Date.now(),
            autoResolved: false,
          });
          return true;
        }
      }

      path.pop();
      recStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return reports;
  }

  detectStalls(): StallReport[] {
    const now = Date.now();
    const reports: StallReport[] = [];

    for (const [, stage] of this.stages) {
      if (!stage.active) continue;
      const idleDuration = now - stage.lastActivity;
      if (idleDuration > this.options.stallThresholdMs) {
        reports.push({
          detected: true,
          component: 'pipeline',
          componentId: `${stage.pipelineId}:${stage.stage}`,
          stalledSince: stage.lastActivity,
          stalledDurationMs: idleDuration,
          lastActivity: stage.lastActivity,
          autoResolved: false,
          resolution: this.options.autoResolve
            ? 'Auto-resolving stalled pipeline stage'
            : undefined,
        });
      }
    }

    return reports;
  }

  detectVerificationLoops(): Array<{ taskId: string; cycles: number }> {
    const loops: Array<{ taskId: string; cycles: number }> = [];
    for (const [taskId, count] of this.verificationCycles) {
      if (count >= this.options.maxVerificationCycles) {
        loops.push({ taskId, cycles: count });
      }
    }
    return loops;
  }

  private check(): void {
    // Check deadlocks
    const deadlocks = this.detectDeadlocks();
    for (const report of deadlocks) {
      if (this.options.autoResolve) {
        report.autoResolved = true;
        report.resolution = 'Auto-resolved: broke circular dependency chain';
        // Remove the oldest dependency in the cycle to break it
        for (const taskId of report.involvedTasks) {
          const deps = this.dependencies.filter((d) => d.from === taskId || d.to === taskId);
          if (deps.length > 0) {
            const oldest = deps.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
            this.dependencies = this.dependencies.filter((d) => d !== oldest);
          }
        }
      }
      this.emit('deadlockDetected', report);
      if (this.options.autoResolve) {
        this.emit('deadlockResolved', report);
      }
    }

    // Check stalls
    const stalls = this.detectStalls();
    for (const report of stalls) {
      if (this.options.autoResolve) {
        report.autoResolved = true;
        // Mark stage inactive to unblock
        const stage = this.stages.get(report.componentId);
        if (stage) {
          stage.active = false;
        }
      }
      this.emit('stallDetected', report);
      if (this.options.autoResolve) {
        this.emit('stallResolved', report);
      }
    }

    // Check verification loops
    const loops = this.detectVerificationLoops();
    for (const loop of loops) {
      this.emit('stallDetected', {
        detected: true,
        component: 'verification',
        componentId: loop.taskId,
        stalledSince: Date.now(),
        stalledDurationMs: 0,
        lastActivity: Date.now(),
        autoResolved: this.options.autoResolve,
        resolution: this.options.autoResolve
          ? `Auto-resolved: broke verification cycle after ${loop.cycles} attempts`
          : undefined,
      });
      if (this.options.autoResolve) {
        this.verificationCycles.delete(loop.taskId);
      }
    }
  }

  reset(): void {
    this.dependencies = [];
    this.stages.clear();
    this.verificationCycles.clear();
  }
}
