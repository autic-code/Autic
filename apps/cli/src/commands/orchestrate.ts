/**
 * autic orchestrate — Run the full orchestrated pipeline system.
 *
 * Executes the Neuro Brain pipeline:
 *   Research → Planning → Architecture → Engineering → Verification → Repair → Final Review
 *
 * Displays real-time pipeline stage progress with structured UI.
 * Each stage is executed by a bounded specialized agent.
 */

import { Orchestrator } from '@autic/orchestrator';
import { ToolRegistry, registerBuiltinTools } from '@autic/tools';
import * as toolHandlers from '@autic/tools';
import { SkillRegistry, AgentRegistry, registerBuiltinSkills } from '@autic/skills';
import {
  pipelineHeader,
  stageLine,
  renderPipeline,
  compactPipelineLine,
  pipelineSummary,
  colorText,
} from '@autic/ui';
import type { PipelineDisplay, PipelineStageDisplay } from '@autic/ui';
import type { OrchestrationStage, OrchestrationEvent } from '@autic/shared';

/** Build a tool executor from ToolRegistry and tool handler module */
function buildToolExecutor() {
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools(toolRegistry);

  return async (toolName: string, args: Record<string, unknown>) => {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, data: undefined, error: `Tool not found: ${toolName}` };
    }
    const handler = (toolHandlers as Record<string, unknown>)[tool.handler];
    if (typeof handler !== 'function') {
      return { success: false, data: undefined, error: `Tool handler not found: ${tool.handler}` };
    }
    try {
      const result = await (handler as (args: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>)(args);
      return { success: result.success, data: result.data, error: result.error };
    } catch (err) {
      return { success: false, data: undefined, error: err instanceof Error ? err.message : String(err) };
    }
  };
}

/** Stage labels for display */
const STAGE_LABELS: Record<string, string> = {
  research: 'Research',
  planning: 'Planning',
  architecture: 'Architecture',
  engineering: 'Engineering',
  verification: 'Verification',
  repair: 'Repair',
  final_review: 'Final Review',
  completed: 'Complete',
};

/**
 * autic orchestrate — run the full pipeline
 */
