/**
 * SessionPanel — Session information display for long-running workflows.
 *
 * Renders:
 *   - Session name and ID
 *   - Session duration
 *   - Tasks completed / total
 *   - Files modified
 *   - Current objective
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';

// --- Types ---

export interface SessionDisplay {
  name: string;
  id: string;
  startedAt: number;
  durationMs: number;
  tasksCompleted: number;
  tasksTotal: number;
  filesModified: number;
  currentObjective?: string;
  provider?: string;
  model?: string;
  status: 'active' | 'paused' | 'completed' | 'idle';
}

// --- Helpers ---

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  return `${minutes}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function statusIndicator(status: SessionDisplay['status']): string {
  switch (status) {
    case 'active':
      return `${theme.colors.success}●${theme.colors.text}`;
    case 'paused':
      return `${theme.colors.warning}○${theme.colors.text}`;
    case 'completed':
      return `${theme.colors.success}✓${theme.colors.text}`;
    case 'idle':
    default:
      return `${theme.colors.textMuted}○${theme.colors.text}`;
  }
}

function statusLabel(status: SessionDisplay['status']): string {
  const color =
    status === 'active'
      ? theme.colors.success
      : status === 'paused'
        ? theme.colors.warning
        : status === 'completed'
          ? theme.colors.success
          : theme.colors.textMuted;
  return `${color}${status}${theme.colors.text}`;
}

function taskProgressBar(completed: number, total: number, width = 12): string {
  if (total === 0) return theme.colors.textDim + '░'.repeat(width) + theme.colors.text;
  const fraction = Math.min(completed / total, 1);
  const filled = Math.round(fraction * width);
  const empty = width - filled;
  const color =
    fraction >= 1
      ? theme.colors.success
      : fraction > 0.5
        ? theme.colors.primary
        : theme.colors.textDim;
  return `${color}${'█'.repeat(filled)}${theme.colors.textDim}${'░'.repeat(empty)}${theme.colors.text}`;
}

// --- Render Functions ---

/**
 * Render the full session panel.
 */
export function renderSessionPanel(display: SessionDisplay): string[] {
  const lines: string[] = [];

  // Header
  lines.push(
    `  ${statusIndicator(display.status)} \x1b[1mSession: ${display.name}\x1b[0m${theme.colors.text} ${statusLabel(display.status)}`,
  );

  // ID row
  const shortId = display.id.length > 16 ? `${display.id.slice(0, 16)}…` : display.id;
  lines.push(
    `    ${theme.colors.textDim}ID:${theme.colors.text} ${shortId}  ${theme.colors.textDim}Started:${theme.colors.text} ${new Date(display.startedAt).toLocaleTimeString()}  ${theme.colors.textDim}Duration:${theme.colors.text} ${theme.colors.primary}${formatDuration(display.durationMs)}${theme.colors.text}`,
  );

  // Tasks row
  lines.push(
    `    ${theme.colors.textDim}Tasks:${theme.colors.text} ${taskProgressBar(display.tasksCompleted, display.tasksTotal)} ${display.tasksCompleted}/${display.tasksTotal}  ${theme.colors.textDim}Files Modified:${theme.colors.text} ${display.filesModified}`,
  );

  // Provider / Model row
  if (display.provider || display.model) {
    const provider = display.provider
      ? `${theme.colors.textDim}Provider:${theme.colors.text} ${display.provider}`
      : '';
    const model = display.model
      ? `${theme.colors.textDim}Model:${theme.colors.text} ${display.model}`
      : '';
    const sep = provider && model ? '  ' : '';
    lines.push(`    ${provider}${sep}${model}`);
  }

  // Current objective
  if (display.currentObjective) {
    lines.push(
      `    ${theme.colors.textDim}Objective:${theme.colors.text} ${display.currentObjective.slice(0, 100)}`,
    );
  }

  return lines;
}

/**
 * Render a compact one-line session status.
 */
export function compactSessionLine(display: SessionDisplay): string {
  const duration = formatDuration(display.durationMs);
  const taskStr = `${display.tasksCompleted}/${display.tasksTotal} tasks`;

  return `  ${statusIndicator(display.status)} \x1b[1m${display.name}\x1b[0m${theme.colors.text} ${theme.colors.textDim}— ${duration}, ${taskStr}, ${display.filesModified} files${theme.colors.text}`;
}

/**
 * Render a session summary block for completed sessions.
 */
export function sessionSummary(display: SessionDisplay): string[] {
  const lines: string[] = [];

  const icon = display.status === 'completed' ? '✓' : display.status === 'active' ? '●' : '○';
  const color =
    display.status === 'completed'
      ? theme.colors.success
      : display.status === 'active'
        ? theme.colors.success
        : theme.colors.textMuted;

  lines.push(
    `  ${color}${icon} \x1b[1mSession Complete: ${display.name}\x1b[0m${theme.colors.text}`,
  );
  lines.push(
    `    ${theme.colors.textDim}Duration:${theme.colors.text} ${formatDuration(display.durationMs)}`,
  );
  lines.push(
    `    ${theme.colors.textDim}Tasks:${theme.colors.text} ${display.tasksCompleted} completed, ${display.filesModified} files modified`,
  );

  return lines;
}
