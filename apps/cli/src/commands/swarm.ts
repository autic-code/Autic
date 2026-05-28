/**
 * autic swarm — Controlled swarm orchestration CLI command.
 *
 * Subcommands:
 *   status      - Show current swarm status and metrics
 *   inspect     - Show detailed swarm state
 *   pipelines   - List available pipeline templates
 *   partitions  - List execution partitions
 *   safety      - Show safety violations and protections
 *   start       - Start the swarm orchestrator
 *   stop        - Stop the swarm orchestrator
 *   pause       - Pause the swarm orchestrator
 *   resume      - Resume the swarm orchestrator
 */

import { SwarmOrchestrator } from '@autic/swarm';
import { RoleBasedPipelines } from '@autic/swarm';
import { ExecutionPartitioning } from '@autic/swarm';
import { renderSwarmPanel, compactSwarmLine } from '@autic/ui';
import type { SwarmDisplay } from '@autic/ui';
import { theme } from '@autic/ui';

function noopAction(action: string): void {
  const lines: string[] = [];
  lines.push(`${theme.icon.arrow} ${theme.colors.primary}Swarm Orchestration${theme.colors.text}`);
  lines.push('');
  lines.push(`  ${theme.colors.textDim}Usage:${theme.colors.text}`);
  lines.push(
    `    ${theme.colors.primary}autic swarm status${theme.colors.text}      — Show swarm status`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm inspect${theme.colors.text}     — Show detailed state`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm pipelines${theme.colors.text}   — List pipeline templates`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm safety${theme.colors.text}      — Show safety status`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm start${theme.colors.text}       — Start swarm orchestrator`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm stop${theme.colors.text}        — Stop swarm orchestrator`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm pause${theme.colors.text}       — Pause swarm`,
  );
  lines.push(
    `    ${theme.colors.primary}autic swarm resume${theme.colors.text}      — Resume swarm`,
  );
  console.log(lines.join('\n'));
}

