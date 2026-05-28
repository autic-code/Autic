/**
 * LearningEngine — Central orchestrator for the engineering learning system.
 *
 * Coordinates:
 *   - VerifiedFixMemory   — persist only verified fixes
 *   - LearningValidation  — confidence scoring + dup detection
 *   - LearningCompression — dedup, summarization, stale cleanup
 *   - LearningObservability — event logging for learning activity
 *   - LearningSanitizer   — privacy-safe anonymization
 *
 * All learning is:
 *   - Structured and inspectable
 *   - Verified before persistence
 *   - Bounded to prevent bloat
 *   - Local-only by default
 *   - Deterministic and safe
 */

import { timestamp, generateId } from '@autic/shared';
import type {
  LearningEntry,
  LearningCategory,
  LearningEvent,
  LearningControls,
} from '@autic/shared';

import { VerifiedFixMemory } from './VerifiedFixMemory.js';
import { LearningValidation } from './LearningValidation.js';
import { LearningCompression } from './LearningCompression.js';
import { LearningObservability } from './LearningObservability.js';
import { LearningSanitizer } from './LearningSanitizer.js';

export interface LearningEngineOptions {
  maxEntries?: number;
  maxRetentionDays?: number;
  localOnly?: boolean;
}

export class LearningEngine {
  private entries: Map<string, LearningEntry> = new Map();
  private verifiedFixes: VerifiedFixMemory;
  private validation: LearningValidation;
  private compression: LearningCompression;
  private observability: LearningObservability;
  private sanitizer: LearningSanitizer;
  private controls: LearningControls;

  constructor(options: LearningEngineOptions = {}) {
    this.controls = {
      enabled: true,
      localOnly: options.localOnly ?? true,
      globalSync: false,
      learningDir: '',
      maxEntries: options.maxEntries ?? 1000,
      maxRetentionDays: options.maxRetentionDays ?? 90,
    };
    this.verifiedFixes = new VerifiedFixMemory();
    this.validation = new LearningValidation();
    this.compression = new LearningCompression();
    this.observability = new LearningObservability();
    this.sanitizer = new LearningSanitizer();
  }

  // ── Entry Management ──

  createEntry(params: {
    type: LearningCategory;
    title: string;
    description: string;
    context: string;
    framework?: string;
    dependency?: string;
    tags?: string[];
    source?: LearningEntry['source'];
    metadata?: Record<string, string>;
  }): LearningEntry {
    const entry: LearningEntry = {
      id: generateId(),
      type: params.type,
      title: params.title,
      description: params.description,
      context: params.context,
      framework: params.framework,
      dependency: params.dependency,
      confidence: 0,
      verified: false,
      verificationCount: 0,
      tags: params.tags ?? [],
      createdAt: timestamp(),
      updatedAt: timestamp(),
      expiresAt: this.controls.maxRetentionDays
        ? timestamp() + this.controls.maxRetentionDays * 86400_000
        : undefined,
      source: params.source ?? 'local',
      metadata: params.metadata,
    };

    this.entries.set(entry.id, entry);
    this.observability.log({
      type: 'learning:entry_created',
      timestamp: timestamp(),
      entryId: entry.id,
      category: entry.type,
      message: `Created ${entry.type} entry: ${entry.title}`,
    });

    return entry;
  }

  recordLearning(
    entry: LearningEntry,
    verificationResults?: Array<{ passed: boolean }>,
  ): LearningEntry {
    const score = this.validation.validate(entry, verificationResults);
    entry.confidence = score.confidence;
    entry.verified = score.isValid;
    entry.verificationCount = score.verificationCount;
    entry.updatedAt = timestamp();

    if (score.duplicate) {
      this.observability.log({
        type: 'learning:validation_failed',
        timestamp: timestamp(),
        entryId: entry.id,
        category: entry.type,
        message: `Duplicate entry detected: ${score.reason}`,
      });
    }

    this.entries.set(entry.id, entry);
    return entry;
  }

  getEntry(id: string): LearningEntry | undefined {
    return this.entries.get(id);
  }

  query(params: {
    type?: LearningCategory;
    framework?: string;
    dependency?: string;
    tags?: string[];
    minConfidence?: number;
    verified?: boolean;
    maxResults?: number;
  }): LearningEntry[] {
    let results = Array.from(this.entries.values());

    if (params.type) results = results.filter((e) => e.type === params.type);
    if (params.framework) results = results.filter((e) => e.framework === params.framework);
    if (params.dependency) results = results.filter((e) => e.dependency === params.dependency);
    if (params.tags) results = results.filter((e) => params.tags!.some((t) => e.tags.includes(t)));
    if (params.minConfidence)
      results = results.filter((e) => e.confidence >= params.minConfidence!);
    if (params.verified !== undefined)
      results = results.filter((e) => e.verified === params.verified);

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, params.maxResults ?? 50);
  }

  // ── Verified Fixes ──

  recordVerifiedFix(params: {
    issue: string;
    fix: string;
    framework?: string;
    dependency?: string;
    errorType: string;
    filesChanged: string[];
    verificationChecks: Array<{ passed: boolean }>;
  }): void {
    const fix = this.verifiedFixes.record(params);
    const allPassed = params.verificationChecks.every((c) => c.passed);

    if (allPassed && fix) {
      this.observability.log({
        type: 'learning:entry_verified',
        timestamp: timestamp(),
        entryId: fix.id,
        message: `Verified fix recorded: ${params.issue}`,
        confidence: fix.confidence,
        source: 'local',
      });
    }
  }

  getVerifiedFixes(framework?: string): ReturnType<VerifiedFixMemory['getRecent']> {
    return this.verifiedFixes.getRecent(framework);
  }

  // ── Compression ──

  runCompression(): void {
    const result = this.compression.compress(this.entries);
    this.entries = result.entries;

    // Run verification fix compression too
    this.verifiedFixes.compress();

    this.observability.log({
      type: 'learning:compression_run',
      timestamp: timestamp(),
      message: `Compression removed ${result.stats.removedCount} entries, saved ~${result.stats.estimatedTokensSaved} tokens`,
    });
  }

  // ── Sanitization ──

  prepareGlobalSync(): Array<{ abstractPattern: string; type: string; frameworks: string[] }> {
    return this.sanitizer.prepareForSync(Array.from(this.entries.values()));
  }

  // ── Controls ──

  getControls(): LearningControls {
    return { ...this.controls };
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
    if (!enabled) {
      this.observability.log({
        type: 'learning:learning_disabled',
        timestamp: timestamp(),
        message: 'Learning system disabled',
      });
    }
  }

  clear(): void {
    this.entries.clear();
    this.verifiedFixes.clear();
    this.validation.clear();
    this.observability.clear();
  }

  getStats(): {
    totalEntries: number;
    verifiedEntries: number;
    totalFixes: number;
    avgConfidence: number;
  } {
    const entryList = Array.from(this.entries.values());
    const avgConfidence =
      entryList.length > 0
        ? entryList.reduce((sum, e) => sum + e.confidence, 0) / entryList.length
        : 0;

    return {
      totalEntries: entryList.length,
      verifiedEntries: entryList.filter((e) => e.verified).length,
      totalFixes: this.verifiedFixes.count(),
      avgConfidence: Math.round(avgConfidence * 100) / 100,
    };
  }

  getRecentEvents(limit = 20): LearningEvent[] {
    return this.observability.getRecent(limit);
  }
}
