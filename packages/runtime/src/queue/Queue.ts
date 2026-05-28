/**
 * Priority task queue for orchestrating work in the runtime.
 * Connected to WorkerPool for actual task execution.
 * Supports prioritization, retries, persistence foundation, and lifecycle management.
 */

import { generateId, timestamp, writeJSON, readJSON } from '@autic/shared';
import type { QueueTask, QueueTaskStatus } from '@autic/shared';
import { EventEmitter } from 'node:events';
import { WorkerPool } from '../worker/WorkerPool.js';
import type { WorkerPoolOptions } from '../worker/WorkerPool.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';

export type TaskHandler<T = unknown, R = unknown> = (payload: T) => Promise<R>;

export interface QueueOptions {
  concurrency?: number;
  defaultPriority?: number;
  defaultMaxRetries?: number;
  workerOptions?: WorkerPoolOptions;
  persistPath?: string;
}

export interface QueueEvents {
  enqueued: (task: QueueTask) => void;
  started: (task: QueueTask) => void;
  completed: (task: QueueTask) => void;
  failed: (task: QueueTask, error: Error) => void;
  drained: () => void;
  error: (error: Error) => void;
}

export class Queue<T = unknown, R = unknown> extends EventEmitter {
  private tasks: QueueTask<T>[] = [];
  private readonly defaultPriority: number;
  private readonly defaultMaxRetries: number;
  private handler: TaskHandler<T, R> | null = null;
  private readonly pool: WorkerPool;
  private persistPath: string | null;
  private processing = false;
  private persistEnabled = false;

  constructor(options: QueueOptions = {}) {
    super();
    this.defaultPriority = options.defaultPriority || 0;
    this.defaultMaxRetries = options.defaultMaxRetries || 3;
    this.pool = new WorkerPool({
      maxWorkers: options.concurrency || 4,
      ...options.workerOptions,
    });
    this.persistPath = options.persistPath || null;
  }

  setHandler(handler: TaskHandler<T, R>): void {
    this.handler = handler;
  }

  /**
   * Enable queue persistence to disk.
   * Queue state will be saved/loaded from the specified directory.
   */
  async enablePersistence(path?: string): Promise<void> {
    const dir =
      path || this.persistPath || join(homedir(), '.autic', 'queues', `queue-${generateId()}`);
    const persistDir = join(dir, 'persist');
    await mkdir(persistDir, { recursive: true });
    this.persistPath = dir;
    this.persistEnabled = true;

    // Restore any persisted tasks
    await this.restorePersistedTasks(persistDir);
  }

