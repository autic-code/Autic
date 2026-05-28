/**
 * GracefulShutdown — Safe runtime shutdown with state preservation.
 *
 * Flow:
 * 1. Prepare: notify components shutdown is starting
 * 2. Save active state (snapshots, queue, pipeline state)
 * 3. Stop workers safely (drain in-progress work)
 * 4. Persist queue state for recovery on next startup
 * 5. Clean up subprocesses (kill orphans)
 * 6. Complete shutdown
 *
 * Designed to prevent corruption during interruptions
 * and enable resume on next startup.
 */

import { timestamp } from '@autic/shared';
import type { ShutdownState } from '@autic/shared';
import { EventEmitter } from 'node:events';

export interface GracefulShutdownOptions {
  workerStopTimeoutMs?: number;
  subprocessKillDelayMs?: number;
  persistQueueState?: boolean;
  autoShutdownSignals?: boolean;
}

export interface GracefulShutdownEvents {
  shutdownStarted: (state: ShutdownState) => void;
  phaseChanged: (phase: ShutdownState['phase']) => void;
  workerStopped: (workerId: string) => void;
  queuePersisted: (taskCount: number) => void;
  subprocessCleaned: (count: number) => void;
  shutdownComplete: (state: ShutdownState) => void;
  shutdownError: (phase: string, error: string) => void;
}

interface WorkerHandle {
  id: string;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

interface SubprocessHandle {
  pid: number;
  cmd: string;
  kill: () => boolean;
}

interface QueuePersister {
  persistAll: () => Promise<number>;
}

export class GracefulShutdown extends EventEmitter {
  private options: Required<GracefulShutdownOptions>;
  private state: ShutdownState;
  private workers: Map<string, WorkerHandle> = new Map();
  private subprocesses: Map<string, SubprocessHandle> = new Map();
  private queuePersister: QueuePersister | null = null;
  private shuttingDown = false;

  constructor(options: GracefulShutdownOptions = {}) {
    super();
    this.options = {
      workerStopTimeoutMs: options.workerStopTimeoutMs || 15_000,
      subprocessKillDelayMs: options.subprocessKillDelayMs || 3_000,
      persistQueueState: options.persistQueueState ?? true,
      autoShutdownSignals: options.autoShutdownSignals ?? true,
    };

    this.state = this.freshState();

    // Register signal handlers
    if (this.options.autoShutdownSignals) {
      this.registerSignalHandlers();
    }
  }

  // --- Registration ---

  registerWorker(id: string, worker: WorkerHandle): void {
    this.workers.set(id, worker);
  }

  unregisterWorker(id: string): void {
    this.workers.delete(id);
  }

  registerSubprocess(pid: number, cmd: string, killFn: () => boolean): string {
    const id = `proc-${pid}-${timestamp()}`;
    this.subprocesses.set(id, { pid, cmd, kill: killFn });
    return id;
  }

  unregisterSubprocess(id: string): void {
    this.subprocesses.delete(id);
  }

  setQueuePersister(persister: QueuePersister): void {
    this.queuePersister = persister;
  }

  // --- Shutdown ---

  async shutdown(reason = 'user_initiated'): Promise<ShutdownState> {
    if (this.shuttingDown) return this.state;
    this.shuttingDown = true;

    const startTime = Date.now();
    this.state = this.freshState();
    this.state.phase = 'preparing';
    this.state.startedAt = startTime;
    this.emit('shutdownStarted', { ...this.state });

    // Phase 1: Save active state
    await this.phaseSaveState(reason);

    // Phase 2: Stop workers
    await this.phaseStopWorkers();

    // Phase 3: Persist queue
    await this.phasePersistQueue();

    // Phase 4: Clean up subprocesses
    await this.phaseCleanSubprocesses();

    // Complete
    this.state.phase = 'complete';
    this.state.completedAt = Date.now();
    this.emit('phaseChanged', 'complete');
    this.emit('shutdownComplete', { ...this.state });

    return { ...this.state };
  }

