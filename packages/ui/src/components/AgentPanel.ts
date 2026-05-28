/**
 * AgentPanel — Terminal UI component for agent execution display.
 *
 * Renders:
 *   - Active agent info (id, skill, goal)
 *   - Execution progress with step list
 *   - Tool usage indicators
 *   - Model/provider visibility
 *   - Status badges (running/completed/failed/cancelled)
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentPanelOptions {
  maxDisplayedSteps?: number;
}

/** A single step in the agent display */
export interface AgentStepDisplay {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  toolName?: string;
  durationMs?: number;
}

/** Full agent display state */
export interface AgentDisplay {
  agentId: string;
  skillName: string;
  goal: string;
  status: AgentStatus;
  currentTask?: string;
  currentTool?: string;
  model?: string;
  provider?: string;
  steps: AgentStepDisplay[];
  depth: number;
  maxDepth: number;
  durationMs?: number;
  error?: string;
}

/** Format a duration in ms to human-readable string */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Status icon map */
const STATUS_ICONS: Record<AgentStatus, string> = {
  idle: theme.icon.dot,
  running: theme.icon.arrow,
  completed: theme.icon.check,
  failed: theme.icon.cross,
  cancelled: theme.icon.dot,
};

const STEP_ICONS: Record<string, string> = {
  pending: theme.icon.dot,
  running: theme.icon.arrow,
  success: theme.icon.check,
  failed: theme.icon.cross,
  skipped: theme.icon.ellipsis,
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: theme.colors.textMuted,
  running: theme.colors.primary,
  completed: theme.colors.success,
  failed: theme.colors.error,
  cancelled: theme.colors.warning,
};

/**
 * Render a header line for the agent panel.
 */
export function agentHeader(display: AgentDisplay): string {
  const icon = STATUS_ICONS[display.status];
  const color = STATUS_COLORS[display.status];

  return `${icon} ${color}${display.skillName}${theme.colors.textDim} (${display.agentId})${theme.colors.text}
  ${theme.colors.textDim}Goal:${theme.colors.text} ${display.goal.slice(0, 80)}`;
}

/**
 * Render a single line showing current agent execution info.
 */
export function agentStatusLine(display: AgentDisplay): string {
  const icon = STATUS_ICONS[display.status];
  const color = STATUS_COLORS[display.status];
  const duration = display.durationMs ? formatDuration(display.durationMs) : '';

  let line = `${icon} ${color}${display.skillName}${theme.colors.textDim}`;

  if (display.currentTask) {
    line += ` ❯ ${theme.colors.text}${display.currentTask}`;
  }

  if (display.currentTool) {
    line += ` ${theme.colors.textDim}(${theme.colors.info}${display.currentTool}${theme.colors.textDim})`;
  }

  if (display.model) {
    line += ` ${theme.colors.textDim}via${theme.colors.text} ${display.model}`;
  }

  if (duration) {
    line += ` ${theme.colors.textDim}${duration}${theme.colors.text}`;
  }

  // Depth indicator
  if (display.depth > 0) {
    line += ` ${theme.colors.textDim}[depth ${display.depth}/${display.maxDepth}]${theme.colors.text}`;
  }

  return line;
}

/**
 * Render the full agent panel as a list of strings.
 */
export function renderAgentPanel(display: AgentDisplay, options: AgentPanelOptions = {}): string[] {
  const maxSteps = options.maxDisplayedSteps ?? 10;
  const lines: string[] = [];

  // Header
  lines.push(agentHeader(display));

  // Error if failed
  if (display.status === 'failed' && display.error) {
    lines.push(`  ${theme.colors.error}${theme.icon.cross} ${display.error.slice(0, 120)}${theme.colors.text}`);
  }

  // Step list (last N steps)
  const stepsToShow = display.steps.slice(-maxSteps);
  if (stepsToShow.length > 0) {
    lines.push(`  ${theme.colors.textDim}Steps:${theme.colors.text}`);
    for (const step of stepsToShow) {
      const stepIcon = STEP_ICONS[step.status] || theme.icon.dot;
      const stepColor = step.status === 'success' ? theme.colors.success
        : step.status === 'failed' ? theme.colors.error
        : step.status === 'running' ? theme.colors.primary
        : theme.colors.textMuted;
      const duration = step.durationMs ? ` ${theme.colors.textDim}${formatDuration(step.durationMs)}` : '';
      const tool = step.toolName ? ` ${theme.colors.textDim}(${theme.colors.info}${step.toolName}${theme.colors.textDim})` : '';
      lines.push(`    ${stepIcon} ${stepColor}${step.description}${tool}${duration}${theme.colors.text}`);
    }
  }

  // Provider/Model info line
  const infoParts: string[] = [];
  if (display.provider) infoParts.push(`provider: ${display.provider}`);
  if (display.model) infoParts.push(`model: ${display.model}`);
  if (infoParts.length > 0) {
    lines.push(`  ${theme.colors.textDim}${infoParts.join(' | ')}${theme.colors.text}`);
  }

  return lines;
}

/**
 * Render a compact one-line agent status (for use in multi-agent displays).
 */
export function compactAgentLine(display: AgentDisplay): string {
  const icon = STATUS_ICONS[display.status];
  const color = STATUS_COLORS[display.status];
  const stepCount = display.steps.filter((s) => s.status === 'success').length;
  const totalSteps = display.steps.length;
  const duration = display.durationMs ? formatDuration(display.durationMs) : '';

  return `${icon} ${color}${display.skillName.padEnd(20)}${theme.colors.textDim} ${display.status.padEnd(10)} ${stepCount}/${totalSteps} steps${duration ? ` ${duration}` : ''}${theme.colors.text}`;
}

/**
 * Render an execution summary block for a completed/failed agent.
 */
export function agentSummary(display: AgentDisplay): string[] {
  const lines: string[] = [];

  const statusIcon = display.status === 'completed' ? theme.icon.check : theme.icon.cross;
  const statusColor = display.status === 'completed' ? theme.colors.success : theme.colors.error;
  const duration = display.durationMs ? formatDuration(display.durationMs) : '';

  lines.push(`${statusIcon} ${statusColor}${display.skillName}${theme.colors.textDim} — ${display.status}${theme.colors.text}`);
  if (duration) lines.push(`  ${theme.colors.textDim}Duration:${theme.colors.text} ${duration}`);
  if (display.error) lines.push(`  ${theme.colors.error}Error:${theme.colors.text} ${display.error.slice(0, 120)}`);

  const successSteps = display.steps.filter((s) => s.status === 'success').length;
  const failedSteps = display.steps.filter((s) => s.status === 'failed').length;
  lines.push(`  ${theme.colors.textDim}Steps:${theme.colors.text} ${successSteps} succeeded, ${failedSteps} failed${display.steps.length > 0 ? `, ${display.steps.length} total` : ''}`);

  return lines;
}
