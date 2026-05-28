/**
 * Runtime Hooks — API contract for runtime lifecycle hooks.
 *
 * Extensions can hook into runtime events to observe and
 * influence execution behavior in a bounded, safe manner.
 */

import { EventEmitter } from 'events';

/**
 * Runtime hook event types
 */
export enum RuntimeHookEvent {
  /** Runtime startup complete */
  STARTUP = 'runtime:startup',
  /** Runtime shutdown initiated */
  SHUTDOWN = 'runtime:shutdown',
  /** Task execution started */
  TASK_START = 'runtime:task:start',
  /** Task execution completed */
  TASK_COMPLETE = 'runtime:task:complete',
  /** Task execution failed */
  TASK_ERROR = 'runtime:task:error',
  /** Queue state changed */
  QUEUE_UPDATE = 'runtime:queue:update',
  /** Worker state changed */
  WORKER_UPDATE = 'runtime:worker:update',
  /** Pipeline stage transition */
  PIPELINE_STAGE = 'runtime:pipeline:stage',
}

/**
 * Runtime hook context
 */
export interface RuntimeHookContext {
  /** Hook event type */
  event: RuntimeHookEvent;
  /** Timestamp of the event */
  timestamp: number;
  /** Event payload */
  payload?: Record<string, unknown>;
}

/**
 * Runtime hook handler
 */
export type RuntimeHookHandler = (context: RuntimeHookContext) => void | Promise<void>;

/**
 * Runtime Hooks — managed hook system for runtime lifecycle
 */
export class RuntimeHooks {
  private emitter: EventEmitter = new EventEmitter();
  private handlers: Map<RuntimeHookEvent, RuntimeHookHandler[]> = new Map();
  private maxHandlersPerEvent = 50;

  /**
   * Register a handler for a runtime event
   */
  on(event: RuntimeHookEvent, handler: RuntimeHookHandler): () => void {
    const existing = this.handlers.get(event) ?? [];
    if (existing.length >= this.maxHandlersPerEvent) {
      throw new Error(`Maximum handlers (${this.maxHandlersPerEvent}) reached for event: ${event}`);
    }

    existing.push(handler);
    this.handlers.set(event, existing);

    // Also register with EventEmitter for internal dispatch
    this.emitter.on(event, handler);

    // Return unsubscribe function
    return () => {
      const idx = existing.indexOf(handler);
      if (idx >= 0) existing.splice(idx, 1);
      this.emitter.off(event, handler);
    };
  }

  /**
   * Register a one-time handler
   */
  once(event: RuntimeHookEvent, handler: RuntimeHookHandler): void {
    const wrapped: RuntimeHookHandler = async (context) => {
      await handler(context);
      this.emitter.off(event, wrapped);
    };
    this.emitter.once(event, wrapped);
  }

  /**
   * Emit a runtime event to all handlers
   */
  emit(event: RuntimeHookEvent, payload?: Record<string, unknown>): void {
    const context: RuntimeHookContext = {
      event,
      timestamp: Date.now(),
      payload,
    };

    this.emitter.emit(event, context);
  }

  /**
   * Get all registered events
   */
  getRegisteredEvents(): RuntimeHookEvent[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for an event
   */
  handlerCount(event: RuntimeHookEvent): number {
    return this.handlers.get(event)?.length ?? 0;
  }

  /**
   * Remove all handlers for an event
   */
  clearEvent(event: RuntimeHookEvent): void {
    this.handlers.delete(event);
    this.emitter.removeAllListeners(event);
  }

  /**
   * Remove all handlers
   */
  clearAll(): void {
    this.handlers.clear();
    this.emitter.removeAllListeners();
  }
}
