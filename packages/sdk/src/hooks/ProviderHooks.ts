/**
 * Provider Hooks — API contract for provider lifecycle hooks.
 *
 * Extensions can observe provider interactions, model selection,
 * and rate limiting events.
 */

import { EventEmitter } from 'events';

/**
 * Provider hook event types
 */
export enum ProviderHookEvent {
  /** Provider registered */
  PROVIDER_REGISTERED = 'provider:registered',
  /** Provider removed */
  PROVIDER_REMOVED = 'provider:removed',
  /** Provider status changed */
  PROVIDER_STATUS_CHANGE = 'provider:status:change',
  /** Model selected for a request */
  MODEL_SELECTED = 'provider:model:selected',
  /** Provider request initiated */
  REQUEST_START = 'provider:request:start',
  /** Provider request completed */
  REQUEST_COMPLETE = 'provider:request:complete',
  /** Provider request failed */
  REQUEST_ERROR = 'provider:request:error',
  /** Rate limit approaching */
  RATE_LIMIT_WARNING = 'provider:ratelimit:warning',
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'provider:ratelimit:exceeded',
  /** Fallback provider activated */
  FALLBACK_ACTIVATED = 'provider:fallback:activated',
}

/**
 * Provider hook context
 */
export interface ProviderHookContext {
  /** Hook event type */
  event: ProviderHookEvent;
  /** Provider ID */
  providerId?: string;
  /** Model ID if applicable */
  modelId?: string;
  /** Timestamp */
  timestamp: number;
  /** Event payload */
  payload?: Record<string, unknown>;
}

/**
 * Provider hook handler
 */
export type ProviderHookHandler = (context: ProviderHookContext) => void | Promise<void>;

/**
 * Provider Hooks — managed hook system for provider lifecycle
 */
export class ProviderHooks {
  private emitter: EventEmitter = new EventEmitter();
  private handlers: Map<ProviderHookEvent, ProviderHookHandler[]> = new Map();

  /**
   * Register a handler for a provider event
   */
  on(event: ProviderHookEvent, handler: ProviderHookHandler): () => void {
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
   * Emit a provider event
   */
  emit(event: ProviderHookEvent, context: Omit<ProviderHookContext, 'event' | 'timestamp'>): void {
    const fullContext: ProviderHookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };
    this.emitter.emit(event, fullContext);
  }
}
