/**
 * EngineeringMemory — Persistent records of errors, fixes, and patterns.
 *
 * Stored as structured JSON files:
 *   errors.json   — Error records with context and resolutions
 *   fixes.json    — Applied fixes and their outcomes
 *   patterns.json — Detected patterns and their frequency
 *
 * Foundation for future learning system — no cloud sync yet.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { generateId, timestamp } from '@autic/shared';
import type { ErrorRecord, FixRecord, PatternRecord } from '@autic/shared';

const ENGINEERING_DIR = join(homedir(), '.autic', 'learning');

export class EngineeringMemory {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await access(ENGINEERING_DIR);
    } catch {
      await mkdir(ENGINEERING_DIR, { recursive: true });
    }
    this.initialized = true;
  }

  // ---- Error Records ----

  async getErrors(): Promise<ErrorRecord[]> {
    await this.init();
    try {
      const data = await readFile(join(ENGINEERING_DIR, 'errors.json'), 'utf-8');
      return JSON.parse(data) as ErrorRecord[];
    } catch {
      return [];
    }
  }

  async recordError(
    error: string,
    context: string,
    severity: ErrorRecord['severity'] = 'medium',
  ): Promise<ErrorRecord> {
    const errors = await this.getErrors();
    const record: ErrorRecord = {
      id: generateId(),
      error,
      context,
      severity,
      occurredAt: timestamp(),
    };

    errors.push(record);

    // Keep last 500 errors
    const trimmed = errors.slice(-500);
    await writeFile(
      join(ENGINEERING_DIR, 'errors.json'),
      JSON.stringify(trimmed, null, 2),
      'utf-8',
    );

    return record;
  }

  async resolveError(id: string, resolution: string): Promise<boolean> {
    const errors = await this.getErrors();
    const record = errors.find((e) => e.id === id);
    if (!record) return false;

    record.resolvedAt = timestamp();
    record.resolution = resolution;

    await writeFile(join(ENGINEERING_DIR, 'errors.json'), JSON.stringify(errors, null, 2), 'utf-8');

    return true;
  }

  async getRecentErrors(limit = 10): Promise<ErrorRecord[]> {
    const errors = await this.getErrors();
    return errors.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limit);
  }

  async getUnresolvedErrors(): Promise<ErrorRecord[]> {
    const errors = await this.getErrors();
    return errors.filter((e) => !e.resolvedAt);
  }

  async getErrorCount(): Promise<number> {
    const errors = await this.getErrors();
    return errors.length;
  }

  // ---- Fix Records ----

  async getFixes(): Promise<FixRecord[]> {
    await this.init();
    try {
      const data = await readFile(join(ENGINEERING_DIR, 'fixes.json'), 'utf-8');
      return JSON.parse(data) as FixRecord[];
    } catch {
      return [];
    }
  }

  async recordFix(
    issue: string,
    fix: string,
    files: string[],
    success: boolean,
  ): Promise<FixRecord> {
    const fixes = await this.getFixes();
    const record: FixRecord = {
      id: generateId(),
      issue,
      fix,
      files,
      appliedAt: timestamp(),
      success,
    };

    fixes.push(record);

    // Keep last 200 fixes
    const trimmed = fixes.slice(-200);
    await writeFile(join(ENGINEERING_DIR, 'fixes.json'), JSON.stringify(trimmed, null, 2), 'utf-8');

    return record;
  }

  async getRecentFixes(limit = 10): Promise<FixRecord[]> {
    const fixes = await this.getFixes();
    return fixes.sort((a, b) => b.appliedAt - a.appliedAt).slice(0, limit);
  }

  async getFixCount(): Promise<number> {
    const fixes = await this.getFixes();
    return fixes.length;
  }

  // ---- Pattern Records ----

  async getPatterns(): Promise<PatternRecord[]> {
    await this.init();
    try {
      const data = await readFile(join(ENGINEERING_DIR, 'patterns.json'), 'utf-8');
      return JSON.parse(data) as PatternRecord[];
    } catch {
      return [];
    }
  }

  async recordPattern(
    pattern: string,
    description: string,
    examples: string[],
  ): Promise<PatternRecord> {
    const patterns = await this.getPatterns();

    // Check if pattern already exists
    const existing = patterns.find((p) => p.pattern === pattern);
    if (existing) {
      existing.frequency += 1;
      existing.detectedAt = timestamp();
      existing.examples = [...new Set([...existing.examples, ...examples])].slice(-10);

      await writeFile(
        join(ENGINEERING_DIR, 'patterns.json'),
        JSON.stringify(patterns, null, 2),
        'utf-8',
      );

      return existing;
    }

    const record: PatternRecord = {
      id: generateId(),
      pattern,
      description,
      examples: examples.slice(0, 10),
      detectedAt: timestamp(),
      frequency: 1,
    };

    patterns.push(record);

    // Keep last 200 patterns
    const trimmed = patterns.slice(-200);
    await writeFile(
      join(ENGINEERING_DIR, 'patterns.json'),
      JSON.stringify(trimmed, null, 2),
      'utf-8',
    );

    return record;
  }

  async getHighFrequencyPatterns(minFrequency = 3): Promise<PatternRecord[]> {
    const patterns = await this.getPatterns();
    return patterns
      .filter((p) => p.frequency >= minFrequency)
      .sort((a, b) => b.frequency - a.frequency);
  }

  async getPatternCount(): Promise<number> {
    const patterns = await this.getPatterns();
    return patterns.length;
  }

  // ---- Storage stats ----

  async getStorageStats(): Promise<{ totalFiles: number; totalSizeBytes: number }> {
    let totalSizeBytes = 0;
    let totalFiles = 0;

    const files = ['errors.json', 'fixes.json', 'patterns.json'];
    for (const file of files) {
      try {
        const data = await readFile(join(ENGINEERING_DIR, file), 'utf-8');
        totalSizeBytes += Buffer.byteLength(data, 'utf-8');
        totalFiles++;
      } catch {
        // File doesn't exist yet
      }
    }

    return { totalFiles, totalSizeBytes };
  }
}
