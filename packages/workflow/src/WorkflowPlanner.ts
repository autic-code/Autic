/**
 * WorkflowPlanner — Lightweight task decomposition engine.
 *
 * Decomposes a high-level goal into ordered, dependency-aware execution steps.
 * Uses deterministic rules and pattern matching — no AI planning.
 */

import { generateId, timestamp } from '@autic/shared';
import type { WorkflowPlan, WorkflowStep, WorkflowStepType } from '@autic/shared';

export interface PlannerOptions {
  maxSteps?: number;
  defaultMaxRetries?: number;
}

export interface TaskTemplate {
  pattern: RegExp;
  steps: Array<{
    description: string;
    type: WorkflowStepType;
    toolName?: string;
    dependencies: number[]; // indices of steps this depends on
  }>;
}

/**
 * Default task templates for common engineering workflows.
 */
const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    // Build / compile
    pattern: /build|compile|make/i,
    steps: [
      { description: 'Analyze project structure', type: 'analyze', dependencies: [] },
      { description: 'Run build command', type: 'tool_call', toolName: 'run_terminal', dependencies: [0] },
      { description: 'Verify build output', type: 'verify', dependencies: [1] },
    ],
  },
  {
    // Test
    pattern: /test|run test/i,
    steps: [
      { description: 'Analyze test configuration', type: 'analyze', dependencies: [] },
      { description: 'Run test suite', type: 'tool_call', toolName: 'run_terminal', dependencies: [0] },
      { description: 'Parse test results', type: 'verify', dependencies: [1] },
    ],
  },
  {
    // Fix / repair
    pattern: /fix|repair|resolve/i,
    steps: [
      { description: 'Analyze issue', type: 'analyze', dependencies: [] },
      { description: 'Read relevant files', type: 'tool_call', toolName: 'read_file', dependencies: [0] },
      { description: 'Apply fix', type: 'tool_call', toolName: 'write_file', dependencies: [1] },
      { description: 'Verify fix', type: 'verify', dependencies: [2] },
    ],
  },
  {
    // Install / setup
    pattern: /install|setup|configure/i,
    steps: [
      { description: 'Analyze project requirements', type: 'analyze', dependencies: [] },
      { description: 'Install dependencies', type: 'tool_call', toolName: 'run_terminal', dependencies: [0] },
      { description: 'Verify installation', type: 'verify', dependencies: [1] },
    ],
  },
  {
    // Analyze / audit
    pattern: /analyze|audit|inspect|review/i,
    steps: [
      { description: 'Scan repository structure', type: 'analyze', dependencies: [] },
      { description: 'Read key files', type: 'tool_call', toolName: 'read_file', dependencies: [0] },
      { description: 'Search for patterns', type: 'tool_call', toolName: 'search_files', dependencies: [1] },
      { description: 'Generate analysis', type: 'analyze', dependencies: [2] },
    ],
  },
];

export class WorkflowPlanner {
  private templates: TaskTemplate[];

  constructor(private options: PlannerOptions = {}) {
    this.templates = [...DEFAULT_TEMPLATES];
  }

  /**
   * Register a custom task template.
   */
  addTemplate(template: TaskTemplate): void {
    this.templates.push(template);
  }

  /**
   * Plan a workflow from a high-level goal string.
   * Matches against known templates and generates an ordered step list.
   */
  plan(params: {
    sessionId: string;
    goal: string;
    maxSteps?: number;
  }): WorkflowPlan {
    const { sessionId, goal } = params;
    const maxSteps = params.maxSteps || this.options.maxSteps || 20;
    const maxRetries = this.options.defaultMaxRetries || 2;

    const steps = this.generateSteps(goal, maxSteps, maxRetries);

    return {
      id: generateId(),
      sessionId,
      goal,
      steps,
      createdAt: timestamp(),
      metadata: {},
    };
  }

  /**
   * Re-plan a workflow with updated goal (for repair/retry scenarios).
   */
  replan(original: WorkflowPlan, failedStepIndex: number, fixDescription: string): WorkflowPlan {
    const fixedSteps = original.steps.slice(0, failedStepIndex);

    // Add the fix step
    const fixStep: WorkflowStep = {
      id: generateId(),
      description: `Fix: ${fixDescription}`,
      type: 'repair',
      dependencies: fixedSteps.length > 0 ? [fixedSteps[fixedSteps.length - 1].id] : [],
      status: 'pending',
      retries: 0,
      maxRetries: original.steps[failedStepIndex]?.maxRetries || 2,
    };
    fixedSteps.push(fixStep);

    // Re-add remaining original steps
    for (let i = failedStepIndex; i < original.steps.length; i++) {
      const orig = original.steps[i];
      fixedSteps.push({
        ...orig,
        id: generateId(),
        status: 'pending',
        retries: 0,
      });
    }

    return {
      id: generateId(),
      sessionId: original.sessionId,
      goal: original.goal,
      steps: fixedSteps,
      createdAt: timestamp(),
      metadata: { ...original.metadata, replanned: 'true', originalPlanId: original.id },
    };
  }

