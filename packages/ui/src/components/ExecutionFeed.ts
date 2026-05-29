/**
 * ExecutionFeed — Filtered live event stream for workflow transparency.
 *
 * Shows meaningful execution events without log spam:
 *   - Workflow transitions
 *   - Provider changes
 *   - Task completions
 *   - Recovery events
 *   - Phase changes
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';

// --- Types ---

export type EventLevel = 'info' | 'success' | 'warning' | 'error' | 'debug' | 'phase';

export interface ExecutionEvent {
  id: string;
  timestamp: number;
  level: EventLevel;
  message: string;
  detail?: string;
  phase?: string;
}

export interface ExecutionFeedOptions {
  maxEvents?: number;
  showTimestamps?: boolean;
  showPhaseHeaders?: boolean;
  filterLevel?: EventLevel;
}

// --- Helpers ---

const EVENT_ICONS: Record<EventLevel, string> = {
  info: theme.icon.dot,
  success: theme.icon.check,
  warning: theme.icon.warning,
  error: theme.icon.cross,
  debug: '·',
  phase: theme.icon.arrow,
};

const EVENT_COLORS: Record<EventLevel, string> = {
  info: theme.colors.text,
  success: theme.colors.success,
  warning: theme.colors.warning,
  error: theme.colors.error,
  debug: theme.colors.textMuted,
  phase: theme.colors.primary,
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// --- Render Functions ---

/**
 * Render a single event line.
 */
export function eventLine(event: ExecutionEvent, showTimestamp = false): string {
  const icon = EVENT_ICONS[event.level];
  const color = EVENT_COLORS[event.level];

  let line = `  ${color}${icon}${theme.colors.text}`;

  if (showTimestamp) {
    line += ` ${theme.colors.textDim}[${formatTime(event.timestamp)}]${theme.colors.text}`;
  }

  if (event.phase) {
    line += ` ${theme.colors.primaryDim}${event.phase}:${theme.colors.text}`;
  }

  line += ` ${event.level === 'phase' ? '\x1b[1m' : ''}${event.message}\x1b[0m${theme.colors.text}`;

  if (event.detail) {
    line += ` ${theme.colors.textDim}— ${event.detail}${theme.colors.text}`;
  }

  return line;
}

/**
 * Render the execution feed panel with filtered events.
 */
export function renderExecutionFeed(
  events: ExecutionEvent[],
  options: ExecutionFeedOptions = {},
): string[] {
  const { maxEvents = 20, showTimestamps = true, showPhaseHeaders = true } = options;

  const lines: string[] = [];

  lines.push(
    `  ${theme.colors.info}${theme.icon.arrow} \x1b[1mExecution Feed\x1b[0m${theme.colors.text}`,
  );

  // Filter and limit events
  const displayEvents = events.slice(-maxEvents);

  if (displayEvents.length === 0) {
    lines.push(`    ${theme.colors.textDim}No events recorded yet.${theme.colors.text}`);
    return lines;
  }

  // Group by phase if requested
  if (showPhaseHeaders) {
    let currentPhase: string | undefined;

    for (const event of displayEvents) {
      if (event.phase && event.phase !== currentPhase) {
        currentPhase = event.phase;
        lines.push(
          `    ${theme.colors.primaryDim}${theme.icon.arrow} ${currentPhase}${theme.colors.text}`,
        );
      }
      lines.push(`    ${eventLine(event, showTimestamps)}`);
    }
  } else {
    for (const event of displayEvents) {
      lines.push(`    ${eventLine(event, showTimestamps)}`);
    }
  }

  return lines;
}

/**
 * Render a compact event summary line.
 */
export function compactEventSummary(events: ExecutionEvent[], durationMs?: number): string {
  const successCount = events.filter((e) => e.level === 'success').length;
  const errorCount = events.filter((e) => e.level === 'error').length;
  const warningCount = events.filter((e) => e.level === 'warning').length;
  const phaseCount = events.filter((e) => e.level === 'phase').length;
  const duration = durationMs
    ? ` ${theme.colors.textDim}(${formatDuration(durationMs)})${theme.colors.text}`
    : '';

  let summary = `  ${theme.colors.textDim}Events:${theme.colors.text}`;

  if (phaseCount > 0) summary += ` ${theme.colors.primary}${phaseCount} phases${theme.colors.text}`;
  if (successCount > 0) summary += ` ${theme.colors.success}${successCount} ✓${theme.colors.text}`;
  if (warningCount > 0) summary += ` ${theme.colors.warning}${warningCount} ⚠${theme.colors.text}`;
  if (errorCount > 0) summary += ` ${theme.colors.error}${errorCount} ✗${theme.colors.text}`;

  return `${summary}${duration}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
