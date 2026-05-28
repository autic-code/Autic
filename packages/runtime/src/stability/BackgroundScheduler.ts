/**
 * BackgroundScheduler — Low-priority background task management.
 *
 * Features:
 * - Background execution scheduling with configurable intervals
 * - Cleanup scheduling (old snapshots, stale contexts, cache eviction)
 * - Maintenance workers (health checks, telemetry flush)
 * - Queue-aware scheduling (doesn't run when main queue is busy)
 * - Bounded background activity
 */

import { generateId } from '@autic/shared';
import type { BackgroundTask } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface BackgroundSchedulerOptions {
  maxConcurrentTasks?: number;
  queuePressureThreshold?: number;
  defaultIntervalMs?: number;
}

export interface BackgroundSchedulerEvents {
  taskStarted: (task: BackgroundTask) => void;
  taskCompleted: (task: BackgroundTask, durationMs: number) => void;
  taskFailed: (task: BackgroundTask, error: string) => void;
  taskSkipped: (task: BackgroundTask, reason: string) => void;
}

type TaskHandler = () => Promise<void>;

export class BackgroundScheduler extends EventEmitter {
  private options: Required<BackgroundSchedulerOptions>;
  private tasks: Map<string, { task: BackgroundTask; handler: TaskHandler }> = new Map();
  private runningTasks = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private _queuePressureProvider: (() => number) | null = null;

  constructor(options: BackgroundSchedulerOptions = {}) {
    super();
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks || 2,
      queuePressureThreshold: options.queuePressureThreshold || 50,
      defaultIntervalMs: options.defaultIntervalMs || 60_000,
    };
  }

  /**
   * Set a provider function that returns current queue pressure (0-100).
   * Used to skip background work when main queue is busy.
   */
  setQueuePressureProvider(provider: () => number): void {
    this._queuePressureProvider = provider;
  }

  /**
   * Register a background task with a handler.
   */
  registerTask(
    name: string,
    type: BackgroundTask['type'],
    handler: TaskHandler,
    intervalMs?: number,
  ): string {
    const id = generateId();
    const task: BackgroundTask = {
      id,
      name,
      type,
      intervalMs: intervalMs || this.options.defaultIntervalMs,
      lastRun: 0,
      running: false,
      priority: type === 'health_check' ? 'high' : type === 'cleanup' ? 'medium' : 'low',
    };

    this.tasks.set(id, { task, handler });
    return id;
  }

  unregisterTask(taskId: string): void {
    this.tasks.delete(taskId);
  }

  start(): void {
    // Run a tick every 10 seconds to check for due tasks
    this.timer = setInterval(() => this.tick(), 10_000);
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

  /**
   * Force-run a specific background task now.
   */
  async runNow(taskId: string): Promise<void> {
    const entry = this.tasks.get(taskId);
    if (!entry) throw new Error(`Background task not found: ${taskId}`);
    await this.executeTask(entry.task, entry.handler);
  }

  /**
   * Get the list of registered background tasks.
   */
  listTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).map((e) => ({ ...e.task }));
  }

  /**
   * Get the count of currently running background tasks.
   */
  getRunningCount(): number {
    return this.runningTasks.size;
  }

  // --- Internal ---

  private tick(): void {
    const now = Date.now();

    // Check queue pressure before running background tasks
    const pressure = this._queuePressureProvider?.() ?? 0;
    if (pressure > this.options.queuePressureThreshold) {
      // Skip non-essential tasks when queue is busy
      for (const [, entry] of this.tasks) {
        if (entry.task.priority === 'low' && entry.task.type !== 'health_check') {
          entry.task.lastRun = now; // Reset timer so it doesn't stack up
        }
      }
      return;
    }

    for (const [, entry] of this.tasks) {
      const task = entry.task;

      // Skip if already running
      if (task.running) continue;

      // Skip if not due yet
      if (now - task.lastRun < task.intervalMs) continue;

      // Check concurrency limit
      if (this.runningTasks.size >= this.options.maxConcurrentTasks) {
        // Skip lowest priority task
        continue;
      }

      // Execute asynchronously
      this.executeTask(task, entry.handler).catch(() => {});
    }
  }

  private async executeTask(task: BackgroundTask, handler: TaskHandler): Promise<void> {
    task.running = true;
    task.lastRun = Date.now();
    this.runningTasks.add(task.id);

    this.emit('taskStarted', { ...task });

    const startTime = Date.now();

    try {
      await handler();
      const durationMs = Date.now() - startTime;
      this.emit('taskCompleted', { ...task }, durationMs);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emit('taskFailed', { ...task }, errorMsg);
    } finally {
      task.running = false;
      this.runningTasks.delete(task.id);
      // Update lastRun on success
    }
  }
}
