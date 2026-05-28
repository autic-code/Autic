/**
 * RoleBasedPipelines — Reusable coordinated execution pipelines (#6)
 *
 * Pre-defined pipelines for common multi-agent workflows:
 *   - Large Refactor Pipeline: Research → Planning → Architecture → Engineering → Verification → Repair → Final Review
 *   - Analysis Pipeline: Research → Planning → Architecture
 *   - Quick Fix Pipeline: Engineering → Verification → Repair
 *
 * Each pipeline has bounded stages, deterministic routing, and safety limits.
 */

import type { SwarmPipelineDefinition, SwarmAgentRole } from '@autic/shared';

export type PipelineTemplateId =
  | 'large-refactor'
  | 'analysis'
  | 'quick-fix'
  | 'verification-only'
  | 'full-development';

const PIPELINE_TEMPLATES: Record<PipelineTemplateId, SwarmPipelineDefinition> = {
  'large-refactor': {
    id: 'large-refactor',
    name: 'Large Refactor Pipeline',
    description:
      'Research → Planning → Architecture → Engineering → Verification → Repair → Final Review',
    stages: [
      {
        name: 'Research',
        role: 'researcher',
        description: 'Analyze codebase and identify refactoring targets',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Planning',
        role: 'planner',
        description: 'Decompose refactoring into ordered tasks',
        timeoutMs: 60_000,
        retries: 2,
      },
      {
        name: 'Architecture',
        role: 'architect',
        description: 'Validate architectural boundaries and dependencies',
        timeoutMs: 60_000,
        retries: 1,
      },
      {
        name: 'Engineering',
        role: 'engineer',
        description: 'Execute refactoring changes',
        timeoutMs: 300_000,
        retries: 3,
      },
      {
        name: 'Verification',
        role: 'verifier',
        description: 'Build, test, and lint verification',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Repair',
        role: 'repairer',
        description: 'Fix any verification failures',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Final Review',
        role: 'reviewer',
        description: 'Final quality gate review',
        timeoutMs: 60_000,
        retries: 1,
      },
    ],
    timeoutMs: 600_000,
    maxParallelism: 1,
  },
  analysis: {
    id: 'analysis',
    name: 'Analysis Pipeline',
    description: 'Research → Planning → Architecture (read-only)',
    stages: [
      {
        name: 'Research',
        role: 'researcher',
        description: 'Analyze codebase structure and dependencies',
        timeoutMs: 60_000,
        retries: 1,
      },
      {
        name: 'Planning',
        role: 'planner',
        description: 'Plan analysis tasks',
        timeoutMs: 30_000,
        retries: 1,
      },
      {
        name: 'Architecture',
        role: 'architect',
        description: 'Validate architecture',
        timeoutMs: 30_000,
        retries: 1,
      },
    ],
    timeoutMs: 180_000,
    maxParallelism: 1,
  },
  'quick-fix': {
    id: 'quick-fix',
    name: 'Quick Fix Pipeline',
    description: 'Engineering → Verification → Repair',
    stages: [
      {
        name: 'Engineering',
        role: 'engineer',
        description: 'Apply fix',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Verification',
        role: 'verifier',
        description: 'Verify fix',
        timeoutMs: 60_000,
        retries: 1,
      },
      {
        name: 'Repair',
        role: 'repairer',
        description: 'Repair any issues',
        timeoutMs: 60_000,
        retries: 2,
      },
    ],
    timeoutMs: 300_000,
    maxParallelism: 1,
  },
  'verification-only': {
    id: 'verification-only',
    name: 'Verification Pipeline',
    description: 'Verification → Repair',
    stages: [
      {
        name: 'Verification',
        role: 'verifier',
        description: 'Run verification checks',
        timeoutMs: 60_000,
        retries: 1,
      },
      {
        name: 'Repair',
        role: 'repairer',
        description: 'Repair failures',
        timeoutMs: 60_000,
        retries: 2,
      },
    ],
    timeoutMs: 180_000,
    maxParallelism: 2,
  },
  'full-development': {
    id: 'full-development',
    name: 'Full Development Pipeline',
    description:
      'Research → Planning → Architecture → Engineering → Verification → Repair → Final Review',
    stages: [
      {
        name: 'Research',
        role: 'researcher',
        description: 'Analyze requirements and codebase',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Planning',
        role: 'planner',
        description: 'Plan implementation tasks',
        timeoutMs: 60_000,
        retries: 2,
      },
      {
        name: 'Architecture',
        role: 'architect',
        description: 'Design architecture',
        timeoutMs: 60_000,
        retries: 1,
      },
      {
        name: 'Engineering',
        role: 'engineer',
        description: 'Implement changes',
        timeoutMs: 300_000,
        retries: 3,
      },
      {
        name: 'Verification',
        role: 'verifier',
        description: 'Verify implementation',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Repair',
        role: 'repairer',
        description: 'Repair verification failures',
        timeoutMs: 120_000,
        retries: 2,
      },
      {
        name: 'Final Review',
        role: 'reviewer',
        description: 'Final review',
        timeoutMs: 60_000,
        retries: 1,
      },
    ],
    timeoutMs: 600_000,
    maxParallelism: 1,
  },
};

