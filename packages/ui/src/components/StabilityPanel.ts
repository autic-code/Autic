/**
 * StabilityPanel — Terminal UI component for runtime stability display.
 *
 * Renders:
 *   - Runtime health indicators (healthy/degraded/unhealthy)
 *   - Queue pressure indicators (low/medium/high/critical)
 *   - Memory usage indicators with growth trend
 *   - Provider stability indicators (healthy/degraded/unhealthy counts)
 *   - Worker activity indicators (active/idle/total)
 *   - Pipeline activity indicators
 *   - Loop protection status
 *   - Background task activity
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';

// --- Types ---

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type PressureLevel = 'low' | 'medium' | 'high' | 'critical';

export interface StabilityDisplay {
  runtime: {
    status: HealthStatus;
    uptime: string;
    memoryMB: number;
    memoryGrowthMBPerHour: number;
  };
  queue: {
    pressure: PressureLevel;
    pending: number;
    running: number;
    avgWaitMs: number;
    throughputPerMin: number;
  };
  workers: {
    active: number;
    idle: number;
    total: number;
  };
  providers: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    avgLatencyMs: number;
  };
  pipelines: {
    active: number;
    completed: number;
    failed: number;
  };
  loops: {
    detected: number;
    active: number;
  };
  background: {
    running: number;
    registered: number;
  };
}

// --- Helpers ---

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function healthIcon(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return `${theme.colors.success}${theme.icon.check}${theme.colors.text}`;
    case 'degraded': return `${theme.colors.warning}${theme.icon.warning}${theme.colors.text}`;
    case 'unhealthy': return `${theme.colors.error}${theme.icon.cross}${theme.colors.text}`;
  }
}

function pressureIcon(level: PressureLevel): string {
  switch (level) {
    case 'low': return `${theme.colors.success}●${theme.colors.text}`;
    case 'medium': return `${theme.colors.info}●${theme.colors.text}`;
    case 'high': return `${theme.colors.warning}●${theme.colors.text}`;
    case 'critical': return `${theme.colors.error}●${theme.colors.text}`;
  }
}

function pressureColor(level: PressureLevel): string {
  switch (level) {
    case 'low': return theme.colors.success;
    case 'medium': return theme.colors.info;
    case 'high': return theme.colors.warning;
    case 'critical': return theme.colors.error;
  }
}

function healthColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return theme.colors.success;
    case 'degraded': return theme.colors.warning;
    case 'unhealthy': return theme.colors.error;
  }
}

// --- Render Functions ---

/**
 * Render full stability dashboard as a list of strings.
 */
export function renderStabilityPanel(display: StabilityDisplay): string[] {
  const lines: string[] = [];

  // Header
  lines.push(`${healthIcon(display.runtime.status)} ${healthColor(display.runtime.status)}Runtime Health${theme.colors.text} ${theme.colors.textDim}— ${display.runtime.status}${theme.colors.text}`);

  // Runtime section
  lines.push(`  ${theme.colors.textDim}Uptime:${theme.colors.text} ${display.runtime.uptime}`);
  lines.push(`  ${theme.colors.textDim}Memory:${theme.colors.text} ${formatBytes(display.runtime.memoryMB * 1024 * 1024)} ${memoryGrowthIndicator(display.runtime.memoryGrowthMBPerHour)}`);

  // Queue section
  lines.push(`  ${theme.colors.textDim}Queue:${theme.colors.text} ${pressureIcon(display.queue.pressure)} ${pressureColor(display.queue.pressure)}${display.queue.pressure}${theme.colors.text} ${theme.colors.textDim}(${display.queue.pending} pending, ${display.queue.running} running, ${display.queue.avgWaitMs}ms avg wait)${theme.colors.text}`);

  // Workers section
  const workerUtil = display.workers.total > 0
    ? Math.round((display.workers.active / display.workers.total) * 100)
    : 0;
  lines.push(`  ${theme.colors.textDim}Workers:${theme.colors.text} ${display.workers.active}/${display.workers.total} active ${theme.colors.textDim}(${workerUtil}% util)${theme.colors.text}`);

  // Providers section
  const providerHealthStr = `${display.providers.healthy} healthy` +
    (display.providers.degraded > 0 ? `, ${theme.colors.warning}${display.providers.degraded} degraded${theme.colors.text}` : '') +
    (display.providers.unhealthy > 0 ? `, ${theme.colors.error}${display.providers.unhealthy} unhealthy${theme.colors.text}` : '');
  lines.push(`  ${theme.colors.textDim}Providers:${theme.colors.text} ${display.providers.total} total ${theme.colors.textDim}(${providerHealthStr})${display.providers.avgLatencyMs > 0 ? `, ${display.providers.avgLatencyMs}ms avg latency` : ''}${theme.colors.text}`);

  // Pipelines section
  if (display.pipelines.active > 0 || display.pipelines.completed > 0) {
    lines.push(`  ${theme.colors.textDim}Pipelines:${theme.colors.text} ${display.pipelines.active} active, ${display.pipelines.completed} completed${display.pipelines.failed > 0 ? `, ${theme.colors.error}${display.pipelines.failed} failed${theme.colors.text}` : ''}`);
  }

  // Loop protection section
  if (display.loops.detected > 0) {
    lines.push(`  ${theme.colors.textDim}Loop Protection:${theme.colors.text} ${theme.colors.warning}${display.loops.detected} loops detected${theme.colors.text}${theme.colors.text}${theme.colors.text}`);
  }

  // Background tasks section
  if (display.background.registered > 0) {
    lines.push(`  ${theme.colors.textDim}Background Tasks:${theme.colors.text} ${display.background.running} running, ${display.background.registered} registered`);
  }

  return lines;
}

