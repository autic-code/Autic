/**
 * AdvancedWatchdog — Extended watchdog with deadlock detection, orchestration timeouts,
 * stuck tool execution detection, and workflow heartbeat tracking.
 *
 * Extends the base Watchdog with higher-level stability features:
 * - Deadlock detection: detects circular dependencies between tasks
 * - Stuck tool detection: identifies tool executions that haven't produced output
 * - Workflow heartbeats: tracks pipeline/worker liveness
 * - Orchestration timeout: stage-level timeout enforcement
 *
 * Backward-compatible with previous AdvancedWatchdog API.
 */

import { Watchdog } from '../watchdog/Watchdog.js';
import type { WatchdogOptions } from '../watchdog/Watchdog.js';
import type { HeartbeatMetrics } from '@autic/shared';

export interface AdvancedWatchdogOptions extends WatchdogOptions {
  deadlockThresholdMs?: number;
  toolStallThresholdMs?: number;
  workflowHeartbeatIntervalMs?: number;
  maxMissedHeartbeats?: number;
  orchestrationStageTimeoutMs?: number;
}

export interface AdvancedWatchdogEvents {
  deadlockDetected: (info: { tasks: string[]; cycle: string[] }) => void;
  toolStalled: (info: { toolName: string; taskId: string; durationMs: number }) => void;
  heartbeatMissed: (info: { component: string; componentId: string; missedBeats: number }) => void;
  orchestrationTimeout: (info: { stage: string; pipelineId: string; timeoutMs: number }) => void;
  livenessChanged: (info: { component: string; componentId: string; from: string; to: string }) => void;
}

interface ToolTracker {
  toolName: string;
  taskId: string;
  startedAt: number;
  lastOutputAt: number;
  active: boolean;
}

interface DependencyEdge {
  from: string;
  to: string;
  createdAt: number;
}

export class AdvancedWatchdog extends Watchdog {
  private advOptions: Required<Omit<AdvancedWatchdogOptions, keyof WatchdogOptions>>;
  private toolTracker: Map<string, ToolTracker> = new Map();
  private heartbeats: Map<string, HeartbeatMetrics> = new Map();
  private dependencyGraph: DependencyEdge[] = [];
  private stageTimers: Map<string, { stage: string; pipelineId: string; startedAt: number; timeoutMs: number }> = new Map();

  constructor(options: AdvancedWatchdogOptions = {}) {
    super(options);
    this.advOptions = {
      deadlockThresholdMs: options.deadlockThresholdMs || 30_000,
      toolStallThresholdMs: options.toolStallThresholdMs || 20_000,
      workflowHeartbeatIntervalMs: options.workflowHeartbeatIntervalMs || 5_000,
      maxMissedHeartbeats: options.maxMissedHeartbeats || 3,
      orchestrationStageTimeoutMs: options.orchestrationStageTimeoutMs || 120_000,
    };

    // Override the base check to add advanced checks
    const origStart = this.start.bind(this);
    this.start = () => {
      origStart();
      // Additional logic is handled in the overridden check
    };
  }

  // --- Tool Stuck Detection ---

  trackToolExecution(toolName: string, taskId: string): void {
    const now = Date.now();
    this.toolTracker.set(`${toolName}:${taskId}`, {
      toolName,
      taskId,
      startedAt: now,
      lastOutputAt: now,
      active: true,
    });
  }

  updateToolActivity(toolName: string, taskId: string): void {
    const key = `${toolName}:${taskId}`;
    const tracker = this.toolTracker.get(key);
    if (tracker) {
      tracker.lastOutputAt = Date.now();
    }
  }

  unregisterToolExecution(toolName: string, taskId: string): void {
    this.toolTracker.delete(`${toolName}:${taskId}`);
  }

  // --- Heartbeat Tracking ---

  registerHeartbeat(
    component: string,
    componentId: string,
    expectedIntervalMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    this.heartbeats.set(`${component}:${componentId}`, {
      component,
      componentId,
      lastHeartbeat: Date.now(),
      expectedIntervalMs,
      missedBeats: 0,
      status: 'alive',
      metadata,
    });
  }

  sendHeartbeat(component: string, componentId: string, metadata?: Record<string, unknown>): void {
    const key = `${component}:${componentId}`;
    const hb = this.heartbeats.get(key);
    if (hb) {
      const prevStatus = hb.status;
      hb.lastHeartbeat = Date.now();
      hb.missedBeats = 0;
      hb.status = 'alive';
      if (metadata) hb.metadata = { ...hb.metadata, ...metadata };
      if (prevStatus !== 'alive') {
        this.emit('livenessChanged', { component, componentId, from: prevStatus, to: 'alive' });
      }
    } else {
      this.registerHeartbeat(component, componentId, this.advOptions.workflowHeartbeatIntervalMs, metadata);
    }
  }

