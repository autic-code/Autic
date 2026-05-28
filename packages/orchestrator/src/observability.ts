/**
 * OrchestrationObservability — Pipeline runtime event tracking and display helpers.
 *
 * Provides:
 *   - Structured event recording with bounded storage
 *   - Event filtering by stage, type, and agent
 *   - Stage display helpers for UI rendering
 *   - Event history access
 *
 * All events are bounded (last 100 by default) to prevent memory leaks.
 */

import type { OrchestrationEvent, OrchestrationStage, OrchestrationEventType } from '@autic/shared';

export interface PipelineDisplayStage {
  stage: OrchestrationStage;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  error?: string;
  agentId?: string;
}

export class OrchestrationObservability {
  private events: OrchestrationEvent[] = [];
  private maxEvents: number;
  private stageHistory: Map<OrchestrationStage, PipelineDisplayStage> = new Map();

  constructor(maxEvents: number = 100) {
    this.maxEvents = maxEvents;
  }

  /**
   * Record an orchestration event.
   */
  record(event: OrchestrationEvent): OrchestrationEvent {
    this.events.push(event);

    // Update stage history
    if (event.type.startsWith('pipeline:stage_')) {
      const stage = event.stage;
      let status: PipelineDisplayStage['status'] = 'pending';

      if (event.type === 'pipeline:stage_started') status = 'running';
      else if (event.type === 'pipeline:stage_completed') status = 'completed';
      else if (event.type === 'pipeline:stage_failed') status = 'failed';
      else if (event.type === 'pipeline:stage_skipped') status = 'skipped';

      this.stageHistory.set(stage, {
        stage,
        status,
        durationMs: event.data?.durationMs as number | undefined,
        error: event.error,
        agentId: event.agentId,
      });
    }

    // Trim to max events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return event;
  }

  /**
   * Get all recorded events.
   */
  getEvents(): OrchestrationEvent[] {
    return [...this.events];
  }

  /**
   * Get recent events by count.
   */
  getRecentEvents(count: number = 10): OrchestrationEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Filter events by type.
   */
  getEventsByType(type: OrchestrationEventType): OrchestrationEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Filter events by stage.
   */
  getEventsByStage(stage: OrchestrationStage): OrchestrationEvent[] {
    return this.events.filter((e) => e.stage === stage);
  }

  /**
   * Filter events by agent.
   */
  getEventsByAgent(agentId: string): OrchestrationEvent[] {
    return this.events.filter((e) => e.agentId === agentId);
  }

  /**
   * Get the current display state for all stages.
   */
  getStageDisplay(): PipelineDisplayStage[] {
    return Array.from(this.stageHistory.values());
  }

  /**
   * Get a specific stage's display state.
   */
  getStageDisplayFor(stage: OrchestrationStage): PipelineDisplayStage | undefined {
    return this.stageHistory.get(stage);
  }

  /**
   * Get pipeline summary statistics.
   */
  getSummary(): {
    totalEvents: number;
    completedStages: number;
    failedStages: number;
    startedAt?: number;
    completedAt?: number;
    totalDurationMs?: number;
  } {
    const hasPipelineStart = this.events.find((e) => e.type === 'pipeline:started');
    const hasPipelineEnd = this.events.find(
      (e) =>
        e.type === 'pipeline:completed' ||
        e.type === 'pipeline:failed' ||
        e.type === 'pipeline:cancelled',
    );

    return {
      totalEvents: this.events.length,
      completedStages: this.events.filter((e) => e.type === 'pipeline:stage_completed').length,
      failedStages: this.events.filter((e) => e.type === 'pipeline:stage_failed').length,
      startedAt: hasPipelineStart?.timestamp,
      completedAt: hasPipelineEnd?.timestamp,
      totalDurationMs:
        hasPipelineStart && hasPipelineEnd
          ? hasPipelineEnd.timestamp - hasPipelineStart.timestamp
          : undefined,
    };
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
    this.stageHistory.clear();
  }
}

/**
 * Create display data for each pipeline stage.
 * Useful for UI rendering in the CLI.
 */
export function createStageDisplay(
  stage: OrchestrationStage,
  _index: number,
  _total: number,
): PipelineDisplayStage {
  return {
    stage,
    status: 'pending',
    agentId: `agent-${stage}`,
  };
}
