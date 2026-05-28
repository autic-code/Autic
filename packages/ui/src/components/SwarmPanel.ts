/**
 * SwarmPanel — Terminal UI component for swarm orchestration display (#12)
 *
 * Renders:
 *   - Active agents and delegation status
 *   - Pipeline stage progress
 *   - Concurrency and load indicators
 *   - Delegation chains
 *   - Queue and provider pressure
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 * Follows the same pattern as StabilityPanel.ts and OrchestrationPanel.ts.
 */

import { theme } from '../theme.js';

export interface SwarmDisplay {
  swarmName: string;
  status: string;
  agents: number;
  activeDelegations: number;
  completedDelegations: number;
  failedDelegations: number;
  partitions: number;
  uptimeMs: number;
  loadMetrics: {
    cpuPressure: string;
    memoryPressure: string;
    providerPressure: string;
    queuePressure: string;
    recommendation: string;
    activeWorkers: number;
    idleWorkers: number;
  };
  protection: {
    throttlingActive: boolean;
    cpuPressure: string;
    memoryPressure: string;
  };
  pipelines?: Array<{
    name: string;
    stageCount: number;
    completedStages: number;
    status: string;
  }>;
  adaptationLevel?: string;
  cooldownActive?: boolean;
}

/** Format uptime */
function formatUptime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Status indicator color */
function statusColor(status: string): string {
  switch (status) {
    case 'running':
      return theme.colors.primary;
    case 'paused':
      return theme.colors.warning;
    case 'stopped':
    case 'error':
      return theme.colors.error;
    default:
      return theme.colors.textMuted;
  }
}

/** Pressure level color */
function pressureColor(level: string): string {
  switch (level) {
    case 'critical':
      return theme.colors.error;
    case 'high':
      return theme.colors.warning;
    case 'medium':
      return theme.colors.info;
    case 'low':
      return theme.colors.success;
    default:
      return theme.colors.textDim;
  }
}

/** Pressure indicator icon */
function pressureIcon(level: string): string {
  switch (level) {
    case 'critical':
      return theme.icon.cross;
    case 'high':
      return theme.icon.warning;
    case 'medium':
      return theme.icon.dot;
    case 'low':
      return theme.icon.check;
    default:
      return theme.icon.ellipsis;
  }
}

/**
 * Render the full swarm status panel.
 */
