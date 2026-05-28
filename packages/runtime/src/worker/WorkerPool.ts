/**
 * Worker pool for executing tasks in parallel with controlled concurrency.
 */

import { EventEmitter } from 'node:events';

export type WorkerTask<T = unknown, R = unknown> = (payload: T) => Promise<R>;

export interface WorkerResult<R = unknown> {
  success: boolean;
  result?: R;
  error?: Error;
  workerId: number;
  durationMs: number;
}

export interface WorkerPoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeoutMs?: number;
}

interface PoolWorker {
  id: number;
  busy: boolean;
  lastActive: number;
}

export class WorkerPool extends EventEmitter {
  private workers: PoolWorker[] = [];
  private taskQueue: Array<{
    task: WorkerTask;
    payload: unknown;
    resolve: (result: WorkerResult) => void;
  }> = [];
  private readonly minWorkers: number;
  private readonly maxWorkers: number;
  private readonly idleTimeoutMs: number;
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null;
  private nextWorkerId = 0;

  constructor(options: WorkerPoolOptions = {}) {
    super();
    this.minWorkers = options.minWorkers || 1;
    this.maxWorkers = options.maxWorkers || 8;
    this.idleTimeoutMs = options.idleTimeoutMs || 60_000;

    // Initialize minimum workers
    for (let i = 0; i < this.minWorkers; i++) {
      this.addWorker();
    }

    // Start idle check
    this.idleCheckTimer = setInterval(() => this.checkIdle(), 30_000);
    if (
      this.idleCheckTimer &&
      typeof this.idleCheckTimer === 'object' &&
      'unref' in this.idleCheckTimer
    ) {
      this.idleCheckTimer.unref();
    }
  }

  async execute<T, R>(task: WorkerTask<T, R>, payload: T): Promise<WorkerResult<R>> {
    return new Promise((resolve) => {
      this.taskQueue.push({
        task: task as WorkerTask,
        payload,
        resolve: resolve as (result: WorkerResult) => void,
      });
      this.processQueue();
    });
  }

  getStats(): {
    activeWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
    totalWorkers: number;
  } {
    return {
      activeWorkers: this.workers.filter((w) => w.busy).length,
      idleWorkers: this.workers.filter((w) => !w.busy).length,
      queuedTasks: this.taskQueue.length,
      totalWorkers: this.workers.length,
    };
  }

  shutdown(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
    this.taskQueue = [];
    this.workers = [];
  }

  private addWorker(): PoolWorker {
    const worker: PoolWorker = {
      id: this.nextWorkerId++,
      busy: false,
      lastActive: Date.now(),
    };
    this.workers.push(worker);
    return worker;
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const availableWorker = this.workers.find((w) => !w.busy);

      if (!availableWorker) {
        if (this.workers.length < this.maxWorkers) {
          this.addWorker();
          continue;
        }
        break;
      }

      const item = this.taskQueue.shift();
      if (!item) break;

      availableWorker.busy = true;
      availableWorker.lastActive = Date.now();

      const startTime = Date.now();
      item
        .task(item.payload)
        .then((result) => {
          const durationMs = Date.now() - startTime;
          item.resolve({ success: true, result, workerId: availableWorker.id, durationMs });
        })
        .catch((error) => {
          const durationMs = Date.now() - startTime;
          item.resolve({ success: false, error, workerId: availableWorker.id, durationMs });
        })
        .finally(() => {
          availableWorker.busy = false;
          this.processQueue();
        });
    }
  }

  private checkIdle(): void {
    const now = Date.now();
    this.workers = this.workers.filter((w) => {
      if (w.busy) return true;
      if (this.workers.length <= this.minWorkers) return true;
      return now - w.lastActive < this.idleTimeoutMs;
    });
  }
}
