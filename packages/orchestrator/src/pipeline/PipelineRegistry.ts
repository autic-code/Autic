/**
 * PipelineRegistry — Pipeline definition and registration.
 *
 * Manages:
 *   - Pipeline definitions (ordered stage sequences)
 *   - Pipeline lookup and listing
 *   - Default pipeline for common workflows
 *   - Custom pipeline registration
 *
 * Pipelines are NOT complex DAGs. They are ordered stage sequences
 * with deterministic transitions and safety boundaries.
 */

import type { PipelineDefinition, OrchestrationStage, OrchestratorOptions } from '@autic/shared';

export interface PipelineRegistryOptions {
  maxPipelines?: number;
}

/**
 * Default full R&D pipeline: Research → Plan → Architect → Engineer → Verify → Repair → Final Review
 */
const DEFAULT_FULL_PIPELINE: PipelineDefinition = {
  id: 'full-development',
  name: 'Full Development Pipeline',
  description:
    'Research → Plan → Architecture → Engineering → Verification → Repair → Final Review',
  stages: [
    'research',
    'planning',
    'architecture',
    'engineering',
    'verification',
    'repair',
    'final_review',
  ],
  timeoutMs: 600_000,
  maxDelegations: 50,
  safetyProfile: 'balanced',
};

/**
 * Safe pipeline: read-only analysis stages only
 */
const DEFAULT_SAFE_PIPELINE: PipelineDefinition = {
  id: 'analysis-only',
  name: 'Analysis Pipeline',
  description: 'Research → Plan → Architecture (read-only, no engineering or modification)',
  stages: ['research', 'planning', 'architecture'],
  timeoutMs: 120_000,
  maxDelegations: 10,
  safetyProfile: 'safe',
};

/**
 * Engineering-only pipeline: skip research/planning, go straight to engineering
 */
const DEFAULT_ENGINEERING_PIPELINE: PipelineDefinition = {
  id: 'engineering-only',
  name: 'Engineering Pipeline',
  description: 'Engineering → Verification → Repair → Final Review',
  stages: ['engineering', 'verification', 'repair', 'final_review'],
  timeoutMs: 300_000,
  maxDelegations: 30,
  safetyProfile: 'balanced',
};

export class PipelineRegistry {
  private pipelines: Map<string, PipelineDefinition> = new Map();
  private maxPipelines: number;

  constructor(options: PipelineRegistryOptions = {}) {
    this.maxPipelines = options.maxPipelines || 20;

    // Register default pipelines
    this.register(DEFAULT_FULL_PIPELINE);
    this.register(DEFAULT_SAFE_PIPELINE);
    this.register(DEFAULT_ENGINEERING_PIPELINE);
  }

  /**
   * Register a pipeline definition.
   */
  register(pipeline: PipelineDefinition): void {
    if (this.pipelines.size >= this.maxPipelines) {
      throw new Error(`Pipeline registry full (max ${this.maxPipelines})`);
    }
    if (this.pipelines.has(pipeline.id)) {
      throw new Error(`Pipeline already registered: ${pipeline.id}`);
    }
    this.pipelines.set(pipeline.id, { ...pipeline });
  }

  /**
   * Unregister a pipeline by id.
   */
  unregister(id: string): boolean {
    return this.pipelines.delete(id);
  }

  /**
   * Get a pipeline by id.
   */
  get(id: string): PipelineDefinition | undefined {
    return this.pipelines.get(id);
  }

  /**
   * List all registered pipelines.
   */
  list(): PipelineDefinition[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Select the best pipeline for a given goal and options.
   * Deterministic: matches by keyword patterns.
   */
  selectForGoal(goal: string, options?: OrchestratorOptions): PipelineDefinition {
    const goalLower = goal.toLowerCase();

    // If a specific pipeline is requested, try it
    if (options?.defaultPipelineId) {
      const specific = this.get(options.defaultPipelineId);
      if (specific) return specific;
    }

    // Analysis-only goals
    if (/^(analyze|audit|inspect|review|what is|describe|list)/.test(goalLower)) {
      return this.get('analysis-only') || this.get('full-development')!;
    }

    // Engineering-only goals (fixed scope, no research needed)
    if (/^(fix|refactor|rename|move|delete|update)/.test(goalLower)) {
      return this.get('engineering-only') || this.get('full-development')!;
    }

    // Safe mode override
    if (options?.safetyProfile === 'safe') {
      return this.get('analysis-only') || this.get('full-development')!;
    }

    return this.get('full-development')!;
  }

  /**
   * Get the stage index within a pipeline.
   */
  getStageIndex(pipelineId: string, stage: OrchestrationStage): number {
    const pipeline = this.get(pipelineId);
    if (!pipeline) return -1;
    return pipeline.stages.indexOf(stage);
  }

  /**
   * Get the next stage after the current one in a pipeline.
   */
  getNextStage(pipelineId: string, currentStage: OrchestrationStage): OrchestrationStage | null {
    const pipeline = this.get(pipelineId);
    if (!pipeline) return null;

    const idx = pipeline.stages.indexOf(currentStage);
    if (idx === -1 || idx >= pipeline.stages.length - 1) return null;

    return pipeline.stages[idx + 1];
  }

  /**
   * Check if a stage is the final stage in a pipeline.
   */
  isFinalStage(pipelineId: string, stage: OrchestrationStage): boolean {
    const pipeline = this.get(pipelineId);
    if (!pipeline) return false;
    return pipeline.stages[pipeline.stages.length - 1] === stage;
  }

  /**
   * Clear all pipelines.
   */
  clear(): void {
    this.pipelines.clear();
  }

  /**
   * Count registered pipelines.
   */
  count(): number {
    return this.pipelines.size;
  }
}
