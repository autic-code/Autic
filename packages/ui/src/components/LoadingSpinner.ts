/**
 * LoadingSpinner — Animated loading indicators for CLI UI polish (#15)
 *
 * Provides:
 *   - Simple spinning animation (dots, line, arrows)
 *   - Progress bar animation
 *   - Status transitions (loading → success/failure)
 *   - Compact and full-width variants
 *
 * All output is plain text with ANSI color — lightweight, no dependencies.
 */

import { theme } from '../theme.js';

export type SpinnerStyle = 'dots' | 'line' | 'arrows' | 'bounce' | 'pulse';
export type SpinnerStatus = 'loading' | 'success' | 'error' | 'warning' | 'idle';

// Spinner frame sequences
const SPINNER_FRAMES: Record<SpinnerStyle, string[]> = {
  dots: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  line: ['|', '/', '-', '\\'],
  arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bounce: ['⢀', '⡀', '⠄', '⠂', '⠁', '⠂', '⠄', '⡀'],
  pulse: ['●', '◔', '◐', '◕', '○', '◕', '◐', '◔'],
};

const STATUS_COLORS: Record<SpinnerStatus, string> = {
  loading: theme.colors.primary,
  success: theme.colors.success,
  error: theme.colors.error,
  warning: theme.colors.warning,
  idle: theme.colors.textMuted,
};

/**
 * Get the current frame for a spinner animation.
 * Call with a frame counter that increments over time.
 */
export function getSpinnerFrame(
  frameIndex: number,
  style: SpinnerStyle = 'dots',
  status: SpinnerStatus = 'loading',
): string {
  const frames = SPINNER_FRAMES[style];
  const frame = frames[frameIndex % frames.length];
  const color = STATUS_COLORS[status];
  return `${color}${frame}`;
}

/**
 * Create a labeled spinner line.
 */
export function spinnerLine(
  label: string,
  frameIndex: number,
  status: SpinnerStatus = 'loading',
  style: SpinnerStyle = 'dots',
): string {
  const frame = getSpinnerFrame(frameIndex, style, status);
  const labelColor = status === 'loading' ? theme.colors.text
    : status === 'success' ? theme.colors.success
    : status === 'error' ? theme.colors.error
    : theme.colors.textDim;

  return `  ${frame} ${labelColor}${label}`;
}

/**
 * Create a final status line (after spinner completes).
 */
export function completionStatus(
  label: string,
  status: 'success' | 'error' | 'warning' | 'skipped' = 'success',
  detail?: string,
): string {
  const icon = status === 'success' ? '✓'
    : status === 'error' ? '✗'
    : status === 'warning' ? '⚠'
    : '○';

  const color = status === 'success' ? theme.colors.success
    : status === 'error' ? theme.colors.error
    : status === 'warning' ? theme.colors.warning
    : theme.colors.textMuted;

  const detailStr = detail ? ` ${theme.colors.textDim}— ${detail}` : '';

  return `  ${color}${icon} ${label}${detailStr}`;
}

/**
 * Create an animated progress bar.
 */
export function animatedProgressBar(
  current: number,
  total: number,
  width = 20,
  label?: string,
): string {
  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const percent = Math.round(progress * 100);
  const filled = Math.round(progress * width);
  const empty = width - filled;

  const color = percent >= 100 ? theme.colors.success
    : percent > 66 ? theme.colors.primary
    : percent > 33 ? theme.colors.info
    : theme.colors.textDim;

  const filledBar = color + '█'.repeat(filled);
  const emptyBar = theme.colors.textDim + '░'.repeat(empty);
  const percentStr = `${percent}%`.padStart(4);

  const labelStr = label ? ` ${label}:` : '';

  return ` ${labelStr} ${filledBar}${emptyBar} ${percentStr}`;
}

/**
 * Create a compact dot-progress indicator for multi-step operations.
 * Shows colored dots for each step.
 */
export function dotProgress(
  items: Array<{ status: SpinnerStatus; label?: string }>,
  maxLabels = 3,
): string {
  const dots = items.map((item) => {
    const color = STATUS_COLORS[item.status];
    return `${color}${theme.icon.bullet}`;
  });

  const dotStr = dots.join(' ');

  // Show first N labels
  const labels = items
    .filter((item) => item.label && item.status === 'loading')
    .slice(0, maxLabels)
    .map((item) => item.label);

  const labelStr = labels.length > 0 ? ` ${theme.colors.textDim}${labels.join(', ')}${theme.colors.text}` : '';

  return `  ${dotStr}${labelStr}`;
}

