/**
 * SwarmObservability — Orchestration visibility and event tracking (#10)
 *
 * Provides:
 *   - Active agents display data
 *   - Delegation chain tracking
 *   - Event recording with bounded storage (max 500 events)
 *   - Queue and provider load indicators
 *   - Queryable event history
 */

import { timestamp } from '@autic/shared';
import type { SwarmEvent, SwarmEventType } from '@autic/shared';

export type SwarmEventCallback = (event: SwarmEvent) => void;

export class SwarmObservability {
  private events: SwarmEvent[] = [];
  private maxEvents = 500;
  private listeners: SwarmEventCallback[] = [];

  constructor(_swarmId: string) {
    // swarmId reserved for future scoped filtering
  }

  /** Record a swarm event */
  record(event: SwarmEvent): void {
    this.events.push({ ...event, timestamp: event.timestamp || timestamp() });

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Silently handle listener errors
      }
    }
  }

  /** Register an event listener */
  onEvent(callback: SwarmEventCallback): void {
    this.listeners.push(callback);
  }

  /** Remove an event listener */
  offEvent(callback: SwarmEventCallback): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /** Get all recorded events */
  getEvents(): SwarmEvent[] {
    return [...this.events];
  }

  /** Get recent events */
  getRecentEvents(count: number = 20): SwarmEvent[] {
    return this.events.slice(-count);
  }

  /** Filter events by type */
  getEventsByType(type: SwarmEventType): SwarmEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /** Filter events by agent */
  getEventsByAgent(agentId: string): SwarmEvent[] {
    return this.events.filter((e) => e.agentId === agentId);
  }

  /** Get delegation events */
  getDelegationEvents(): SwarmEvent[] {
    return this.events.filter(
      (e) => e.type.startsWith('delegation:') || e.type.startsWith('agent:'),
    );
  }

  /** Get safety events */
  getSafetyEvents(): SwarmEvent[] {
    return this.events.filter((e) => e.type.startsWith('safety:'));
  }

  /** Get recent errors */
  getRecentErrors(count: number = 10): SwarmEvent[] {
    return this.events.filter((e) => e.error).slice(-count);
  }

  /** Get summary statistics */
  getSummary(): {
    totalEvents: number;
    delegations: number;
    completions: number;
    failures: number;
    safetyViolations: number;
  } {
    return {
      totalEvents: this.events.length,
      delegations: this.events.filter((e) => e.type.startsWith('delegation:')).length,
      completions: this.events.filter(
        (e) => e.type === 'agent:completed' || e.type === 'delegation:completed',
      ).length,
      failures: this.events.filter(
        (e) => e.type === 'agent:failed' || e.type === 'delegation:failed',
      ).length,
      safetyViolations: this.events.filter((e) => e.type.startsWith('safety:')).length,
    };
  }

  /** Get agent delegation chains for display */
  getDelegationChains(): Array<{
    sourceAgentId: string;
    targetAgentId: string;
    type: string;
    timestamp: number;
    success: boolean;
  }> {
    return this.events
      .filter((e) => e.type.startsWith('delegation:') || e.type.startsWith('agent:'))
      .map((e) => ({
        sourceAgentId: e.agentId || '',
        targetAgentId: (e.data?.targetAgentId as string) || '',
        type: e.type,
        timestamp: e.timestamp,
        success: !e.error,
      }));
  }

  /** Get recent delegation counts per agent */
  getAgentActivity(): Map<string, { delegations: number; completions: number; failures: number }> {
    const activity = new Map<
      string,
      { delegations: number; completions: number; failures: number }
    >();

    for (const event of this.events) {
      if (!event.agentId) continue;
      if (!activity.has(event.agentId)) {
        activity.set(event.agentId, { delegations: 0, completions: 0, failures: 0 });
      }
      const stats = activity.get(event.agentId)!;
      if (event.type === 'agent:delegated') stats.delegations++;
      if (event.type === 'agent:completed') stats.completions++;
      if (event.type === 'agent:failed') stats.failures++;
    }

    return activity;
  }

  /** Clear all events */
  clear(): void {
    this.events = [];
  }
}
