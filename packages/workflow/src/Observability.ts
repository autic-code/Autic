/**
 * Observability — Runtime transparency layer for autonomous workflows.
 *
 * Provides:
 *   - Execution event log (structured, searchable)
 *   - Step/repair/verification visibility
 *   - Provider/model attribution
 *   - Duration tracking
 *   - Event streaming via EventEmitter
 *
 * All events are timestamped and structured for both human
 * reading and machine parsing.
 */

import { timestamp } from '@autic/shared';
import type { ExecutionEvent, ExecutionEventType } from '@autic/shared';

export interface ObservabilityOptions {
  maxEvents?: number;
  persistEvents?: boolean;
}

export interface ExecutionEventStore {
  events: ExecutionEvent[];
  clear(): void;
  getSummary(): EventSummary;
}

export interface EventSummary {
  totalEvents: number;
  byType: Record<string, number>;
  timeRange: { from: number; to: number };
  errors: number;
  warnings: number;
}

export class Observability {
  private events: ExecutionEvent[] = [];
  private maxEvents: number;

  constructor(options: ObservabilityOptions = {}) {
    this.maxEvents = options.maxEvents || 500;
  }

  /**
   * Record an execution event.
   * Returns the recorded event for chaining.
   */
  record(params: {
    type: ExecutionEventType;
    message: string;
    planId?: string;
    stepId?: string;
    metadata?: Record<string, unknown>;
  }): ExecutionEvent {
    const event: ExecutionEvent = {
      type: params.type,
      timestamp: timestamp(),
      planId: params.planId,
      stepId: params.stepId,
      message: params.message,
      data: params.metadata,
    };

    this.events.push(event);

    // Trim to max events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return event;
  }

  /**
   * Record a workflow execution step update.
   */
  recordStepEvent(
    planId: string,
    stepId: string,
    description: string,
    status: string,
    durationMs?: number,
  ): ExecutionEvent {
    return this.record({
      type: status === 'success'
        ? 'workflow:step_completed'
        : status === 'failed'
          ? 'workflow:step_failed'
          : 'workflow:step_started',
      message: `${status === 'success' ? '✓' : status === 'failed' ? '✗' : '⟳'} ${description}`,
      planId,
      stepId,
      metadata: { status, durationMs },
    });
  }

  /**
   * Record a repair attempt event.
   */
  recordRepairEvent(
    planId: string,
    stepId: string,
    attemptNumber: number,
    success: boolean,
    error?: string,
  ): ExecutionEvent {
    return this.record({
      type: 'workflow:repairing',
      message: success
        ? `Repair attempt ${attemptNumber} succeeded`
        : `Repair attempt ${attemptNumber} failed: ${(error || '').slice(0, 80)}`,
      planId,
      stepId,
      metadata: { attemptNumber, success, error },
    });
  }

  /**
   * Record a verification result event.
   */
  recordVerificationEvent(
    planId: string,
    stepId: string,
    passed: boolean,
    summary: string,
  ): ExecutionEvent {
    return this.record({
      type: 'workflow:verifying',
      message: passed ? `Verification passed: ${summary}` : `Verification failed: ${summary}`,
      planId,
      stepId,
      metadata: { passed, summary },
    });
  }

  /**
   * Get all recorded events.
   */
  getEvents(): ExecutionEvent[] {
    return [...this.events];
  }

  /**
   * Get events filtered by type.
   */
  getEventsByType(type: ExecutionEventType): ExecutionEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events for a specific workflow.
   */
  getEventsByPlan(planId: string): ExecutionEvent[] {
    return this.events.filter((e) => e.planId === planId);
  }

  /**
   * Get events for a specific step.
   */
  getEventsByStep(stepId: string): ExecutionEvent[] {
    return this.events.filter((e) => e.stepId === stepId);
  }

  /**
   * Get the most recent N events.
   */
  getRecentEvents(count = 10): ExecutionEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Search events by message text.
   */
  searchEvents(query: string): ExecutionEvent[] {
    const lower = query.toLowerCase();
    return this.events.filter(
      (e) =>
        e.message.toLowerCase().includes(lower) ||
        e.type.toLowerCase().includes(lower),
    );
  }

  /**
   * Get a summary of all events.
   */
  getSummary(): EventSummary {
    const byType: Record<string, number> = {};
    let errors = 0;
    let warnings = 0;

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      if (event.type.includes('failed') || event.type.includes('error')) {
        errors++;
      }
      if (event.type.includes('verifying') && event.data?.passed === false) {
        warnings++;
      }
    }

    return {
      totalEvents: this.events.length,
      byType,
      timeRange: {
        from: this.events[0]?.timestamp || timestamp(),
        to: this.events[this.events.length - 1]?.timestamp || timestamp(),
      },
      errors,
      warnings,
    };
  }

  /**
   * Get retry visibility data.
   */
  getRetrySummary(): Array<{
    stepId: string;
    planId?: string;
    description: string;
    events: ExecutionEvent[];
  }> {
    const repairEvents = this.events.filter((e) => e.type === 'workflow:repairing');
    const stepMap = new Map<string, ExecutionEvent[]>();

    for (const event of repairEvents) {
      const key = event.stepId || 'unknown';
      if (!stepMap.has(key)) {
        stepMap.set(key, []);
      }
      stepMap.get(key)!.push(event);
    }

    return Array.from(stepMap.entries())
      .filter(([_, events]) => events.length > 1) // Only steps with retries
      .map(([stepId, events]) => ({
        stepId,
        planId: events[0]?.planId,
        description: events[0]?.message || '',
        events,
      }));
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get event count.
   */
  get size(): number {
    return this.events.length;
  }
}
