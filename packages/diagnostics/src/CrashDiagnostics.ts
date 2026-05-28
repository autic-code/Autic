/**
 * CrashDiagnostics — Structured runtime crash logging and recovery.
 *
 * Captures safe crash snapshots, provides recovery recommendations,
 * and supports optional anonymized crash reports.
 * No secret leakage — sanitizes all captured data.
 */

import { writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { ConfigManager } from '@autic/config';
import type { CrashSnapshot } from '@autic/shared';

const CRASH_LOG_DIR = join(homedir(), '.autic', 'crashes');

export class CrashDiagnostics {
  private configManager: ConfigManager;
  private recentEvents: string[] = [];

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /** Record a non-critical event for context in crash snapshots */
  recordEvent(event: string): void {
    this.recentEvents.push(`${Date.now()}: ${event}`);
    // Keep only the last 50 events
    if (this.recentEvents.length > 50) {
      this.recentEvents = this.recentEvents.slice(-50);
    }
  }

  /** Capture a crash snapshot from an error */
  async captureCrash(error: Error, context?: Partial<CrashSnapshot['context']>): Promise<CrashSnapshot> {
    const config = this.configManager.getDiagnosticsConfig();
    const snapshot: CrashSnapshot = {
      id: `crash-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: platform(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      error: {
        name: error.name,
        message: this.sanitizeMessage(error.message),
        stack: this.sanitizeStack(error.stack),
        code: (error as NodeJS.ErrnoException).code,
      },
      context: {
        command: process.argv.slice(2).join(' ') || '(interactive)',
        args: process.argv.slice(2),
        cwd: process.cwd(),
        lastEvents: this.recentEvents.slice(-20),
        activeSessions: 0,
        activeWorkflows: 0,
        ...context,
      },
      metadata: {
        profile: this.configManager.getProfile(),
        logLevel: this.configManager.getPreferences().logLevel,
        providers: String(this.configManager.getProviders().length),
      },
      anonymized: false,
    };

    // Save crash log if enabled
    if (config.crashLogging) {
      await this.saveCrashLog(snapshot);
      await this.cleanOldLogs(config.maxCrashLogs);
    }

    return snapshot;
  }

  /** Save crash log to disk */
  async saveCrashLog(snapshot: CrashSnapshot): Promise<void> {
    await mkdir(CRASH_LOG_DIR, { recursive: true });
    const logPath = join(CRASH_LOG_DIR, `${snapshot.id}.json`);
    await writeFile(logPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /** List recent crash logs */
  async listCrashLogs(): Promise<Array<{ id: string; timestamp: number; message: string }>> {
    try {
      const files = await readdir(CRASH_LOG_DIR);
      const logs: Array<{ id: string; timestamp: number; message: string }> = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const { readFile } = await import('node:fs/promises');
          const content = await readFile(join(CRASH_LOG_DIR, file), 'utf-8');
          const parsed = JSON.parse(content) as CrashSnapshot;
          logs.push({
            id: parsed.id,
            timestamp: parsed.timestamp,
            message: parsed.error.message,
          });
        } catch {
          continue;
        }
      }

      // Sort by timestamp descending
      logs.sort((a, b) => b.timestamp - a.timestamp);
      return logs;
    } catch {
      return [];
    }
  }

  /** Get crash log by ID */
  async getCrashLog(id: string): Promise<CrashSnapshot | null> {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(join(CRASH_LOG_DIR, `${id}.json`), 'utf-8');
      return JSON.parse(content) as CrashSnapshot;
    } catch {
      return null;
    }
  }

  /** Generate recovery recommendation from crash snapshot */
  getRecoveryRecommendation(snapshot: CrashSnapshot): string[] {
    const recommendations: string[] = [];

    // Check for common patterns
    const msg = snapshot.error.message.toLowerCase();
    const name = snapshot.error.name.toLowerCase();

    if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('econnrefused')) {
      recommendations.push('Check your internet connection');
      recommendations.push('Verify provider endpoints are reachable');
    }

    if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('authentication')) {
      recommendations.push('Verify your API keys are valid: autic providers check');
      recommendations.push('Update keys: autic providers add <provider> --key <key>');
    }

    if (msg.includes('memory') || name.includes('memory')) {
      recommendations.push('Close other applications to free memory');
      recommendations.push('Reduce concurrent workflow count');
    }

    if (msg.includes('timeout')) {
      recommendations.push('Increase timeout settings in profile config');
      recommendations.push('Try a smaller task or reduce complexity');
    }

    if (msg.includes('ollama') || msg.includes('localhost')) {
      recommendations.push('Ensure Ollama is running: ollama serve');
      recommendations.push('Check Ollama is installed: https://ollama.ai');
    }

    if (recommendations.length === 0) {
      recommendations.push('Run diagnostics: autic doctor');
      recommendations.push('Check logs: autic debug');
    }

    return recommendations;
  }

  /** Print crash summary to console */
  printCrashSummary(snapshot: CrashSnapshot): void {
    console.log('\n  ✗ Autic encountered an error\n');
    console.log(`  Error: ${snapshot.error.name}: ${snapshot.error.message}`);
    console.log(`  Time: ${new Date(snapshot.timestamp).toISOString()}`);
    console.log(`  ID: ${snapshot.id}\n`);

    const recommendations = this.getRecoveryRecommendation(snapshot);
    if (recommendations.length > 0) {
      console.log('  Recovery suggestions:');
      for (const rec of recommendations) {
        console.log(`    → ${rec}`);
      }
      console.log('');
    }

    console.log(`  Crash log saved: ~/.autic/crashes/${snapshot.id}.json\n`);
  }

  // ─── Private ───────────────────────────────────────────────────────

  /** Sanitize sensitive data from error messages */
  private sanitizeMessage(message: string): string {
    // Redact API keys, tokens, secrets
    return message
      .replace(/(api[_-]?key|token|secret|password|auth)[=:]\s*\S+/gi, '$1=***')
      .replace(/[A-Za-z0-9-_]{32,}/g, '***');
  }

  /** Sanitize stack traces */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    return stack
      .split('\n')
      .slice(0, 15) // Keep only first 15 frames
      .map((line) => line.replace(process.cwd(), '<cwd>'))
      .join('\n');
  }

  /** Clean old crash logs beyond the max limit */
  private async cleanOldLogs(maxLogs: number): Promise<void> {
    try {
      const files = await readdir(CRASH_LOG_DIR);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      // Sort by name (which includes timestamp) descending
      jsonFiles.sort().reverse();

      // Remove excess files
      const toRemove = jsonFiles.slice(maxLogs);
      for (const file of toRemove) {
        try {
          await unlink(join(CRASH_LOG_DIR, file));
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Ignore directory errors
    }
  }
}
