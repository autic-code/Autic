/**
 * PlanningAgent — Task decomposition and execution sequencing agent.
 *
 * Responsibilities:
 *   - Decompose goals into ordered, dependency-aware tasks
 *   - Generate execution sequences
 *   - Estimate task complexity
 *   - Identify risks
 *   - Produce structured PlanningOutput contract
 *
 * Tool scope: none (no file access — pure planning)
 * Uses WorkflowPlanner pattern for deterministic task decomposition.
 */

import { timestamp } from '@autic/shared';
import type { 
  PlanningOutput, 
  ResearchOutput, 
  TaskContract, 
  OrchestrationStage,
} from '@autic/shared';
import { createContract, fulfillContract, rejectContract, getContractOutput } from '../contracts.js';

export interface PlanningAgentOptions {
  maxTasks?: number;
  timeoutMs?: number;
}

type TaskDefinition = {
  id: string;
  description: string;
  type: string;
  dependencies: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
};

// Task templates based on goal keywords
const TASK_TEMPLATES: Array<{
  pattern: RegExp;
  tasks: Omit<TaskDefinition, 'id'>[];
}> = [
  {
    pattern: /build|create|generate|scaffold|new/i,
    tasks: [
      { description: 'Set up project structure', type: 'tool_call', dependencies: [], estimatedComplexity: 'medium' },
      { description: 'Create core module files', type: 'tool_call', dependencies: ['task-0'], estimatedComplexity: 'high' },
      { description: 'Configure build system', type: 'tool_call', dependencies: ['task-0'], estimatedComplexity: 'medium' },
      { description: 'Implement primary functionality', type: 'tool_call', dependencies: ['task-1', 'task-2'], estimatedComplexity: 'high' },
      { description: 'Add tests for core modules', type: 'tool_call', dependencies: ['task-3'], estimatedComplexity: 'medium' },
      { description: 'Verify build passes', type: 'verify', dependencies: ['task-4'], estimatedComplexity: 'low' },
    ],
  },
  {
    pattern: /fix|repair|resolve|patch|bug|error|issue/i,
    tasks: [
      { description: 'Reproduce the issue', type: 'tool_call', dependencies: [], estimatedComplexity: 'medium' },
      { description: 'Identify root cause', type: 'analyze', dependencies: ['task-0'], estimatedComplexity: 'medium' },
      { description: 'Apply targeted fix', type: 'tool_call', dependencies: ['task-1'], estimatedComplexity: 'medium' },
      { description: 'Verify fix resolves issue', type: 'verify', dependencies: ['task-2'], estimatedComplexity: 'low' },
    ],
  },
  {
    pattern: /refactor|restructure|reorganize|clean/i,
    tasks: [
      { description: 'Map current code structure', type: 'analyze', dependencies: [], estimatedComplexity: 'medium' },
      { description: 'Apply refactoring changes', type: 'tool_call', dependencies: ['task-0'], estimatedComplexity: 'high' },
      { description: 'Run type checking', type: 'verify', dependencies: ['task-1'], estimatedComplexity: 'low' },
      { description: 'Verify existing tests pass', type: 'verify', dependencies: ['task-1'], estimatedComplexity: 'low' },
    ],
  },
  {
    pattern: /analyze|audit|inspect|review|profile/i,
    tasks: [
      { description: 'Scan repository structure', type: 'analyze', dependencies: [], estimatedComplexity: 'low' },
      { description: 'Run analysis commands', type: 'tool_call', dependencies: ['task-0'], estimatedComplexity: 'medium' },
      { description: 'Compile findings report', type: 'complete', dependencies: ['task-1'], estimatedComplexity: 'medium' },
    ],
  },
  {
    pattern: /deploy|release|publish|ship/i,
    tasks: [
      { description: 'Verify build is clean', type: 'verify', dependencies: [], estimatedComplexity: 'low' },
      { description: 'Run full test suite', type: 'verify', dependencies: ['task-0'], estimatedComplexity: 'medium' },
      { description: 'Execute deployment steps', type: 'tool_call', dependencies: ['task-1'], estimatedComplexity: 'high' },
      { description: 'Verify deployment succeeded', type: 'verify', dependencies: ['task-2'], estimatedComplexity: 'low' },
    ],
  },
];