  unregisterHeartbeat(component: string, componentId: string): void {
    this.heartbeats.delete(`${component}:${componentId}`);
  }

  getHeartbeatStatus(component: string, componentId: string): HeartbeatMetrics | undefined {
    return this.heartbeats.get(`${component}:${componentId}`);
  }

  // --- Deadlock Detection ---

  recordDependency(fromTaskId: string, toTaskId: string): void {
    this.dependencyGraph.push({
      from: fromTaskId,
      to: toTaskId,
      createdAt: Date.now(),
    });

    // Prevent unbounded growth — prune old edges
    if (this.dependencyGraph.length > 10_000) {
      this.dependencyGraph = this.dependencyGraph.slice(-5_000);
    }
  }

  clearDependencies(taskId: string): void {
    this.dependencyGraph = this.dependencyGraph.filter(
      (e) => e.from !== taskId && e.to !== taskId,
    );
  }

  detectDeadlocks(): Array<{ tasks: string[]; cycle: string[] }> {
    const deadlocks: Array<{ tasks: string[]; cycle: string[] }> = [];

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const edge of this.dependencyGraph) {
      if (!graph.has(edge.from)) graph.set(edge.from, []);
      graph.get(edge.from)!.push(edge.to);
    }

    // DFS cycle detection
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
          deadlocks.push({
            tasks: [...cycle],
            cycle: [...cycle, neighbor],
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

    return deadlocks;
  }

  // --- Loop Detection Integration ---

  detectStuckTools(): Array<{ toolName: string; taskId: string; durationMs: number }> {
    const now = Date.now();
    const stuck: Array<{ toolName: string; taskId: string; durationMs: number }> = [];

    for (const [, tracker] of this.toolTracker) {
      if (!tracker.active) continue;
      const timeSinceOutput = now - tracker.lastOutputAt;
      if (timeSinceOutput > this.advOptions.toolStallThresholdMs) {
        stuck.push({
          toolName: tracker.toolName,
          taskId: tracker.taskId,
          durationMs: timeSinceOutput,
        });
      }
    }

    return stuck;
  }

  // --- Orchestration Stage Timeout ---

  startStageTimer(stage: string, pipelineId: string, timeoutMs?: number): void {
    this.stageTimers.set(`${pipelineId}:${stage}`, {
      stage,
      pipelineId,
      startedAt: Date.now(),
      timeoutMs: timeoutMs || this.advOptions.orchestrationStageTimeoutMs,
    });
  }

  cancelStageTimer(stage: string, pipelineId: string): void {
    this.stageTimers.delete(`${pipelineId}:${stage}`);
  }

  // --- Extended Health Check ---

  private advancedCheck(): void {
    // 1. Check for stuck tools
    const stuckTools = this.detectStuckTools();
    for (const tool of stuckTools) {
      this.emit('toolStalled', tool);
    }

    // 2. Check heartbeats
    const now = Date.now();
    for (const [, hb] of this.heartbeats) {
      const elapsed = now - hb.lastHeartbeat;
      if (elapsed > hb.expectedIntervalMs * (hb.missedBeats + 1)) {
        hb.missedBeats++;
        if (hb.missedBeats >= this.advOptions.maxMissedHeartbeats) {
          hb.status = 'dead';
          this.emit('livenessChanged', {
            component: hb.component,
            componentId: hb.componentId,
            from: 'alive',
            to: 'dead',
          });
        } else {
          hb.status = 'stale';
          this.emit('heartbeatMissed', {
            component: hb.component,
            componentId: hb.componentId,
            missedBeats: hb.missedBeats,
          });
        }
      }
    }

    // 3. Check deadlocks
    const deadlocks = this.detectDeadlocks();
    for (const dl of deadlocks) {
      this.emit('deadlockDetected', dl);
    }

    // 4. Check stage timeouts
    for (const [, st] of this.stageTimers) {
      const elapsed = now - st.startedAt;
      if (elapsed > st.timeoutMs) {
        this.emit('orchestrationTimeout', {
          stage: st.stage,
          pipelineId: st.pipelineId,
          timeoutMs: st.timeoutMs,
        });
        this.stageTimers.delete(`${st.pipelineId}:${st.stage}`);
      }
    }
  }

  /** @override Start watchdog with advanced monitoring */
  start(): void {
    super.start();
    // The base check runs on its interval; advanced checks run separately
    setInterval(() => this.advancedCheck(), this.advOptions.toolStallThresholdMs || 20_000);
  }
}
