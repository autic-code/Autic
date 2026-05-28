/**
 * Runtime Events — Central event bus for the execution runtime.
 * Powers UI updates, telemetry, and future swarm orchestration.
 */

import { EventEmitter } from 'node:events';
import { timestamp } from '@autic/shared';
import type { RuntimeEvent, RuntimeEventType } from '@autic/shared';

export type EventListener = (event: RuntimeEvent) => void;

export class RuntimeEvents extends EventEmitter {
  private eventLog: RuntimeEvent[] = [];
  private readonly maxLogSize: number;
  private eventListeners: Map<RuntimeEventType, Set<EventListener>> = new Map();

  constructor(maxLogSize = 1000) {
    super();
    this.maxLogSize = maxLogSize;
  }

  /**
   * Emit a runtime event. All registered listeners are notified.
   * Events are also logged for later retrieval.
   */
  emitEvent(type: RuntimeEventType, data?: Omit<RuntimeEvent, 'type' | 'timestamp'>): void {
    const event: RuntimeEvent = {
      type,
      timestamp: timestamp(),
      ...data,
    };

    // Log the event
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Notify type-specific listeners
    const typeListeners = this.eventListeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch {
          // Prevent listener errors from breaking the bus
        }
      }
    }

    // Emit via EventEmitter for general listeners
    this.emit(type, event);
    this.emit('*', event);
  }

  /**
   * Register a listener for a specific event type.
   */
  onEvent(type: RuntimeEventType, listener: EventListener): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(type)?.delete(listener);
    };
  }

  /**
   * Register a listener for all events.
   */
  onAny(listener: EventListener): () => void {
    this.on('*', listener);
    return () => {
      this.off('*', listener);
    };
  }

  /**
   * Get recent events of a specific type.
   */
  getEvents(type?: RuntimeEventType, limit = 50): RuntimeEvent[] {
    const filtered = type
      ? this.eventLog.filter((e) => e.type === type)
      : [...this.eventLog];

    return filtered.slice(-limit);
  }

  /**
   * Get events within a time range.
   */
  getEventsInRange(startTime: number, endTime: number): RuntimeEvent[] {
    return this.eventLog.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );
  }

  /**
   * Get event counts by type for monitoring.
   */
  getEventStats(): Record<RuntimeEventType, number> {
    const stats: Record<string, number> = {};
    for (const event of this.eventLog) {
      stats[event.type] = (stats[event.type] || 0) + 1;
    }
    return stats as Record<RuntimeEventType, number>;
  }

  /**
   * Clear event log.
   */
  clearLog(): void {
    this.eventLog = [];
  }

  /**
   * Get total event count.
   */
  get eventCount(): number {
    return this.eventLog.length;
  }
}