function generateDefaultTasks(goal: string): Omit<TaskDefinition, 'id'>[] {
  return [
    { description: 'Analyze current state', type: 'analyze', dependencies: [], estimatedComplexity: 'low' },
    { description: 'Develop solution approach', type: 'plan', dependencies: ['task-0'], estimatedComplexity: 'medium' },
    { description: `Execute: ${goal.slice(0, 60)}`, type: 'tool_call', dependencies: ['task-1'], estimatedComplexity: 'high' },
    { description: 'Verify results', type: 'verify', dependencies: ['task-2'], estimatedComplexity: 'low' },
    { description: 'Complete and summarize', type: 'complete', dependencies: ['task-3'], estimatedComplexity: 'low' },
  ];
}

export class PlanningAgent {
  private options: Required<PlanningAgentOptions>;

  constructor(options: PlanningAgentOptions = {}) {
    this.options = {
      maxTasks: options.maxTasks ?? 15,
      timeoutMs: options.timeoutMs ?? 30_000,
    };
  }

  /**
   * Execute a planning stage.
   * Takes the research contract output and produces a plan.
   */
  async execute(
    goal: string,
    _runTool: (toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>,
    previousContract?: TaskContract,
  ): Promise<TaskContract> {
    const contract = createContract(
      'planning' as OrchestrationStage,
      'architecture' as OrchestrationStage,
      'execution_plan',
      { goal, timestamp: timestamp() },
    );

    try {
      // Get research data if available
      const research = previousContract
        ? getContractOutput<ResearchOutput>(previousContract)
        : undefined;

      // Decompose goal into tasks
      const tasks = this.decomposeGoal(goal, research);
      const estimatedSteps = tasks.length;

      // Identify risks
      const risks = this.identifyRisks(goal, research);

      // Suggest optimal pipeline
      const suggestedPipeline = this.suggestPipeline(goal);

      const output: PlanningOutput = {
        tasks: tasks.slice(0, this.options.maxTasks),
        estimatedSteps,
        suggestedPipeline,
        risks,
      };

      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      return rejectContract(
        contract,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Decompose a goal into ordered, dependency-aware tasks.
   */
  private decomposeGoal(
    goal: string,
    _research?: ResearchOutput,
  ): TaskDefinition[] {
    const goalLower = goal.toLowerCase();
    const template = TASK_TEMPLATES.find((t) => t.pattern.test(goalLower));

    const rawTasks = template
      ? template.tasks
      : generateDefaultTasks(goal);

    // Assign IDs based on index
    return rawTasks.slice(0, this.options.maxTasks).map((t, i) => ({
      ...t,
      id: `task-${i}`,
    }));
  }

  /**
   * Identify potential risks based on goal and repo analysis.
   */
  private identifyRisks(goal: string, research?: ResearchOutput): string[] {
    const risks: string[] = [];
    const goalLower = goal.toLowerCase();

    if (research) {
      if (research.frameworks.length === 0) {
        risks.push('No recognized framework detected — may require additional setup');
      }
      if (research.dependencies.length > 50) {
        risks.push('Large dependency tree — package operations may be slow');
      }
    }

    if (/deploy|release|publish|production/i.test(goalLower)) {
      risks.push('Deployment operations require safety confirmation');
    }

    if (/delete|remove|migrate|drop/i.test(goalLower)) {
      risks.push('Destructive operations detected — verify before execution');
    }

    if (risks.length === 0) {
      risks.push('No significant risks detected');
    }

    return risks;
  }

  /**
   * Suggest the optimal pipeline for the goal.
   */
  private suggestPipeline(goal: string): string[] {
    const goalLower = goal.toLowerCase();

    if (/analyze|audit|inspect|review/i.test(goalLower)) {
      return ['research', 'planning', 'architecture'];
    }

    if (/fix|repair|patch/i.test(goalLower)) {
      return ['research', 'planning', 'engineering', 'verification'];
    }

    return [
      'research',
      'planning',
      'architecture',
      'engineering',
      'verification',
      'repair',
      'final_review',
    ];
  }
}