export async function orchestrateCommand(
  goal: string,
  options: {
    pipeline?: string;
    stage?: string;
    verbose?: boolean;
  } = {},
): Promise<void> {
  // Initialize systems
  const skillRegistry = new SkillRegistry();
  const agentRegistry = new AgentRegistry();
  registerBuiltinSkills(skillRegistry, agentRegistry);

  const orchestrator = new Orchestrator({
    defaultPipelineId: options.pipeline || 'full-development',
    safetyProfile: 'balanced',
  });

  // Wire the engineering agent with skill/agent registries
  orchestrator.setSkillRegistry(skillRegistry);

  const toolExec = buildToolExecutor();

  if (!goal) {
    console.log(colorText('❯ Autic Orchestrate — Neuro Brain Pipeline System', 'bold'));
    console.log('');
    console.log('  Usage:');
    console.log('');
    console.log('    autic orchestrate \"Build a REST API\"       Full R&D pipeline');
    console.log('    autic orchestrate \"Analyze codebase\"        Analysis-only pipeline');
    console.log('    autic orchestrate \"Fix TypeScript errors\"   Engineering pipeline');
    console.log('');
    console.log('  Pipelines:');
    console.log('    full-development    Research → Planning → Architecture → Engineering → Verification → Repair → Final Review');
    console.log('    analysis-only       Research → Planning → Architecture (read-only)');
    console.log('    engineering-only    Engineering → Verification → Repair → Final Review');
    console.log('');
    console.log('  Options:');
    console.log('    --pipeline <id>      Pipeline to use (default: auto-select)');
    console.log('    --stage <name>       Execute a single stage');
    console.log('    --verbose            Show detailed event log');
    console.log('');
    return;
  }

  console.log(colorText('❯ Autic Orchestrate', 'bold'));
  console.log(colorText(`  Goal: ${goal}`, 'dim'));

  // Show pipeline info
  const pipeline = orchestrator.getPipelineRegistry().selectForGoal(goal);
  const stageLabels = pipeline.stages.map((s: string) => STAGE_LABELS[s] || s).join(' → ');
  console.log(colorText(`  Pipeline: ${pipeline.name}`, 'dim'));
  console.log(colorText(`  Stages: ${stageLabels}`, 'dim'));
  if (options.verbose) {
    console.log('');
    console.log(colorText(`  Pipeline ID: ${pipeline.id}`, 'muted'));
    console.log(colorText(`  Max delegations: ${pipeline.maxDelegations}`, 'muted'));
    console.log(colorText(`  Safety profile: ${pipeline.safetyProfile}`, 'muted'));
  }
  console.log('');

  // Single stage mode
  if (options.stage) {
    console.log(colorText(`  Executing single stage: ${options.stage}`, 'primary'));
    console.log('');
    const result = await orchestrator.executeStage({
      stage: options.stage as OrchestrationStage,
      goal,
      runTool: toolExec,
    });

    console.log(result.success
      ? `  ${colorText('✓ Stage completed', 'success')}`
      : `  ${colorText(`✗ Stage failed: ${result.error}`, 'error')}`
    );
    return;
  }

  // Listen for pipeline events
  const stageStatuses: Map<string, PipelineStageDisplay> = new Map();

  orchestrator.onEvent((event: OrchestrationEvent) => {
    if (event.type.startsWith('pipeline:stage_')) {
      const stage = event.stage as string;
      const existing = stageStatuses.get(stage) || {
        stage,
        status: 'pending' as const,
      };

      if (event.type === 'pipeline:stage_started') {
        existing.status = 'running';
      } else if (event.type === 'pipeline:stage_completed') {
        existing.status = 'completed';
        existing.durationMs = (event.data?.durationMs as number) || undefined;
      } else if (event.type === 'pipeline:stage_failed') {
        existing.status = 'failed';
        existing.error = event.error;
      } else if (event.type === 'pipeline:stage_skipped') {
        existing.status = 'skipped';
      }

      existing.agentId = event.agentId;
      stageStatuses.set(stage, existing);

      if (options.verbose) {
        const label = STAGE_LABELS[stage] || stage;
        const icon = existing.status === 'running' ? '⟳' : existing.status === 'completed' ? '✓' : '✗';
        const ts = new Date(event.timestamp).toLocaleTimeString();
        console.log(`  [${ts}] ${icon} ${label}: ${event.type}${existing.error ? ` — ${existing.error}` : ''}`);
      }
    }

    if (event.type === 'pipeline:completed') {
      if (options.verbose) {
        const ts = new Date(event.timestamp).toLocaleTimeString();
        console.log(`  [${ts}] ✓ Pipeline completed`);
      }
    }

    if (event.type === 'pipeline:failed') {
      if (options.verbose) {
        const ts = new Date(event.timestamp).toLocaleTimeString();
        console.log(`  [${ts}] ✗ Pipeline failed: ${event.error || ''}`);
      }
    }
  });

  // Run the pipeline
  const startTime = Date.now();

  try {
    const { state, results } = await orchestrator.orchestrate({
      goal,
      runTool: toolExec,
    });

    const totalDurationMs = Date.now() - startTime;

    // Build pipeline display
    const pipelineDisplay: PipelineDisplay = {
      pipelineName: pipeline.name,
      goal,
      status: state.status,
      stages: results.map((r) => ({
        stage: r.stage,
        status: (r.success ? 'completed' : 'failed') as PipelineStageDisplay['status'],
        durationMs: r.durationMs,
        error: r.error,
      })),
      currentStage: state.currentStage,
      totalDurationMs,
      error: state.error,
    };

    // Render pipeline display
    console.log('');
    const pipelineLines = renderPipeline(pipelineDisplay);
    for (const line of pipelineLines) {
      console.log(`  ${line}`);
    }
    console.log('');

    // Stage results
    console.log(colorText('  Stage Results:', 'dim'));
    for (const result of results) {
      const label = STAGE_LABELS[result.stage] || result.stage;
      const icon = result.success ? colorText('✓', 'success') : colorText('✗', 'error');
      const duration = result.durationMs > 0
        ? result.durationMs < 1000
          ? `${result.durationMs}ms`
          : `${(result.durationMs / 1000).toFixed(1)}s`
        : '';
      const error = result.error ? ` — ${colorText(result.error.slice(0, 100), 'error')}` : '';
      console.log(`    ${icon} ${label}${duration ? ` ${colorText(`(${duration})`, 'dim')}` : ''}${error}`);
    }
    console.log('');

    // Summary
    const completedCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    console.log(colorText('─'.repeat(48), 'dim'));
    console.log(pipelineSummary(pipelineDisplay).map((l) => `  ${l}`).join('\n'));
    console.log('');

    if (options.verbose) {
      // Show recent events
      const events = orchestrator.getObservability().getRecentEvents(10);
      if (events.length > 0) {
        console.log(colorText('  Recent Events:', 'dim'));
        for (const event of events) {
          const ts = new Date(event.timestamp).toLocaleTimeString();
          console.log(colorText(`    [${ts}] ${event.message.slice(0, 80)}`, 'muted'));
        }
        console.log('');
      }
    }

    process.exit(state.status === 'completed' ? 0 : 1);
  } catch (error) {
    console.error(`\n  ${colorText('✗', 'error')} Pipeline execution error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