/**
 * Render a startup header with version info and status badge.
 */
export function startupHeader(
  name: string,
  version: string,
  status: 'ready' | 'loading' | 'error' = 'ready',
): string[] {
  const lines: string[] = [];

  const statusBadge = status === 'ready'
    ? ` ${theme.colors.success}● Ready${theme.colors.text}`
    : status === 'loading'
      ? ` ${theme.colors.warning}● Loading${theme.colors.text}`
      : ` ${theme.colors.error}● Error${theme.colors.text}`;

  // Top border
  lines.push(`  ${theme.colors.primary}${'═'.repeat(40)}${theme.colors.text}`);

  // Title
  lines.push(`  ${theme.colors.primary}${name}${theme.colors.text} ${theme.colors.textDim}v${version}${theme.colors.text}${statusBadge}`);

  // Bottom border
  lines.push(`  ${theme.colors.primary}${'═'.repeat(40)}${theme.colors.text}`);

  return lines;
}

/**
 * Render a startup flow sequence.
 */
export function startupFlow(
  steps: Array<{ label: string; status: SpinnerStatus; frameIndex?: number }>,
): string[] {
  const lines: string[] = [];

  lines.push(startupHeader('Autic', '0.1.0', 'loading').join('\n'));

  for (const step of steps) {
    if (step.status === 'loading') {
      lines.push(spinnerLine(step.label, step.frameIndex || 0, 'loading'));
    } else {
      lines.push(completionStatus(
        step.label,
        step.status as 'success' | 'error' | 'warning',
      ));
    }
  }

  return lines;
}

/**
 * Render provider status indicators in a compact row.
 */
export function providerStatusRow(
  providers: Array<{ name: string; status: 'connected' | 'disconnected' | 'error' | 'unknown'; latencyMs?: number; modelCount?: number }>,
): string[] {
  const lines: string[] = [];

  lines.push(`  ${theme.colors.textDim}Providers:${theme.colors.text}`);

  for (const provider of providers) {
    const icon = provider.status === 'connected' ? '●'
      : provider.status === 'disconnected' ? '○'
      : provider.status === 'error' ? '✗'
      : '?';

    const color = provider.status === 'connected' ? theme.colors.success
      : provider.status === 'disconnected' ? theme.colors.textMuted
      : provider.status === 'error' ? theme.colors.error
      : theme.colors.textDim;

    const latency = provider.latencyMs ? ` ${theme.colors.textDim}${provider.latencyMs}ms${theme.colors.text}` : '';
    const models = provider.modelCount ? ` ${theme.colors.textDim}${provider.modelCount} models${theme.colors.text}` : '';

    lines.push(`    ${color}${icon} ${provider.name}${latency}${models}`);
  }

  return lines;
}

/**
 * Render a compact queue status line.
 */
export function queueStatusLine(
  pending: number,
  running: number,
  completed: number,
  failed: number,
): string {
  const parts: string[] = [];

  if (running > 0) parts.push(`${theme.colors.warning}${running} running${theme.colors.text}`);
  if (pending > 0) parts.push(`${theme.colors.textDim}${pending} pending${theme.colors.text}`);
  if (completed > 0) parts.push(`${theme.colors.success}${completed} completed${theme.colors.text}`);
  if (failed > 0) parts.push(`${theme.colors.error}${failed} failed${theme.colors.text}`);

  return parts.length > 0 ? `  ${parts.join('  ')}` : `  ${theme.colors.textDim}Queue: idle${theme.colors.text}`;
}

/**
 * Render a memory usage indicator.
 */
export function memoryIndicator(
  usedMb: number,
  totalMb: number,
): string {
  const percent = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0;
  const color = percent > 80 ? theme.colors.error
    : percent > 60 ? theme.colors.warning
    : theme.colors.primary;
  const barLen = Math.round((percent / 100) * 10);
  const bar = color + '▇'.repeat(barLen) + theme.colors.textDim + '▇'.repeat(10 - barLen);

  return `  ${theme.colors.textDim}Memory:${theme.colors.text} ${bar} ${color}${usedMb}/${totalMb}MB (${percent}%)${theme.colors.text}`;
}