export async function swarmCommand(action?: string): Promise<void> {
  const orchestrator = new SwarmOrchestrator({ swarmName: 'Autic Swarm' });
  const pipelines = new RoleBasedPipelines();
  const partitions = new ExecutionPartitioning();

  switch (action) {
    case 'status': {
      const status = orchestrator.getStatus();
      const display: SwarmDisplay = {
        swarmName: status.name,
        status: status.status,
        agents: status.agents,
        activeDelegations: status.activeDelegations,
        completedDelegations: status.completedDelegations,
        failedDelegations: status.failedDelegations,
        partitions: status.partitions,
        uptimeMs: status.uptimeMs,
        loadMetrics: {
          cpuPressure: status.protection.cpuPressure,
          memoryPressure: status.protection.memoryPressure,
          providerPressure: status.protection.providerPressure,
          queuePressure: status.protection.queuePressure,
          recommendation: status.loadMetrics.recommendation,
          activeWorkers: status.loadMetrics.activeWorkers,
          idleWorkers: status.loadMetrics.idleWorkers,
        },
        protection: {
          throttlingActive: status.protection.throttlingActive,
          cpuPressure: status.protection.cpuPressure,
          memoryPressure: status.protection.memoryPressure,
        },
        pipelines: pipelines.list().map((p) => ({
          name: p.name,
          stageCount: p.stages.length,
          completedStages: 0,
          status: 'idle',
        })),
      };
      const panel = renderSwarmPanel(display);
      console.log(panel.join('\n'));
      break;
    }

    case 'inspect': {
      const status = orchestrator.getStatus();
      const violations = orchestrator.getSafetySystem().getViolations();
      const lines: string[] = [];

      lines.push(
        `${theme.icon.arrow} ${theme.colors.primary}Swarm Detailed State${theme.colors.text}`,
      );
      lines.push('');
      lines.push(`  ${theme.colors.textDim}Swarm ID:${theme.colors.text} ${status.id}`);
      lines.push(`  ${theme.colors.textDim}Status:${theme.colors.text} ${status.status}`);
      lines.push(`  ${theme.colors.textDim}Agents:${theme.colors.text} ${status.agents}`);
      lines.push(
        `  ${theme.colors.textDim}Active Delegations:${theme.colors.text} ${status.activeDelegations}`,
      );
      lines.push(`  ${theme.colors.textDim}Config:${theme.colors.text}`);
      lines.push(
        `    ${theme.colors.textDim}Max Agents:${theme.colors.text} ${status.config.maxAgents}`,
      );
      lines.push(
        `    ${theme.colors.textDim}Max Depth:${theme.colors.text} ${status.config.maxDelegationDepth}`,
      );
      lines.push(
        `    ${theme.colors.textDim}Max Parallel:${theme.colors.text} ${status.config.maxParallelBatches}`,
      );
      lines.push(
        `    ${theme.colors.textDim}Safety Profile:${theme.colors.text} ${status.config.safetyProfile}`,
      );

      if (violations.length > 0) {
        lines.push(`  ${theme.colors.warning}Safety Violations:${theme.colors.text}`);
        for (const v of violations) {
          lines.push(
            `    ${theme.icon.warning} ${theme.colors.warning}${v.type}${theme.colors.text}: ${v.message}`,
          );
        }
      }

      console.log(lines.join('\n'));
      break;
    }

    case 'pipelines': {
      const allPipelines = pipelines.list();
      const lines: string[] = [];

      lines.push(
        `${theme.icon.arrow} ${theme.colors.primary}Swarm Pipeline Templates${theme.colors.text}`,
      );
      lines.push('');
      for (const p of allPipelines) {
        lines.push(`  ${theme.icon.arrow} ${theme.colors.primary}${p.name}${theme.colors.text}`);
        lines.push(`    ${theme.colors.textDim}${p.description}${theme.colors.text}`);
        lines.push(
          `    ${theme.colors.textDim}Stages:${theme.colors.text} ${p.stages.length}  ${theme.colors.textDim}Timeout:${theme.colors.text} ${(p.timeoutMs / 1000).toFixed(0)}s  ${theme.colors.textDim}Max Parallel:${theme.colors.text} ${p.maxParallelism}`,
        );
        lines.push('');
      }

      console.log(lines.join('\n'));
      break;
    }

    case 'safety': {
      const violations = orchestrator.getSafetySystem().getViolations();
      const protection = orchestrator.getProtectionState();
      const lines: string[] = [];

      lines.push(
        `${theme.icon.arrow} ${theme.colors.primary}Swarm Safety & Protection${theme.colors.text}`,
      );
      lines.push('');

      // Safety violations
      if (violations.length > 0) {
        lines.push(`  ${theme.colors.warning}Active Safety Violations:${theme.colors.text}`);
        for (const v of violations) {
          const icon = v.type === 'pipeline_collapse' ? theme.icon.cross : theme.icon.warning;
          lines.push(
            `    ${icon} ${theme.colors.warning}${v.type}${theme.colors.text}: ${v.message}`,
          );
        }
      } else {
        lines.push(
          `  ${theme.icon.check} ${theme.colors.success}No safety violations${theme.colors.text}`,
        );
      }

      lines.push('');
      lines.push(`  ${theme.colors.textDim}Resource Protection:${theme.colors.text}`);
      lines.push(
        `    ${theme.colors.textDim}CPU:${theme.colors.text} ${protection.cpuPressure}  ${theme.colors.textDim}Memory:${theme.colors.text} ${protection.memoryPressure}  ${theme.colors.textDim}Provider:${theme.colors.text} ${protection.providerPressure}  ${theme.colors.textDim}Workers:${theme.colors.text} ${protection.workerPressure}  ${theme.colors.textDim}Queue:${theme.colors.text} ${protection.queuePressure}`,
      );
      lines.push(
        `    ${theme.colors.textDim}Throttling:${theme.colors.text} ${protection.throttlingActive ? `${theme.icon.warning} ${theme.colors.warning}Active${theme.colors.text}` : `${theme.icon.check} ${theme.colors.success}Inactive${theme.colors.text}`}`,
      );

      console.log(lines.join('\n'));
      break;
    }

    case 'start': {
      orchestrator.start();
      console.log(
        `${theme.icon.check} ${theme.colors.success}Swarm orchestrator started${theme.colors.text}`,
      );
      break;
    }

    case 'stop': {
      orchestrator.stop();
      console.log(
        `${theme.icon.check} ${theme.colors.success}Swarm orchestrator stopped${theme.colors.text}`,
      );
      break;
    }

    case 'pause': {
      orchestrator.pause();
      console.log(
        `${theme.icon.dot} ${theme.colors.warning}Swarm orchestrator paused${theme.colors.text}`,
      );
      break;
    }

    case 'resume': {
      orchestrator.resume();
      console.log(
        `${theme.icon.arrow} ${theme.colors.primary}Swarm orchestrator resumed${theme.colors.text}`,
      );
      break;
    }

    default:
      noopAction(action || '');
      break;
  }
}