export class RoleBasedPipelines {
  private pipelines: Map<string, SwarmPipelineDefinition> = new Map();

  constructor() {
    // Register all default pipelines
    for (const [, pipeline] of Object.entries(PIPELINE_TEMPLATES)) {
      this.pipelines.set(pipeline.id, pipeline);
    }
  }

  /** Get a pipeline by id */
  get(id: string): SwarmPipelineDefinition | undefined {
    return this.pipelines.get(id);
  }

  /** Register a custom pipeline */
  register(pipeline: SwarmPipelineDefinition): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  /** Unregister a pipeline */
  unregister(id: string): boolean {
    return this.pipelines.delete(id);
  }

  /** List all registered pipelines */
  list(): SwarmPipelineDefinition[] {
    return Array.from(this.pipelines.values());
  }

  /** Select the best pipeline for a given goal */
  selectForGoal(goal: string): SwarmPipelineDefinition {
    const lower = goal.toLowerCase();

    if (lower.includes('refactor') || lower.includes('restructure') || lower.includes('rewrite')) {
      return this.pipelines.get('large-refactor')!;
    }
    if (
      lower.includes('analyze') ||
      lower.includes('audit') ||
      lower.includes('review') ||
      lower.includes('inspect')
    ) {
      return this.pipelines.get('analysis')!;
    }
    if (
      lower.includes('fix') ||
      lower.includes('bug') ||
      lower.includes('repair') ||
      lower.includes('patch')
    ) {
      return this.pipelines.get('quick-fix')!;
    }
    if (lower.includes('verify') || lower.includes('test') || lower.includes('validate')) {
      return this.pipelines.get('verification-only')!;
    }

    return this.pipelines.get('full-development')!;
  }

  /** Get the next stage in a pipeline */
  getNextStage(
    pipelineId: string,
    currentStageName: string,
  ): {
    name: string;
    role: SwarmAgentRole;
    description: string;
    timeoutMs: number;
    retries: number;
  } | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;

    const idx = pipeline.stages.findIndex((s) => s.name === currentStageName);
    if (idx === -1 || idx >= pipeline.stages.length - 1) return null;

    return pipeline.stages[idx + 1];
  }

  /** Check if a stage is the final stage */
  isFinalStage(pipelineId: string, stageName: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline || pipeline.stages.length === 0) return false;
    return pipeline.stages[pipeline.stages.length - 1].name === stageName;
  }

  /** Clear all pipelines and reload defaults */
  reset(): void {
    this.pipelines.clear();
    for (const [, pipeline] of Object.entries(PIPELINE_TEMPLATES)) {
      this.pipelines.set(pipeline.id, pipeline);
    }
  }
}