export function renderSwarmPanel(display: SwarmDisplay): string[] {
  const lines: string[] = [];
  const headerColor = statusColor(display.status);

  // Header
  lines.push(
    `${theme.icon.arrow} ${headerColor}${display.swarmName}${theme.colors.text} ${theme.colors.textDim}— ${display.status}${theme.colors.text}`,
  );

  // Stats row
  lines.push(
    `  ${theme.colors.textDim}Agents:${theme.colors.text} ${display.agents}  ${theme.colors.textDim}Active:${theme.colors.text} ${display.activeDelegations}  ${theme.colors.textDim}Completed:${theme.colors.text} ${display.completedDelegations}  ${theme.colors.textDim}Failed:${theme.colors.text} ${display.failedDelegations}  ${theme.colors.textDim}Partitions:${theme.colors.text} ${display.partitions}  ${theme.colors.textDim}Uptime:${theme.colors.text} ${formatUptime(display.uptimeMs)}`,
  );

  // Divider
  lines.push(`  ${theme.colors.textDim}${theme.icon.divider.repeat(40)}${theme.colors.text}`);

  // Load metrics
  lines.push(`  ${theme.colors.textDim}Load Metrics:${theme.colors.text}`);
  const cpuColor = pressureColor(display.loadMetrics.cpuPressure);
  const memColor = pressureColor(display.loadMetrics.memoryPressure);
  const provColor = pressureColor(display.loadMetrics.providerPressure);
  const queueColor = pressureColor(display.loadMetrics.queuePressure);

  lines.push(
    `    ${pressureIcon(display.loadMetrics.cpuPressure)} CPU: ${cpuColor}${display.loadMetrics.cpuPressure}${theme.colors.text}  ${pressureIcon(display.loadMetrics.memoryPressure)} Mem: ${memColor}${display.loadMetrics.memoryPressure}${theme.colors.text}  ${pressureIcon(display.loadMetrics.providerPressure)} Provider: ${provColor}${display.loadMetrics.providerPressure}${theme.colors.text}  ${pressureIcon(display.loadMetrics.queuePressure)} Queue: ${queueColor}${display.loadMetrics.queuePressure}${theme.colors.text}`,
  );
  lines.push(
    `    ${theme.colors.textDim}Workers:${theme.colors.text} ${display.loadMetrics.activeWorkers} active / ${display.loadMetrics.idleWorkers} idle  ${theme.colors.textDim}Recommendation:${theme.colors.text} ${display.loadMetrics.recommendation}`,
  );

  // Protection status
  if (display.protection.throttlingActive) {
    lines.push(
      `    ${theme.icon.warning} ${theme.colors.warning}Throttling active${theme.colors.text} — CPU: ${display.protection.cpuPressure}, Memory: ${display.protection.memoryPressure}`,
    );
  }

  // Pipeline info
  if (display.pipelines && display.pipelines.length > 0) {
    lines.push(`  ${theme.colors.textDim}Pipelines:${theme.colors.text}`);
    for (const pipeline of display.pipelines) {
      const pColor =
        pipeline.status === 'running'
          ? theme.colors.primary
          : pipeline.status === 'completed'
            ? theme.colors.success
            : pipeline.status === 'failed'
              ? theme.colors.error
              : theme.colors.textMuted;
      lines.push(
        `    ${theme.icon.arrow} ${pColor}${pipeline.name}${theme.colors.text} ${theme.colors.textDim}— ${pipeline.completedStages}/${pipeline.stageCount} stages (${pipeline.status})${theme.colors.text}`,
      );
    }
  }

  // Adaptation info
  if (display.adaptationLevel) {
    const adaptColor =
      display.adaptationLevel === 'normal'
        ? theme.colors.success
        : display.adaptationLevel === 'reduced'
          ? theme.colors.warning
          : theme.colors.error;
    lines.push(
      `  ${theme.colors.textDim}Adaptation:${theme.colors.text} ${adaptColor}${display.adaptationLevel}${display.cooldownActive ? ` ${theme.colors.warning}(cooldown)${theme.colors.text}` : theme.colors.text}`,
    );
  }

  return lines;
}

/**
 * Render a compact one-line swarm status.
 */
export function compactSwarmLine(display: SwarmDisplay): string {
  const statusIcon =
    display.status === 'running'
      ? theme.icon.arrow
      : display.status === 'paused'
        ? theme.icon.dot
        : display.status === 'error'
          ? theme.icon.cross
          : theme.icon.ellipsis;
  const statusCol = statusColor(display.status);

  const throttleIndicator = display.protection.throttlingActive ? ` ${theme.icon.warning}` : '';

  return `${statusIcon} ${statusCol}${display.swarmName.padEnd(24)}${theme.colors.text} ${display.agents} agents, ${display.activeDelegations} active${throttleIndicator}${theme.colors.text}`;
}

/**
 * Render agent delegation chain.
 */
export function delegationChainLine(
  chain: Array<{ source: string; target: string; status: string }>,
): string {
  if (chain.length === 0)
    return `  ${theme.colors.textDim}No active delegations${theme.colors.text}`;

  const parts = chain.map((c) => {
    const color =
      c.status === 'completed'
        ? theme.colors.success
        : c.status === 'running'
          ? theme.colors.primary
          : c.status === 'failed'
            ? theme.colors.error
            : theme.colors.textDim;
    return `${color}${c.source}${theme.colors.text} ${theme.icon.arrow} ${color}${c.target}${theme.colors.text}`;
  });

  return `  ${parts.join(' → ')}`;
}

/**
 * Render the worker utilization line.
 */
export function workerUtilizationLine(active: number, idle: number, total: number): string {
  const busyBar = theme.icon.bullet.repeat(active);
  const idleBar = theme.colors.textDim + theme.icon.bullet.repeat(idle) + theme.colors.text;
  const percent = total > 0 ? Math.round((active / total) * 100) : 0;
  const color =
    percent > 80
      ? theme.colors.warning
      : percent > 50
        ? theme.colors.primary
        : theme.colors.success;

  return `  ${color}${busyBar}${idleBar}${theme.colors.text} ${color}${active}/${total} (${percent}%)${theme.colors.text}`;
}
