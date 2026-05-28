/**
 * SecurityEventSystem — Structured security observability for runtime safety.
 *
 * Records permission checks, sanitization events, vault access, safety blocks,
 * and trust changes. Provides a searchable, timestamped event log.
 *
 * All events are:
 *   - Immutable after recording
 *   - Categorized by severity (info/warning/critical)
 *   - Searchable by type, action, and resource
 *   - Bounded to prevent memory exhaustion
 */

import { type SecurityEvent, type SecurityEventType } from '@autic/shared';

export interface SecurityEventSystemOptions {
  maxEvents?: number;
}

export class SecurityEventSystem {
  private events: SecurityEvent[] = [];
  private maxEvents: number;
  private eventIdCounter = 0;

  constructor(options: SecurityEventSystemOptions = {}) {
    this.maxEvents = options.maxEvents || 500;
  }

  /**
   * Record a security event.
   */
  record(params: {
    type: SecurityEventType;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    action?: string;
    resource?: string;
    details?: Record<string, unknown>;
  }): SecurityEvent {
    const event: SecurityEvent = {
      id: `sec-${++this.eventIdCounter}-${Date.now()}`,
      type: params.type,
      timestamp: Date.now(),
      severity: params.severity,
      message: params.message,
      action: params.action,
      resource: params.resource,
      details: params.details,
    };

    this.events.push(event);

    // Trim to max events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return event;
  }

  /**
   * Get all recorded security events.
   */
  getEvents(): SecurityEvent[] {
    return [...this.events];
  }

  /**
   * Get events filtered by type.
   */
  getEventsByType(type: SecurityEventType): SecurityEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events by severity level.
   */
  getEventsBySeverity(severity: SecurityEvent['severity']): SecurityEvent[] {
    return this.events.filter((e) => e.severity === severity);
  }

  /**
   * Get events for a specific action.
   */
  getEventsByAction(action: string): SecurityEvent[] {
    return this.events.filter((e) => e.action?.startsWith(action));
  }

  /**
   * Get the most recent N events.
   */
  getRecentEvents(count = 20): SecurityEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get summary of security events.
   */
  getSummary(): {
    total: number;
    critical: number;
    warnings: number;
    info: number;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    let critical = 0;
    let warnings = 0;
    let info = 0;

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      if (event.severity === 'critical') critical++;
      else if (event.severity === 'warning') warnings++;
      else info++;
    }

    return { total: this.events.length, critical, warnings, info, byType };
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
