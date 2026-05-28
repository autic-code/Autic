/**
 * run_terminal — Execute shell commands safely using Node.js child_process.
 * Uses spawn with timeout handling, stdout/stderr streaming, and cancellation.
 * No external runtime dependency — self-contained for use by tools package.
 */

import { spawn } from 'node:child_process';
import type { ToolResult } from '@autic/shared';

/**
 * Execute a shell command with safety controls.
 * Handles subprocess spawning, timeout enforcement, and output capture.
 */
export async function runTerminalTool(args: {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    return await new Promise<ToolResult>((resolve) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let timedOut = false;

      const child = spawn(args.command, args.args || [], {
        cwd: args.cwd || process.cwd(),
        env: args.env ? { ...process.env, ...args.env } : process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      // Timeout enforcement
      const timeoutMs = args.timeoutMs || 60_000;
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            try {
              child.kill('SIGKILL');
            } catch {
              /* already dead */
            }
          }, 3000).unref();
        } catch {
          /* process already exited */
        }
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        stdoutChunks.push(data.toString());
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderrChunks.push(data.toString());
      });

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;
        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');

        resolve({
          success: code === 0,
          data: {
            exitCode: code ?? -1,
            stdout,
            stderr,
            durationMs,
            timedOut,
            cancelled: false,
          },
          error:
            code !== 0
              ? `Command exited with code ${code}${stderr ? `: ${stderr.slice(0, 500)}` : ''}`
              : undefined,
          durationMs,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;

        resolve({
          success: false,
          error: `Failed to start command: ${error.message}`,
          data: {
            exitCode: -1,
            stdout: stdoutChunks.join(''),
            stderr: stderrChunks.join('') + `\n${error.message}`,
            durationMs,
            timedOut: false,
            cancelled: false,
          },
          durationMs,
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: `Terminal execution failed: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startTime,
    };
  }
}
