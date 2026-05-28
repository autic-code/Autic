/**
 * Watchdog monitors runtime health and triggers recovery when needed.
 * Periodically checks health metrics, detects stalled tasks, and restarts unhealthy subsystems.
 */

import { timestamp } from '@autic/shared';
import type { RuntimeHealth, StalledTaskInfo } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface WatchdogOptions {
  checkIntervalMs?: number;
  maxMemoryUsageMB?: number;
  maxTaskBacklog?: number;
  maxConsecutiveFailures?: number;
  stallThresholdMs?: number;
  heartbeatIntervalMs?: number;
}

export interface WatchdogEvents {
  healthChanged: (health: RuntimeHealth) => void;
  degraded: (reason: string) => void;
  unhealthy: (reason: string) => void;
  recovered: () => void;
  stallDetected: (stall: StalledTaskInfo) => void;
  heartbeat: (timestamp: number) => void;
}

interface TaskTracker {
  taskId: string;
  type: string;
  description: string;
  startedAt: number;
  lastActivity: number;
  active: boolean;
}

export class Watchdog extends EventEmitter {
  private options: Required<WatchdogOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private health: RuntimeHealth;
  private consecutiveFailures = 0;
  private startTime = 0;
  private taskRegistry: Map<string, TaskTracker> = new Map();
  private heartbeatCount = 0;

  constructor(options: WatchdogOptions = {}) {
    super();
    this.options = {
      checkIntervalMs: options.checkIntervalMs || 10_000,
      maxMemoryUsageMB: options.maxMemoryUsageMB || 1024,
      maxTaskBacklog: options.maxTaskBacklog || 100,
      maxConsecutiveFailures: options.maxConsecutiveFailures || 5,
      stallThresholdMs: options.stallThresholdMs || 30_000,
      heartbeatIntervalMs: options.heartbeatIntervalMs || 5_000,
    };
    this.health = {
      status: 'healthy',
      uptime: 0,
      activeWorkers: 0,
      queuedTasks: 0,
      memoryUsage: 0,
      lastCheck: timestamp(),
    };
  }

  start(): void {
    this.startTime = Date.now();
    this.health.status = 'healthy';
    this.health.lastCheck = timestamp();
    this.timer = setInterval(() => this.check(), this.options.checkIntervalMs);
    // Don't let the watchdog keep the process alive
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

  updateMetrics(metrics: Partial<RuntimeHealth>): void {
    Object.assign(this.health, metrics);
  }

  getHealth(): RuntimeHealth {
    return { ...this.health };
  }

  /**
   * Register a task for stall monitoring.
   */
  registerTask(taskId: string, type: string, description: string): void {
    const now = Date.now();
    this.taskRegistry.set(taskId, {
      taskId,
      type,
      description,
      startedAt: now,
      lastActivity: now,
      active: true,
    });
  }

  /**
   * Update last activity timestamp for a monitored task.
   */
  heartbeat(taskId: string): void {
    const task = this.taskRegistry.get(taskId);
    if (task) {
      task.lastActivity = Date.now();
    }
    this.heartbeatCount++;
    this.emit('heartbeat', timestamp());
  }

  /**
   * Unregister a completed or cancelled task from stall monitoring.
   */
  unregisterTask(taskId: string): void {
    this.taskRegistry.delete(taskId);
  }

  /**
   * Get list of currently stalled tasks.
   */
  getStalledTasks(): StalledTaskInfo[] {
    const now = Date.now();
    const stalled: StalledTaskInfo[] = [];

    for (const [, tracker] of this.taskRegistry) {
      if (!tracker.active) continue;
      const elapsed = now - tracker.lastActivity;
      if (elapsed > this.options.stallThresholdMs) {
        stalled.push({
          taskId: tracker.taskId,
          type: tracker.type,
          startedAt: tracker.startedAt,
          stalledSince: tracker.lastActivity,
          stalledDurationMs: elapsed,
          description: tracker.description,
        });
      }
    }

    return stalled;
  }

  /**
   * Get current heartbeat count for monitoring.
   */
  getHeartbeatCount(): number {
    return this.heartbeatCount;
  }

  /**
   * Get count of actively monitored tasks.
   */
  getMonitoredTaskCount(): number {
    return this.taskRegistry.size;
  }

  reportFailure(error?: Error): void {
    this.consecutiveFailures++;
    const reason = error?.message || 'Unknown failure';
    if (this.consecutiveFailures >= this.options.maxConsecutiveFailures) {
      this.setUnhealthy(reason);
    } else {
      this.setDegraded(reason);
    }
  }

  reportSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.health.status !== 'healthy') {
      this.health.status = 'healthy';
      this.emit('recovered');
      this.emit('healthChanged', this.getHealth());
    }
  }

  private check(): void {
    this.health.uptime = Date.now() - this.startTime;
    this.health.memoryUsage = process.memoryUsage().heapUsed;
    this.health.lastCheck = timestamp();

    const memoryMB = this.health.memoryUsage / (1024 * 1024);

    // Check memory threshold
    if (memoryMB > this.options.maxMemoryUsageMB) {
      this.setDegraded(`Memory usage ${memoryMB.toFixed(0)}MB exceeds limit`);
    }

    // Check task backlog
    if (this.health.queuedTasks > this.options.maxTaskBacklog) {
      this.setDegraded(`Task backlog ${this.health.queuedTasks} exceeds limit`);
    }

    // Check for stalled tasks
    const stalled = this.getStalledTasks();
    for (const stall of stalled) {
      this.emit('stallDetected', stall);
      this.setDegraded(
        `Task stalled: ${stall.taskId.slice(0, 8)}... (${stall.type}, ${(stall.stalledDurationMs / 1000).toFixed(0)}s inactive)`,
      );
    }

    // If all checks pass and status was degraded, recover
    if (
      memoryMB <= this.options.maxMemoryUsageMB &&
      this.health.queuedTasks <= this.options.maxTaskBacklog &&
      stalled.length === 0 &&
      this.health.status === 'degraded'
    ) {
      this.reportSuccess();
    }
  }

  private setDegraded(reason: string): void {
    if (this.health.status === 'healthy') {
      this.health.status = 'degraded';
      this.emit('degraded', reason);
      this.emit('healthChanged', this.getHealth());
    }
  }

  private setUnhealthy(reason: string): void {
    if (this.health.status !== 'unhealthy') {
      this.health.status = 'unhealthy';
      this.emit('unhealthy', reason);
      this.emit('healthChanged', this.getHealth());
    }
  }
}
