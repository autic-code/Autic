/**
 * Context Hooks — API contract for context engineering hooks.
 *
 * Extensions can observe token optimization, context assembly,
 * and retrieval operations.
 */

import { EventEmitter } from 'events';

/**
 * Context hook event types
 */
export enum ContextHookEvent {
  /** Context assembly started */
  ASSEMBLY_START = 'context:assembly:start',
  /** Context assembly completed */
  ASSEMBLY_COMPLETE = 'context:assembly:complete',
  /** Token budget calculated */
  BUDGET_CALCULATED = 'context:budget:calculated',
  /** Context compression applied */
  COMPRESSION_APPLIED = 'context:compression:applied',
  /** Retrieval operation started */
  RETRIEVAL_START = 'context:retrieval:start',
  /** Retrieval operation completed */
  RETRIEVAL_COMPLETE = 'context:retrieval:complete',
  /** Cache hit */
  CACHE_HIT = 'context:cache:hit',
  /** Cache miss */
  CACHE_MISS = 'context:cache:miss',
  /** Context pruned */
  CONTEXT_PRUNED = 'context:pruned',
}

/**
 * Context hook context
 */
export interface ContextHookContext {
  /** Hook event type */
  event: ContextHookEvent;
  /** Session ID if applicable */
  sessionId?: string;
  /** Token count if applicable */
  tokenCount?: number;
  /** Timestamp */
  timestamp: number;
  /** Event payload */
  payload?: Record<string, unknown>;
}

/**
 * Context hook handler
 */
export type ContextHookHandler = (context: ContextHookContext) => void | Promise<void>;

/**
 * Context Hooks — managed hook system for context engineering
 */
export class ContextHooks {
  private emitter: EventEmitter = new EventEmitter();
  private handlers: Map<ContextHookEvent, ContextHookHandler[]> = new Map();

  /**
   * Register a handler for a context event
   */
  on(event: ContextHookEvent, handler: ContextHookHandler): () => void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
    this.emitter.on(event, handler);

    return () => {
      const idx = existing.indexOf(handler);
      if (idx >= 0) existing.splice(idx, 1);
      this.emitter.off(event, handler);
    };
  }

  /**
   * Emit a context event
   */
  emit(
    event: ContextHookEvent,
    context: Omit<ContextHookContext, 'event' | 'timestamp'>,
  ): void {
    const fullContext: ContextHookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };
    this.emitter.emit(event, fullContext);
  }
}
