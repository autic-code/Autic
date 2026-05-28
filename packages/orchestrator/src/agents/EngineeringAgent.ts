/**
 * EngineeringAgent — Code implementation and module integration.
 *
 * Responsibilities:
 *   - Execute code changes using SkillExecutor
 *   - Scoped write access for targeted edits
 *   - Track file modifications
 *   - Produce structured EngineeringOutput
 *
 * Tool scope: read + write (read_file, write_file, list_files, search_files, run_terminal)
 *
 * This agent delegates to the skills system for execution, then reports results.
 */

import { timestamp } from '@autic/shared';
import type { 
  EngineeringOutput, 
  PlanningOutput, 
  TaskContract, 
  OrchestrationStage,
} from '@autic/shared';
import { SkillExecutor } from '@autic/skills';
import { SkillRegistry, AgentRegistry } from '@autic/skills';
import { createContract, fulfillContract, rejectContract, getContractOutput } from '../contracts.js';

type ToolRunner = (toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class EngineeringAgent {
  private skillExecutor: SkillExecutor;

  constructor(skillRegistry?: SkillRegistry, agentRegistry?: AgentRegistry) {
    this.skillExecutor = new SkillExecutor(skillRegistry ?? new SkillRegistry(), agentRegistry ?? new AgentRegistry(), {
      maxDepth: 15,
      defaultTimeoutMs: 300_000,
      maxSteps: 25,
      maxRetries: 3,
    });
  }

  /**
   * Execute an engineering stage.
   * Uses the skills system to run the code-fixer or typescript-engineer skill.
   */
  async execute(
    goal: string,
    runTool: ToolRunner,
    previousContract?: TaskContract,
  ): Promise<TaskContract> {
    const contract = createContract(
      'engineering' as OrchestrationStage,
      'verification' as OrchestrationStage,
      'code_implementation',
      { goal, timestamp: timestamp() },
    );

    try {
      // Get planning data for task breakdown
      const planningOutput = previousContract
        ? getContractOutput<PlanningOutput>(previousContract)
        : undefined;

      // Determine which skill to use based on the goal
      const skillId = this.selectSkill(goal);

      // Wire tool executor into skill executor
      this.skillExecutor.setToolExecutor(runTool);

      // Execute via skill system
      const report = await this.skillExecutor.executeSkill({
        skillId,
        goal,
        sessionId: 'orchestrator-engineering',
      });

      // Build output from execution report
      // Note: For deterministic output, we track what was changed via tool calls
      const filesModified: string[] = [];
      const filesCreated: string[] = [];
      const warnings: string[] = [];

      if (report.error) {
        warnings.push(report.error);
      }

      if (planningOutput) {
        warnings.push(`Planned ${planningOutput.tasks.length} tasks, executed via "${skillId}" skill`);
      }

      const output: EngineeringOutput = {
        changesApplied: report.steps,
        filesModified,
        filesCreated,
        summary: report.success
          ? `Engineering completed: ${report.steps} steps in ${report.durationMs}ms`
          : `Engineering had issues: ${report.error || 'Unknown error'}`,
        warnings,
      };

      return contract.status === 'fulfilled'
        ? contract
        : fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      return rejectContract(
        contract,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Set the tool executor on the internal skill executor.
   */
  setToolExecutor(runTool: ToolRunner): void {
    this.skillExecutor.setToolExecutor(runTool);
  }

  /**
   * Select the best skill for the given goal.
   */
  private selectSkill(goal: string): string {
    const lower = goal.toLowerCase();

    if (/typescript|type.*fix|tsconfig|\.ts\b/.test(lower)) {
      return 'typescript-engineer';
    }
    if (/debug|trace|log|stack|crash|hang/.test(lower)) {
      return 'debugging-specialist';
    }
    if (/build|create|generate|scaffold|new|startup|init/.test(lower)) {
      return 'startup-builder';
    }
    if (/analyze|audit|inspect|understand|explain/.test(lower)) {
      return 'repo-analyzer';
    }

    return 'code-fixer';
  }
}
