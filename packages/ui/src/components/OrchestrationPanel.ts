/**
 * OrchestrationPanel — Terminal UI component for pipeline execution display.
 *
 * Renders:
 *   - Pipeline stage progress (Research → Planning → Architecture → etc.)
 *   - Active agent panels per stage
 *   - Execution graph status with transition tracking
 *   - Verification/repair indicators
 *   - Contract status visibility
 *   - Runtime progress tracking
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 * Follows the same pattern as AgentPanel.ts and TodoList.ts.
 */

import { theme } from '../theme.js';

export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineStageDisplay {
  stage: string;
  status: PipelineStageStatus;
  durationMs?: number;
  error?: string;
  agentId?: string;
}

export interface PipelineDisplay {
  pipelineName: string;
  goal: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  stages: PipelineStageDisplay[];
  currentStage: string;
  totalDurationMs?: number;
  error?: string;
}

export interface ContractDisplay {
  id: string;
  source: string;
  target: string;
  type: string;
  status: 'pending' | 'fulfilled' | 'rejected';
}

/** Format a duration in ms to human-readable string */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Stage display icons based on status */
const STAGE_ICONS: Record<PipelineStageStatus, string> = {
  pending: theme.icon.dot,
  running: theme.icon.arrow,
  completed: theme.icon.check,
  failed: theme.icon.cross,
  skipped: theme.icon.ellipsis,
};

/** Stage display colors based on status */
const STAGE_COLORS: Record<PipelineStageStatus, string> = {
  pending: theme.colors.textMuted,
  running: theme.colors.primary,
  completed: theme.colors.success,
  failed: theme.colors.error,
  skipped: theme.colors.warning,
};

/** Status indicator for pipeline state */
const STATUS_INDICATORS: Record<string, string> = {
  idle: `${theme.icon.dot} ${theme.colors.textMuted}`,
  running: `${theme.icon.arrow} ${theme.colors.primary}`,
  paused: `${theme.icon.dot} ${theme.colors.warning}`,
  completed: `${theme.icon.check} ${theme.colors.success}`,
  failed: `${theme.icon.cross} ${theme.colors.error}`,
  cancelled: `${theme.icon.dot} ${theme.colors.warning}`,
};

/** Stage labels (human readable) */
const STAGE_LABELS: Record<string, string> = {
  research: 'Research',
  planning: 'Planning',
  architecture: 'Architecture',
  engineering: 'Engineering',
  verification: 'Verification',
  repair: 'Repair',
  final_review: 'Final Review',
  completed: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/**
 * Render the pipeline header with name, goal, and overall status.
 */
export function pipelineHeader(display: PipelineDisplay): string {
  const statusColor =
    STATUS_INDICATORS[display.status] || `${theme.icon.dot} ${theme.colors.textMuted}`;
  const duration = display.totalDurationMs
    ? ` ${theme.colors.textDim}${formatDuration(display.totalDurationMs)}`
    : '';

  return `${statusColor}${display.pipelineName}${theme.colors.text} ${theme.colors.textDim}— ${display.status}${duration}${theme.colors.text}\n  ${theme.colors.textDim}Goal:${theme.colors.text} ${display.goal.slice(0, 80)}`;
}

/**
 * Render a single pipeline stage line.
 */
export function stageLine(stage: PipelineStageDisplay, isCurrent: boolean): string {
  const icon = STAGE_ICONS[stage.status];
  const color = STAGE_COLORS[stage.status];
  const label = STAGE_LABELS[stage.stage] || stage.stage;
  const indicator = isCurrent && stage.status === 'running' ? ` ${theme.icon.arrow}` : '';
  const duration = stage.durationMs
    ? ` ${theme.colors.textDim}(${formatDuration(stage.durationMs)})${theme.colors.text}`
    : '';
  const error = stage.error
    ? ` ${theme.colors.error}${stage.error.slice(0, 60)}${theme.colors.text}`
    : '';
  const agent = stage.agentId
    ? ` ${theme.colors.textDim}via ${stage.agentId}${theme.colors.text}`
    : '';

  return `  ${icon} ${color}${label}${indicator}${agent}${duration}${error}`;
}

/**
 * Render the full pipeline display with all stages.
 */
export function renderPipeline(display: PipelineDisplay): string[] {
  const lines: string[] = [];

  // Header
  lines.push(pipelineHeader(display));

  // Stage list
  if (display.stages.length > 0) {
    lines.push(`  ${theme.colors.textDim}Stages:${theme.colors.text}`);
    for (const stage of display.stages) {
      const isCurrent = stage.stage === display.currentStage;
      lines.push(stageLine(stage, isCurrent));
    }
  }

  // Divider between stages
  lines.push(`  ${theme.colors.textDim}${theme.icon.divider.repeat(40)}${theme.colors.text}`);

  return lines;
}

/**
 * Render a compact one-line pipeline status (for summary views).
 */
export function compactPipelineLine(display: PipelineDisplay): string {
  const statusColor =
    STATUS_INDICATORS[display.status] || `${theme.icon.dot} ${theme.colors.textMuted}`;
  const completedCount = display.stages.filter((s) => s.status === 'completed').length;
  const failedCount = display.stages.filter((s) => s.status === 'failed').length;
  const totalCount = display.stages.length;
  const duration = display.totalDurationMs ? formatDuration(display.totalDurationMs) : '';

  return `${statusColor}${display.pipelineName.padEnd(24)} ${completedCount}/${totalCount} stages${failedCount > 0 ? `, ${failedCount} failed` : ''}${duration ? ` ${duration}` : ''}${theme.colors.text}`;
}

/**
 * Render the execution graph transitions (for verbose mode).
 */
export function renderTransitions(
  transitions: Array<{ from: string; to: string; reason: string; timestamp: number }>,
): string[] {
  const lines: string[] = [];

  lines.push(`  ${theme.colors.textDim}Transitions:${theme.colors.text}`);
  for (const t of transitions.slice(-10)) {
    const fromLabel = STAGE_LABELS[t.from] || t.from;
    const toLabel = STAGE_LABELS[t.to] || t.to;
    lines.push(
      `    ${theme.icon.arrow} ${fromLabel} → ${toLabel}${t.reason !== 'advance' ? ` (${t.reason})` : ''}${theme.colors.text}`,
    );
  }

  return lines;
}

/**
 * Render an execution summary block for a completed/failed pipeline.
 */
export function pipelineSummary(display: PipelineDisplay): string[] {
  const lines: string[] = [];

  const statusIcon = display.status === 'completed' ? theme.icon.check : theme.icon.cross;
  const statusColor = display.status === 'completed' ? theme.colors.success : theme.colors.error;
  const duration = display.totalDurationMs ? formatDuration(display.totalDurationMs) : '';

  lines.push(
    `${statusIcon} ${statusColor}${display.pipelineName}${theme.colors.textDim} — ${display.status}${theme.colors.text}`,
  );

  if (duration) {
    lines.push(`  ${theme.colors.textDim}Duration:${theme.colors.text} ${duration}`);
  }

  if (display.error) {
    lines.push(`  ${theme.colors.error}Error:${theme.colors.text} ${display.error.slice(0, 120)}`);
  }

  const completedStages = display.stages.filter((s) => s.status === 'completed').length;
  const failedStages = display.stages.filter((s) => s.status === 'failed').length;
  lines.push(
    `  ${theme.colors.textDim}Stages:${theme.colors.text} ${completedStages} completed, ${failedStages} failed, ${display.stages.length} total`,
  );

  return lines;
}
