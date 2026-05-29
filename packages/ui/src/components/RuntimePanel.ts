/**
 * RuntimePanel — Real-time runtime status display.
 *
 * Renders:
 *   - Active provider and model
 *   - Session state
 *   - Workspace info
 *   - Memory usage
 *   - Queue status
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';

// --- Types ---

export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

export interface RuntimeProvider {
  name: string;
  status: ProviderStatus;
  latencyMs?: number;
  modelCount?: number;
}

export interface RuntimeSession {
  name?: string;
  id?: string;
  active: boolean;
  durationMs?: number;
  tasksCompleted?: number;
  filesModified?: number;
}

export interface RuntimeWorkspace {
  path?: string;
  initialized: boolean;
  framework?: string;
}

export interface RuntimeMemory {
  usedMb: number;
  totalMb: number;
  growthMbPerHour?: number;
}

export interface RuntimeQueue {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface RuntimeDisplay {
  provider?: RuntimeProvider;
  model?: string;
  session: RuntimeSession;
  workspace: RuntimeWorkspace;
  memory: RuntimeMemory;
  queue: RuntimeQueue;
}

// --- Helpers ---

function providerIcon(status: ProviderStatus): string {
  switch (status) {
    case 'connected':
      return `${theme.colors.success}●${theme.colors.text}`;
    case 'disconnected':
      return `${theme.colors.textMuted}○${theme.colors.text}`;
    case 'error':
      return `${theme.colors.error}✗${theme.colors.text}`;
    default:
      return `${theme.colors.textDim}?${theme.colors.text}`;
  }
}

function memoryBar(usedMb: number, totalMb: number, width = 8): string {
  const percent = totalMb > 0 ? Math.min(usedMb / totalMb, 1) : 0;
  const filled = Math.round(percent * width);
  const empty = width - filled;
  const color =
    percent > 0.8
      ? theme.colors.error
      : percent > 0.6
        ? theme.colors.warning
        : theme.colors.primary;
  return `${color}█${'█'.repeat(Math.max(0, filled - 1))}${theme.colors.textDim}${'░'.repeat(empty)}${theme.colors.text}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function statusBadge(status: ProviderStatus): string {
  const color =
    status === 'connected'
      ? theme.colors.success
      : status === 'disconnected'
        ? theme.colors.textMuted
        : status === 'error'
          ? theme.colors.error
          : theme.colors.textDim;
  return `${color}${status}${theme.colors.text}`;
}

// --- Main Render Function ---

/**
 * Render the full runtime status panel.
 */
