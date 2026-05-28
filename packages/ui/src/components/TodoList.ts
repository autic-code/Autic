/**
 * TodoList — Structured TODO execution display for autonomous workflows.
 *
 * Renders a dynamic step-by-step progress view in the terminal:
 *   [✓] Analyze repository
 *   [✓] Create auth routes
 *   [⟳] Running tests...
 *   [ ] Fix TypeScript errors
 *   [ ] Verify build
 *
 * Uses ANSI color codes for lightweight terminal rendering.
 * No heavy dependencies — just string formatting.
 */

import { theme } from '../theme.js';
import { colorText } from './Text.js';

export type TodoStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface TodoItem {
  id: string;
  description: string;
  status: TodoStatus;
  type?: string;
  durationMs?: number;
  error?: string;
}

export interface TodoListOptions {
  title?: string;
  completed?: number;
  total?: number;
  statusText?: string;
}

/**
 * Create a single TODO line with status indicator.
 */
export function todoLine(item: TodoItem, index: number): string {
  const prefix = `${String(index + 1).padStart(2, ' ')}.`;

  let icon: string;
  let colorVariant: 'success' | 'error' | 'primary' | 'muted' | 'warning';

  switch (item.status) {
    case 'success':
      icon = theme.icon.check;
      colorVariant = 'success';
      break;
    case 'failed':
      icon = theme.icon.cross;
      colorVariant = 'error';
      break;
    case 'running':
      icon = theme.icon.ellipsis;
      colorVariant = 'warning';
      break;
    case 'skipped':
      icon = theme.icon.dot;
      colorVariant = 'muted';
      break;
    case 'pending':
    default:
      icon = theme.icon.dot;
      colorVariant = 'muted';
      break;
  }

  const statusIcon = colorText(icon, colorVariant);
  const description = item.status === 'running'
    ? colorText(item.description, 'primary')
    : item.status === 'failed'
      ? colorText(item.description, 'error')
      : item.status === 'success'
        ? colorText(item.description, 'success')
        : item.description;

  const duration = item.durationMs
    ? colorText(formatShortDuration(item.durationMs), 'muted')
    : '';

  const typeTag = item.type && item.type !== 'tool_call'
    ? colorText(`[${item.type}]`, 'dim')
    : '';

  const errorHint = item.error
    ? colorText(` — ${item.error.slice(0, 40)}`, 'error')
    : '';

  return `  ${prefix} ${statusIcon} ${typeTag} ${description}${duration}${errorHint}`.trimEnd();
}

/**
 * Create a full TODO list board header.
 */
export function todoBoardHeader(options: TodoListOptions): string {
  const { title, completed = 0, total = 0, statusText } = options;

  const lines: string[] = [];

  // Header line
  const headerParts = [
    colorText('⟳', 'primary'),
    colorText(' Workflow ', 'bold'),
  ];

  if (title) {
    headerParts.push(colorText(title, 'dim'));
  }

  lines.push(headerParts.join(''));

  // Progress bar
  if (total > 0) {
    const progress = Math.round((completed / total) * 100);
    const barWidth = 20;
    const filled = Math.round((progress / 100) * barWidth);
    const empty = barWidth - filled;

    const bar = colorText('█'.repeat(filled), 'primary') +
      colorText('█'.repeat(empty), 'dim');

    const progressText = colorText(
      ` ${completed}/${total} (${progress}%)`,
      completed === total ? 'success' : 'dim',
    );

    lines.push(`  ${bar}${progressText}`);
  }

  if (statusText) {
    lines.push(colorText(`  ${statusText}`, 'dim'));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Create a full TODO list rendering with header and items.
 */
export function renderTodoList(
  items: TodoItem[],
  options: TodoListOptions = {},
): string {
  const parts: string[] = [];

  // Header
  const header = todoBoardHeader(options);
  if (header.trim()) {
    parts.push(header);
  }

  // Items
  for (let i = 0; i < items.length; i++) {
    parts.push(todoLine(items[i], i));
  }

  // Footer stats
  const successCount = items.filter((i) => i.status === 'success').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const runningCount = items.filter((i) => i.status === 'running').length;

  if (items.length > 0) {
    parts.push('');
    const stats = [];
    if (successCount > 0) stats.push(colorText(`${successCount} completed`, 'success'));
    if (failedCount > 0) stats.push(colorText(`${failedCount} failed`, 'error'));
    if (runningCount > 0) stats.push(colorText(`${runningCount} in progress`, 'warning'));
    if (stats.length > 0) {
      parts.push(`  ${stats.join('  ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Format a status update line for the current active step.
 */
export function statusLine(message: string, status: 'running' | 'success' | 'failed' = 'running'): string {
  const color = status === 'running' ? 'primary'
    : status === 'success' ? 'success'
    : 'error';
  const label = status === 'running' ? '→'
    : status === 'success' ? '✓'
    : '✗';
  return `  ${colorText(label, color)} ${message}`;
}

/**
 * Create an execution summary block.
 */
export function executionSummary(
  durationMs: number,
  successCount: number,
  failCount: number,
  retryCount: number,
): string {
  const total = successCount + failCount;

  const lines: string[] = [
    '',
    colorText('  ═══ Execution Summary ═══', 'bold'),
    `  Duration: ${colorText(formatShortDuration(durationMs), 'primary')}`,
    `  Steps:    ${colorText(String(total), total > 0 ? 'default' : 'muted')} total, ` +
      `${colorText(String(successCount), successCount > 0 ? 'success' : 'muted')} successful, ` +
      `${colorText(String(failCount), failCount > 0 ? 'error' : 'muted')} failed`,
  ];

  if (retryCount > 0) {
    lines.push(`  Retries:  ${colorText(String(retryCount), 'warning')}`);
  }

  lines.push('');
  return lines.join('\n');
}

function formatShortDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
