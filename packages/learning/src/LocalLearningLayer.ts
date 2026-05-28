/**
 * LocalLearningLayer — Workspace-specific private learning system.
 *
 * Stores:
 *   - Project-specific patterns
 *   - Coding style preferences
 *   - Workflow preferences (provider, model)
 *   - Local optimization memory
 *
 * All data remains fully local by default.
 * Never auto-syncs or shares data externally.
 */

import { timestamp, generateId } from '@autic/shared';
import type { WorkspaceLearningProfile, PatternRecord } from '@autic/shared';

export interface LocalLearningLayerOptions {
  maxPatterns?: number;
}

export class LocalLearningLayer {
  private profiles: Map<string, WorkspaceLearningProfile> = new Map();
  private maxPatterns: number;

  constructor(options: LocalLearningLayerOptions = {}) {
    this.maxPatterns = options.maxPatterns ?? 100;
  }

  // ── Workspace Profile Management ──

  getProfile(workspaceId: string): WorkspaceLearningProfile | undefined {
    return this.profiles.get(workspaceId);
  }

  createProfile(params: {
    workspaceId: string;
    projectName: string;
    frameworks?: string[];
    languages?: string[];
    packageManager?: string;
  }): WorkspaceLearningProfile {
    const profile: WorkspaceLearningProfile = {
      workspaceId: params.workspaceId,
      projectName: params.projectName,
      frameworks: params.frameworks ?? [],
      languages: params.languages ?? [],
      packageManager: params.packageManager ?? '',
      patterns: [],
      preferences: {},
      updatedAt: timestamp(),
    };
    this.profiles.set(params.workspaceId, profile);
    return profile;
  }

  updateFrameworks(workspaceId: string, frameworks: string[]): void {
    const profile = this.getOrCreate(workspaceId);
    profile.frameworks = [...new Set([...profile.frameworks, ...frameworks])];
    profile.updatedAt = timestamp();
  }

  updateLanguages(workspaceId: string, languages: string[]): void {
    const profile = this.getOrCreate(workspaceId);
    profile.languages = [...new Set([...profile.languages, ...languages])];
    profile.updatedAt = timestamp();
  }

  setPreference(
    workspaceId: string,
    key: 'preferredProvider' | 'preferredModel',
    value: string,
  ): void {
    const profile = this.getOrCreate(workspaceId);
    profile.preferences[key] = value;
    profile.updatedAt = timestamp();
  }

  // ── Pattern Management ──

  recordPattern(
    workspaceId: string,
    pattern: string,
    description: string,
    examples: string[],
  ): PatternRecord {
    const profile = this.getOrCreate(workspaceId);

    // Check for existing
    const existing = profile.patterns.find((p) => p.pattern === pattern);
    if (existing) {
      existing.frequency += 1;
      existing.detectedAt = timestamp();
      existing.examples = [...new Set([...existing.examples, ...examples])].slice(0, 10);
      profile.updatedAt = timestamp();
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

    profile.patterns.push(record);

    // Enforce max patterns — remove oldest if over limit
    if (profile.patterns.length > this.maxPatterns) {
      profile.patterns.sort((a, b) => b.frequency - a.frequency);
      profile.patterns = profile.patterns.slice(0, this.maxPatterns);
    }

    profile.updatedAt = timestamp();
    return record;
  }

  getHighFrequencyPatterns(workspaceId: string, minFrequency = 2): PatternRecord[] {
    const profile = this.profiles.get(workspaceId);
    if (!profile) return [];
    return profile.patterns
      .filter((p) => p.frequency >= minFrequency)
      .sort((a, b) => b.frequency - a.frequency);
  }

  getRecentPatterns(workspaceId: string, limit = 10): PatternRecord[] {
    const profile = this.profiles.get(workspaceId);
    if (!profile) return [];
    return [...profile.patterns].sort((a, b) => b.detectedAt - a.detectedAt).slice(0, limit);
  }

  // ── Query ──

  findWorkspacesByFramework(framework: string): WorkspaceLearningProfile[] {
    return Array.from(this.profiles.values()).filter((p) =>
      p.frameworks.some((f) => f.toLowerCase().includes(framework.toLowerCase())),
    );
  }

  findWorkspacesByLanguage(language: string): WorkspaceLearningProfile[] {
    return Array.from(this.profiles.values()).filter((p) =>
      p.languages.some((l) => l.toLowerCase().includes(language.toLowerCase())),
    );
  }

  // ── Stats ──

  getStats(): { totalWorkspaces: number; totalPatterns: number } {
    let totalPatterns = 0;
    for (const profile of this.profiles.values()) {
      totalPatterns += profile.patterns.length;
    }
    return {
      totalWorkspaces: this.profiles.size,
      totalPatterns,
    };
  }

  clear(workspaceId?: string): void {
    if (workspaceId) {
      this.profiles.delete(workspaceId);
    } else {
      this.profiles.clear();
    }
  }

  // ── Private ──

  private getOrCreate(workspaceId: string): WorkspaceLearningProfile {
    const existing = this.profiles.get(workspaceId);
    if (existing) return existing;

    return this.createProfile({
      workspaceId,
      projectName: workspaceId,
    });
  }
}