export function renderRuntimePanel(display: RuntimeDisplay): string[] {
  const lines: string[] = [];

  lines.push(
    `  ${theme.colors.info}●${theme.colors.text} \x1b[1mRuntime Status\x1b[0m${theme.colors.text}`,
  );

  // Provider row
  if (display.provider) {
    const p = display.provider;
    const latency = p.latencyMs
      ? ` ${theme.colors.textDim}${p.latencyMs}ms${theme.colors.text}`
      : '';
    const models = p.modelCount
      ? ` ${theme.colors.textDim}${p.modelCount} models${theme.colors.text}`
      : '';
    lines.push(
      `    ${theme.colors.textDim}Provider:${theme.colors.text} ${providerIcon(p.status)} ${p.name} ${latency}${models} ${statusBadge(p.status)}`,
    );
  } else {
    lines.push(
      `    ${theme.colors.textDim}Provider:${theme.colors.text} ${theme.colors.textMuted}Not configured${theme.colors.text}`,
    );
  }

  // Model row
  if (display.model) {
    lines.push(`    ${theme.colors.textDim}Model:${theme.colors.text} ${display.model}`);
  } else if (display.provider) {
    lines.push(
      `    ${theme.colors.textDim}Model:${theme.colors.text} ${theme.colors.textMuted}auto${theme.colors.text}`,
    );
  }

  // Session row
  if (display.session.active) {
    const name = display.session.name
      ? `${display.session.name}`
      : display.session.id
        ? `${display.session.id.slice(0, 12)}`
        : 'active';
    const duration = display.session.durationMs
      ? ` ${theme.colors.textDim}(${formatDuration(display.session.durationMs)})${theme.colors.text}`
      : '';
    const tasks = display.session.tasksCompleted
      ? ` ${theme.colors.textDim}${display.session.tasksCompleted} tasks${theme.colors.text}`
      : '';
    lines.push(
      `    ${theme.colors.textDim}Session:${theme.colors.text} ${theme.colors.success}●${theme.colors.text} ${name}${duration}${tasks}`,
    );
  } else {
    lines.push(
      `    ${theme.colors.textDim}Session:${theme.colors.text} ${theme.colors.textMuted}○ inactive${theme.colors.text}`,
    );
  }

  // Workspace row
  if (display.workspace.initialized) {
    const path = display.workspace.path
      ? ` ${theme.colors.textDim}${display.workspace.path}${theme.colors.text}`
      : '';
    const framework = display.workspace.framework
      ? ` ${theme.colors.textDim}| ${display.workspace.framework}${theme.colors.text}`
      : '';
    lines.push(
      `    ${theme.colors.textDim}Workspace:${theme.colors.text} ${theme.colors.success}✓${theme.colors.text}${path}${framework}`,
    );
  } else {
    lines.push(
      `    ${theme.colors.textDim}Workspace:${theme.colors.text} ${theme.colors.textMuted}Not initialized${theme.colors.text}`,
    );
  }

  // Memory row
  const memPercent =
    display.memory.totalMb > 0
      ? Math.round((display.memory.usedMb / display.memory.totalMb) * 100)
      : 0;
  const memColor =
    memPercent > 80
      ? theme.colors.error
      : memPercent > 60
        ? theme.colors.warning
        : theme.colors.primary;
  const growth =
    display.memory.growthMbPerHour && display.memory.growthMbPerHour > 1
      ? ` ${theme.colors.warning}(${display.memory.growthMbPerHour.toFixed(1)} MB/h)${theme.colors.text}`
      : '';
  lines.push(
    `    ${theme.colors.textDim}Memory:${theme.colors.text} ${memoryBar(display.memory.usedMb, display.memory.totalMb)} ${memColor}${display.memory.usedMb}/${display.memory.totalMb}MB (${memPercent}%)${theme.colors.text}${growth}`,
  );

  // Queue row
  const q = display.queue;
  const queueParts: string[] = [];
  if (q.running > 0)
    queueParts.push(`${theme.colors.warning}${q.running} running${theme.colors.text}`);
  if (q.pending > 0)
    queueParts.push(`${theme.colors.textDim}${q.pending} pending${theme.colors.text}`);
  if (q.completed > 0)
    queueParts.push(`${theme.colors.success}${q.completed} completed${theme.colors.text}`);
  if (q.failed > 0) queueParts.push(`${theme.colors.error}${q.failed} failed${theme.colors.text}`);

  if (queueParts.length > 0) {
    lines.push(`    ${theme.colors.textDim}Queue:${theme.colors.text} ${queueParts.join('  ')}`);
  } else {
    lines.push(
      `    ${theme.colors.textDim}Queue:${theme.colors.text} ${theme.colors.textMuted}idle${theme.colors.text}`,
    );
  }

  return lines;
}

/**
 * Render a compact one-line runtime status.
 */
export function compactRuntimeLine(display: RuntimeDisplay): string {
  const parts: string[] = [];

  if (display.provider) {
    const p = display.provider;
    parts.push(`${providerIcon(p.status)} ${p.name}`);
  }

  if (display.model) {
    parts.push(`${theme.colors.textDim}${display.model}${theme.colors.text}`);
  }

  if (display.session.active) {
    parts.push(`${theme.colors.success}●${theme.colors.text}`);
  }

  const memPercent =
    display.memory.totalMb > 0
      ? Math.round((display.memory.usedMb / display.memory.totalMb) * 100)
      : 0;
  const memColor =
    memPercent > 80
      ? theme.colors.error
      : memPercent > 60
        ? theme.colors.warning
        : theme.colors.textDim;
  parts.push(`${memColor}${memPercent}% mem${theme.colors.text}`);

  return `  ${parts.join('  ')}`;
}