  /**
   * Execute a simple scan of the workspace to determine what kind of project this is.
   * This is used to create more specific plans.
   */
  async scanAndPlan(params: {
    sessionId: string;
    goal: string;
    listFiles: (path: string) => Promise<string[]>;
    readFile: (path: string) => Promise<string | null>;
  }): Promise<WorkflowPlan> {
    const { sessionId, goal, listFiles, readFile: _rf } = params;
    const maxRetries = this.options.defaultMaxRetries || 2;

    try {
      const rootFiles = await listFiles('.');
      const configFiles = rootFiles.filter((f) =>
        ['package.json', 'tsconfig.json', 'Cargo.toml', 'Gemfile', 'requirements.txt', 'Makefile', 'Dockerfile'].includes(f),
      );

      const steps: WorkflowStep[] = [];
      const stepIds: string[] = [];

      // Step 0: Analyze
      const analyzeStep = this.makeStep('Analyze project structure', 'analyze', [], maxRetries);
      steps.push(analyzeStep);
      stepIds.push(analyzeStep.id);

      // Read config files
      for (const cfg of configFiles) {
        const readStep = this.makeStep(`Read ${cfg}`, 'tool_call', [stepIds[0]], maxRetries, 'read_file', { path: cfg });
        steps.push(readStep);
        stepIds.push(readStep.id);
      }

      // Generate plan based on goal
      const planStep = this.makeStep('Generate execution plan', 'plan', stepIds.slice(1), maxRetries);
      steps.push(planStep);
      stepIds.push(planStep.id);

      // Main execution steps from template
      const templateSteps = this.generateSteps(goal, 10, maxRetries);
      for (const ts of templateSteps) {
        ts.dependencies = [planStep.id];
        steps.push(ts);
        stepIds.push(ts.id);
      }

      // Final verification
      const verifyStep = this.makeStep('Verify overall result', 'verify', stepIds.slice(-3), maxRetries);
      steps.push(verifyStep);

      return {
        id: generateId(),
        sessionId,
        goal,
        steps,
        createdAt: timestamp(),
        metadata: { scanned: 'true', configFiles: configFiles.join(',') },
      };
    } catch {
      // Fall back to basic plan
      return this.plan({ sessionId, goal });
    }
  }

  // ---- Private helpers ----

  private generateSteps(goal: string, maxSteps: number, maxRetries: number): WorkflowStep[] {
    const template = this.templates.find((t) => t.pattern.test(goal));
    if (!template) {
      // Default: generic workflow
      return this.defaultSteps(maxRetries).slice(0, maxSteps);
    }

    const steps: WorkflowStep[] = [];
    const stepIds: string[] = [];

    for (const tStep of template.steps) {
      const deps = tStep.dependencies.map((idx) => stepIds[idx]).filter(Boolean);
      const step = this.makeStep(tStep.description, tStep.type, deps, maxRetries, tStep.toolName);
      steps.push(step);
      stepIds.push(step.id);
    }

    return steps.slice(0, maxSteps);
  }

  private defaultSteps(maxRetries: number): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const ids: string[] = [];

    const defaultPlan = [
      { desc: 'Analyze current state', type: 'analyze' as const },
      { desc: 'Develop solution approach', type: 'plan' as const },
      { desc: 'Execute changes', type: 'tool_call' as const, tool: 'run_terminal' },
      { desc: 'Verify results', type: 'verify' as const },
      { desc: 'Complete', type: 'complete' as const },
    ];

    for (const p of defaultPlan) {
      const step = this.makeStep(p.desc, p.type, ids.length > 0 ? [ids[ids.length - 1]] : [], maxRetries, p.tool);
      steps.push(step);
      ids.push(step.id);
    }

    return steps;
  }

  private makeStep(
    description: string,
    type: WorkflowStepType,
    dependencies: string[],
    maxRetries: number,
    toolName?: string,
    toolArgs?: Record<string, unknown>,
  ): WorkflowStep {
    return {
      id: generateId(),
      description,
      type,
      toolName,
      toolArgs,
      dependencies,
      status: 'pending',
      retries: 0,
      maxRetries,
    };
  }
}
