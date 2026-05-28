/**
 * Terminal Engine — Safe shell execution layer.
 * Handles subprocess execution with timeouts, streaming, and cancellation.
 * Prevents hanging processes with strict timeout enforcement.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { TerminalResult, TerminalOptions } from '@autic/shared';
import { timestamp } from '@autic/shared';

export interface TerminalEvents {
  stdout: (data: string) => void;
  stderr: (data: string) => void;
  completed: (result: TerminalResult) => void;
  timeout: (taskId: string) => void;
  cancelled: (taskId: string) => void;
}

export class TerminalEngine extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs = 60_000) {
    super();
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Execute a shell command with safety controls.
   * Returns structured output with timing, exit code, and streams.
   */
  async execute(
    options: TerminalOptions,
    taskId?: string,
  ): Promise<TerminalResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;

    return new Promise((resolve) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let timedOut = false;
      let cancelled = false;

      const child = spawn(options.command, options.args, {
        cwd: options.cwd || process.cwd(),
        env: options.env
          ? { ...process.env, ...options.env }
          : process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      const procId = taskId || `proc-${timestamp()}`;
      this.activeProcesses.set(procId, child);

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        this.kill(procId);
        this.emit('timeout', procId);
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdoutChunks.push(text);
        this.emit('stdout', text);
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrChunks.push(text);
        this.emit('stderr', text);
      });

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this.activeProcesses.delete(procId);

        const durationMs = Date.now() - startTime;
        const result: TerminalResult = {
          exitCode: code ?? -1,
          stdout: stdoutChunks.join(''),
          stderr: stderrChunks.join(''),
          durationMs,
          timedOut,
          cancelled,
        };

        this.emit('completed', result);
        resolve(result);
      });

      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        this.activeProcesses.delete(procId);

        const durationMs = Date.now() - startTime;
        const result: TerminalResult = {
          exitCode: -1,
          stdout: stdoutChunks.join(''),
          stderr: stderrChunks.join('') + `\n${error.message}`,
          durationMs,
          timedOut,
          cancelled,
        };

        this.emit('completed', result);
        resolve(result);
      });
    });
  }

  /**
   * Kill a running process by ID.
   * Sends SIGTERM first, then SIGKILL after timeout.
   */
  kill(procId: string): boolean {
    const proc = this.activeProcesses.get(procId);
    if (!proc || !proc.pid) return false;

    try {
      process.kill(proc.pid, 'SIGTERM');
      // Force kill after 3 seconds if still alive
      setTimeout(() => {
        try {
          process.kill(proc.pid!, 'SIGKILL');
        } catch {
          // Process already dead
        }
      }, 3000).unref();
      return true;
    } catch {
      return false;
    }
  }

  cancel(procId: string): boolean {
    const killed = this.kill(procId);
    if (killed) {
      this.emit('cancelled', procId);
    }
    return killed;
  }

  cancelAll(): void {
    for (const [id] of this.activeProcesses) {
      this.kill(id);
    }
  }

  isRunning(procId: string): boolean {
    return this.activeProcesses.has(procId);
  }

  activeCount(): number {
    return this.activeProcesses.size;
  }
}