/**
 * Render a compact one-line stability status.
 */
export function compactStabilityLine(display: StabilityDisplay): string {
  const icon = healthIcon(display.runtime.status);
  const color = healthColor(display.runtime.status);
  const memoryStr = formatBytes(display.runtime.memoryMB * 1024 * 1024);

  let line = `${icon} ${color}Runtime${theme.colors.text} ${memoryStr}`;

  if (display.queue.pressure !== 'low') {
    line += ` | Queue: ${pressureColor(display.queue.pressure)}${display.queue.pressure}${theme.colors.text}`;
  }

  if (display.providers.degraded > 0 || display.providers.unhealthy > 0) {
    line += ` | Providers: ${display.providers.healthy}/${display.providers.total}`;
  }

  return line;
}

/**
 * Render a queue pressure line.
 */
export function queuePressureLine(pressure: PressureLevel, pending: number, running: number): string {
  const icon = pressureIcon(pressure);
  const color = pressureColor(pressure);
  return `  Queue: ${icon} ${color}${pressure}${theme.colors.text} ${theme.colors.textDim}(${pending} pending, ${running} running)${theme.colors.text}`;
}

/**
 * Render a memory usage line.
 */
export function memoryLine(memoryMB: number, growthMBPerHour: number): string {
  const growthStr = growthMBPerHour > 0
    ? ` ${theme.colors.warning}(${growthMBPerHour.toFixed(1)} MB/h growth)${theme.colors.text}`
    : growthMBPerHour < -1
      ? ` ${theme.colors.success}(declining)${theme.colors.text}`
      : ` ${theme.colors.textDim}(stable)${theme.colors.text}`;

  return `  Memory: ${formatBytes(memoryMB * 1024 * 1024)}${growthStr}`;
}

/**
 * Render a provider health line.
 */
export function providerHealthLine(
  total: number,
  healthy: number,
  degraded: number,
  unhealthy: number,
): string {
  let result = `  Providers: ${healthy}/${total} healthy`;
  if (degraded > 0) result += `, ${theme.colors.warning}${degraded} degraded${theme.colors.text}`;
  if (unhealthy > 0) result += `, ${theme.colors.error}${unhealthy} unhealthy${theme.colors.text}`;
  return result;
}

/**
 * Render worker activity line.
 */
export function workerLine(active: number, idle: number, total: number): string {
  const util = total > 0 ? Math.round((active / total) * 100) : 0;
  return `  Workers: ${active} active, ${idle} idle ${theme.colors.textDim}(${util}% util)${theme.colors.text}`;
}

// --- Helper ---

function memoryGrowthIndicator(growthMBPerHour: number): string {
  if (growthMBPerHour > 5) {
    return `${theme.colors.warning}(high growth)${theme.colors.text}`;
  }
  if (growthMBPerHour > 1) {
    return `${theme.colors.info}(growing)${theme.colors.text}`;
  }
  if (growthMBPerHour < -1) {
    return `${theme.colors.success}(declining)${theme.colors.text}`;
  }
  return `${theme.colors.success}(stable)${theme.colors.text}`;
}
