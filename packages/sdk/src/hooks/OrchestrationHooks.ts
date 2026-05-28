/**
 * Orchestration Hooks — API contract for orchestration lifecycle hooks.
 *
 * Extensions can observe pipeline execution, agent delegation,
 * and R&D pipeline stages.
 */

import { EventEmitter } from 'events';

/**
 * Orchestration hook event types
 */
export enum OrchestrationHookEvent {
  /** Pipeline execution started */
  PIPELINE_START = 'orchestration:pipeline:start',
  /** Pipeline stage transition */
  PIPELINE_STAGE = 'orchestration:pipeline:stage',
  /** Pipeline completed */
  PIPELINE_COMPLETE = 'orchestration:pipeline:complete',
  /** Pipeline failed */
  PIPELINE_ERROR = 'orchestration:pipeline:error',
  /** Agent delegated */
  AGENT_DELEGATED = 'orchestration:agent:delegated',
  /** Agent task completed */
  AGENT_COMPLETE = 'orchestration:agent:complete',
  /** Agent task failed */
  AGENT_ERROR = 'orchestration:agent:error',
  /** Swarm state changed */
  SWARM_UPDATE = 'orchestration:swarm:update',
  /** Role assigned */
  ROLE_ASSIGNED = 'orchestration:role:assigned',
}

/**
 * Orchestration hook context
 */
export interface OrchestrationHookContext {
  /** Hook event type */
  event: OrchestrationHookEvent;
  /** Pipeline ID if applicable */
  pipelineId?: string;
  /** Agent ID if applicable */
  agentId?: string;
  /** Stage name if applicable */
  stage?: string;
  /** Timestamp */
  timestamp: number;
  /** Event payload */
  payload?: Record<string, unknown>;
}

/**
 * Orchestration hook handler
 */
export type OrchestrationHookHandler = (context: OrchestrationHookContext) => void | Promise<void>;

/**
 * Orchestration Hooks — managed hook system for orchestration lifecycle
 */
export class OrchestrationHooks {
  private emitter: EventEmitter = new EventEmitter();
  private handlers: Map<OrchestrationHookEvent, OrchestrationHookHandler[]> = new Map();

  /**
   * Register a handler for a orchestration event
   */
  on(event: OrchestrationHookEvent, handler: OrchestrationHookHandler): () => void {
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
   * Emit an orchestration event
   */
  emit(
    event: OrchestrationHookEvent,
    context: Omit<OrchestrationHookContext, 'event' | 'timestamp'>,
  ): void {
    const fullContext: OrchestrationHookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };
    this.emitter.emit(event, fullContext);
  }
}