  enqueue(
    payload: T,
    options?: Partial<Pick<QueueTask<T>, 'type' | 'priority' | 'maxRetries'>>,
  ): string {
    const task: QueueTask<T> = {
      id: generateId(),
      type: options?.type || 'default',
      priority: options?.priority ?? this.defaultPriority,
      payload,
      status: 'pending',
      createdAt: timestamp(),
      retries: 0,
      maxRetries: options?.maxRetries ?? this.defaultMaxRetries,
    };

    this.tasks.push(task);
    this.tasks.sort((a, b) => b.priority - a.priority);
    this.emit('enqueued', task as unknown as QueueTask);

    // Persist the new task if enabled
    if (this.persistEnabled) {
      this.persistTask(task).catch(() => {});
    }

    // Process immediately (non-blocking)
    if (!this.processing) {
      setImmediate(() => this.processNext());
    }

    return task.id;
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const task = this.tasks.find((t) => t.status === 'pending');
      if (!task) {
        if (this.tasks.every((t) => ['completed', 'failed', 'cancelled'].includes(t.status))) {
          this.emit('drained');
        }
        return;
      }

      if (!this.handler) {
        this.emit('error', new Error('No handler set. Call setHandler() before enqueuing tasks.'));
        return;
      }

      task.status = 'running';
      task.startedAt = timestamp();
      this.emit('started', task as unknown as QueueTask);

      try {
        const result = await this.pool.execute(this.handler, task.payload);
        if (result.success) {
          this.markCompleted(task.id);
        } else {
          this.markFailed(task.id, result.error || new Error('Unknown execution error'));
        }
      } catch (error) {
        this.markFailed(task.id, error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.processing = false;
      // Process next task in queue (sequential safety)
      if (this.tasks.some((t) => t.status === 'pending')) {
        setImmediate(() => this.processNext());
      }
    }
  }

  private markCompleted(taskId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = timestamp();
    this.emit('completed', task as unknown as QueueTask);

    // Remove persisted task file on completion
    if (this.persistEnabled) {
      this.removePersistedTask(taskId).catch(() => {});
    }
  }

  private markFailed(taskId: string, error: Error): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.retries++;
    if (task.retries <= task.maxRetries) {
      task.status = 'pending';
      task.error = undefined;
      // Persist retry state
      if (this.persistEnabled) {
        this.persistTask(task).catch(() => {});
      }
    } else {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = timestamp();
      this.emit('failed', task as unknown as QueueTask, error);
      // Keep persisted task for failure inspection
    }
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'completed' || task.status === 'failed') return false;
    task.status = 'cancelled';
    if (this.persistEnabled) {
      this.removePersistedTask(taskId).catch(() => {});
    }
    return true;
  }

  getStatus(taskId: string): QueueTaskStatus | undefined {
    return this.tasks.find((t) => t.id === taskId)?.status;
  }

  getPending(): QueueTask<T>[] {
    return this.tasks.filter((t) => t.status === 'pending');
  }

  getActive(): QueueTask<T>[] {
    return this.tasks.filter((t) => t.status === 'running');
  }

  getCompleted(): QueueTask<T>[] {
    return this.tasks.filter((t) => t.status === 'completed');
  }

  getFailed(): QueueTask<T>[] {
    return this.tasks.filter((t) => t.status === 'failed');
  }

  getAll(): QueueTask<T>[] {
    return [...this.tasks];
  }

  clear(): void {
    this.tasks = [];
  }

  size(): number {
    return this.tasks.length;
  }

  pendingCount(): number {
    return this.tasks.filter((t) => t.status === 'pending').length;
  }

  getStats() {
    return this.pool.getStats();
  }

  shutdown(): void {
    this.pool.shutdown();
    this.tasks = [];
  }

  // --- Persistence internals ---

  private async persistTask(task: QueueTask<T>): Promise<void> {
    if (!this.persistPath) return;
    const persistDir = join(this.persistPath, 'persist');
    await mkdir(persistDir, { recursive: true });
    const filePath = join(persistDir, `${task.id}.json`);
    await writeJSON(filePath, {
      id: task.id,
      type: task.type,
      priority: task.priority,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      retries: task.retries,
      maxRetries: task.maxRetries,
      error: task.error,
      // Payload is stored separately to handle complex objects
      payload: task.payload,
    });
  }

  private async removePersistedTask(taskId: string): Promise<void> {
    if (!this.persistPath) return;
    const { unlink } = await import('node:fs/promises');
    try {
      await unlink(join(this.persistPath, 'persist', `${taskId}.json`));
    } catch {
      // File may not exist
    }
  }

  private async restorePersistedTasks(persistDir: string): Promise<void> {
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(persistDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await readJSON<Record<string, unknown>>(join(persistDir, file));
          if (
            data &&
            typeof data === 'object' &&
            (data as Record<string, unknown>).status === 'pending'
          ) {
            const d = data as Record<string, unknown>;
            const task: QueueTask<T> = {
              id: String(d.id || ''),
              type: String(d.type || 'default'),
              priority: Number(d.priority) ?? this.defaultPriority,
              payload: d.payload as T,
              status: 'pending',
              createdAt: Number(d.createdAt) || timestamp(),
              retries: Number(d.retries) || 0,
              maxRetries: Number(d.maxRetries) || this.defaultMaxRetries,
            };
            this.tasks.push(task);
          }
        } catch {
          // Skip corrupted files
        }
      }
      if (this.tasks.length > 0) {
        this.tasks.sort((a, b) => b.priority - a.priority);
      }
    } catch {
      // Directory may not exist yet
    }
  }
}