  /**
   * Force immediate shutdown (skip graceful phases).
   */
  forceShutdown(): void {
    this.state.saveErrors = [];
    this.state.workersStopped = 0;
    this.state.subprocessesCleaned = 0;

    // Kill all subprocesses immediately
    for (const [, proc] of this.subprocesses) {
      try {
        proc.kill();
        this.state.subprocessesCleaned++;
      } catch {
        // Ignore
      }
    }

    this.state.phase = 'complete';
    this.state.completedAt = Date.now();
    this.emit('phaseChanged', 'complete');
    this.emit('shutdownComplete', { ...this.state });
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  getState(): ShutdownState {
    return { ...this.state };
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  getSubprocessCount(): number {
    return this.subprocesses.size;
  }

  hasActiveWorkers(): boolean {
    for (const [, worker] of this.workers) {
      if (worker.isRunning()) return true;
    }
    return false;
  }

  // --- Signal Handling ---

  private registered = false;

  private registerSignalHandlers(): void {
    if (this.registered) return;
    this.registered = true;

    const handleSignal = async (signal: string) => {
      console.log(`\n  Received ${signal}, starting graceful shutdown...`);
      await this.shutdown(signal);
      process.exit(0);
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
  }

  // --- Phases ---

  private async phaseSaveState(_reason: string): Promise<void> {
    this.state.phase = 'saving';
    this.emit('phaseChanged', 'saving');

    try {
      // In a full implementation, save execution snapshots, pipeline state, session state
      // For now, the phase tracks that save was attempted
      this.emit('phaseChanged', 'saving');
    } catch (error) {
      this.state.saveErrors.push(`Save state failed: ${error instanceof Error ? error.message : String(error)}`);
      this.emit('shutdownError', 'saving', error instanceof Error ? error.message : String(error));
    }
  }

  private async phaseStopWorkers(): Promise<void> {
    this.state.phase = 'stopping_workers';
    this.emit('phaseChanged', 'stopping_workers');

    const stopPromises: Promise<void>[] = [];

    for (const [id, worker] of this.workers) {
      if (worker.isRunning()) {
        const stopPromise = worker.stop()
          .then(() => {
            this.state.workersStopped++;
            this.emit('workerStopped', id);
          })
          .catch((error) => {
            this.state.saveErrors.push(`Worker ${id} stop failed: ${error.message}`);
            this.emit('shutdownError', 'stopping_workers', `Worker ${id}: ${error.message}`);
          });
        stopPromises.push(stopPromise);
      }
    }

    if (stopPromises.length > 0) {
      // Wait for all workers with timeout
      await Promise.race([
        Promise.all(stopPromises),
        this.sleep(this.options.workerStopTimeoutMs),
      ]);
    }
  }

  private async phasePersistQueue(): Promise<void> {
    if (!this.options.persistQueueState || !this.queuePersister) {
      this.state.queueTasksPersisted = 0;
      return;
    }

    this.state.phase = 'persisting_queue';
    this.emit('phaseChanged', 'persisting_queue');

    try {
      const count = await this.queuePersister.persistAll();
      this.state.queueTasksPersisted = count;
      this.emit('queuePersisted', count);
    } catch (error) {
      this.state.saveErrors.push(`Queue persist failed: ${error instanceof Error ? error.message : String(error)}`);
      this.emit('shutdownError', 'persisting_queue', error instanceof Error ? error.message : String(error));
    }
  }

  private async phaseCleanSubprocesses(): Promise<void> {
    this.state.phase = 'cleaning_subprocesses';
    this.emit('phaseChanged', 'cleaning_subprocesses');

    let cleaned = 0;

    for (const [id, proc] of this.subprocesses) {
      try {
        proc.kill();
        cleaned++;
        this.subprocesses.delete(id);
      } catch {
        // Process may already be dead
      }
    }

    this.state.subprocessesCleaned = cleaned;
    this.emit('subprocessCleaned', cleaned);
  }

  private freshState(): ShutdownState {
    return {
      phase: 'idle',
      startedAt: 0,
      saveErrors: [],
      workersStopped: 0,
      queueTasksPersisted: 0,
      subprocessesCleaned: 0,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
