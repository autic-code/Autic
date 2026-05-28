/**
 * autic observability — System observability command.
 *
 * Provides professional engineering-grade transparency into
 * orchestration, queue, provider, context, learning, and
 * runtime health indicators.
 */

import { ObservabilityEnhancer } from '@autic/diagnostics';

/**
 * Run observability command
 */
export async function observabilityCommand(action?: string): Promise<void> {
  const obs = new ObservabilityEnhancer();

  switch (action ?? 'health') {
    case 'health': {
      const health = obs.getRuntimeHealth();
      console.log('\n  ╭─── Runtime Health ─────────────────────────╮');
      console.log(`  │ Overall:    ${formatHealth(health.overall)}                          │`);
      console.log(`  │ Memory:     ${formatHealth(health.memory)}                          │`);
      console.log(`  │ Uptime:     ${formatDuration(health.uptimeMs)}`);
      console.log(`  │ Workers:    ${health.activeWorkers} active                         │`);
      console.log(`  │ Error Rate: ${(health.errorRate5m * 100).toFixed(1)}% (5 min)                    │`);
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    case 'orchestration': {
      const orch = obs.getOrchestrationSnapshot();
      console.log('\n  ╭─── Orchestration ──────────────────────────╮');
      console.log(`  │ Active Pipelines:  ${orch.activePipelines}                         │`);
      console.log(`  │ Completed:         ${orch.completedPipelines}                         │`);
      console.log(`  │ Failed:            ${orch.failedPipelines}                         │`);
      console.log(`  │ Throughput:        ${orch.pipelineThroughput.toFixed(1)}/min                     │`);
      console.log(`  │ Avg Duration:      ${formatDuration(orch.avgPipelineDurationMs)}`);
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    case 'queue': {
      const queue = obs.getQueueSnapshot();
      console.log('\n  ╭─── Queue ──────────────────────────────────╮');
      console.log(`  │ Depth:     ${queue.queueDepth}                               │`);
      console.log(`  │ Waiting:   ${queue.tasksWaiting}                               │`);
      console.log(`  │ In Flight: ${queue.tasksInProgress}                               │`);
      console.log(`  │ Processed: ${queue.tasksProcessed}                               │`);
      console.log(`  │ Failed:    ${queue.tasksFailed}                               │`);
      console.log(`  │ Wait Time: ${formatDuration(queue.avgWaitTimeMs)}`);
      console.log(`  │ Throughput: ${queue.queueThroughput.toFixed(1)}/min                       │`);
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    case 'provider': {
      const provider = obs.getProviderSnapshot();
      console.log('\n  ╭─── Provider ──────────────────────────────╮');
      console.log(`  │ ID:        ${provider.providerId.padEnd(30)}│`);
      console.log(`  │ Status:    ${formatStatus(provider.status)}                         │`);
      console.log(`  │ Requests:  ${provider.totalRequests} (${provider.failedRequests} failed)           │`);
      console.log(`  │ Latency:   ${provider.avgLatencyMs.toFixed(0)}ms avg                       │`);
      console.log(`  │ Error Rate: ${(provider.errorRate * 100).toFixed(1)}%                            │`);
      console.log(`  │ Models:    ${provider.modelsAvailable} available                       │`);
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    case 'context': {
      const ctx = obs.getContextSnapshot();
      console.log('\n  ╭─── Context Engineering ────────────────────╮');
      console.log(`  │ Active Sessions:  ${ctx.activeSessions}                         │`);
      console.log(`  │ Tokens Managed:   ${(ctx.totalTokensManaged / 1000).toFixed(0)}K                        │`);
      console.log(`  │ Cache Hit Rate:   ${(ctx.cacheHitRate * 100).toFixed(0)}%                            │`);
      console.log(`  │ Compression:      ${(ctx.compressionRatio * 100).toFixed(0)}%                           │`);
      console.log(`  │ Retrievals:       ${ctx.retrievalOperations}                           │`);
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    case 'learning': {
      const learn = obs.getLearningSnapshot();
      console.log('\n  ╭─── Learning System ────────────────────────╮');
      console.log(`  │ Patterns:   ${learn.patternsLearned}                               │`);
      console.log(`  │ Fixes:      ${learn.fixesMemorized}                               │`);
      console.log(`  │ Experience: ${learn.experienceEntries}                               │`);
      console.log(`  │ Accuracy:   ${(learn.learningAccuracy * 100).toFixed(0)}%                             │`);
      console.log(`  │ Last Learn: ${learn.lastLearningAt ? new Date(learn.lastLearningAt).toISOString() : 'Never'}        │`);
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    case 'events': {
      const events = obs.getRecentEvents({ limit: 10 });
      console.log('\n  ╭─── Recent Events ─────────────────────────╮');
      if (events.length === 0) {
        console.log('  │ No recent events                          │');
      } else {
        for (const event of events) {
          const sev = event.severity === 'error' ? '✗' : event.severity === 'warning' ? '⚠' : '●';
          console.log(`  │ ${sev} ${event.message.padEnd(38)}│`);
        }
      }
      console.log('  ╰──────────────────────────────────────────────╯');
      break;
    }

    default: {
      console.log(`\n  ✗ Unknown action: ${action}`);
      console.log('  Usage: autic observability [health|orchestration|queue|provider|context|learning|events]');
    }
  }
}

/**
 * Format health status with color indicators
 */
function formatHealth(status: string): string {
  switch (status) {
    case 'healthy': return '✓ Healthy';
    case 'degraded': return '⚠ Degraded';
    case 'unhealthy': return '✗ Unhealthy';
    case 'warning': return '⚠ Warning';
    case 'critical': return '✗ Critical';
    default: return status;
  }
}

/**
 * Format status string
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'healthy': return '✓ Healthy';
    case 'degraded': return '⚠ Degraded';
    case 'unhealthy': return '✗ Unhealthy';
    default: return status;
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
