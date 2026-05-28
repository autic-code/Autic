/**
 * Workflow Hooks — API contract for workflow lifecycle hooks.
 *
 * Extensions can observe and influence workflow planning,
 * execution, and verification stages.
 */

import { EventEmitter } from 'events';

/**
 * Workflow hook event types
 */
export enum WorkflowHookEvent {
  /** Workflow planning started */
  PLAN_START = 'workflow:plan:start',
  /** Workflow plan generated */
  PLAN_COMPLETE = 'workflow:plan:complete',
  /** Execution step started */
  STEP_START = 'workflow:step:start',
  /** Execution step completed */
  STEP_COMPLETE = 'workflow:step:complete',
  /** Execution step failed */
  STEP_ERROR = 'workflow:step:error',
  /** Verification started */
  VERIFY_START = 'workflow:verify:start',
  /** Verification result */
  VERIFY_COMPLETE = 'workflow:verify:complete',
  /** Repair loop initiated */
  REPAIR_START = 'workflow:repair:start',
  /** Repair loop completed */
  REPAIR_COMPLETE = 'workflow:repair:complete',
  /** Workflow completed */
  WORKFLOW_COMPLETE = 'workflow:complete',
  /** Workflow cancelled */
  WORKFLOW_CANCELLED = 'workflow:cancelled',
}

/**
 * Workflow hook context
 */
export interface WorkflowHookContext {
  /** Hook event type */
  event: WorkflowHookEvent;
  /** Workflow ID */
  workflowId?: string;
  /** Step index if applicable */
  stepIndex?: number;
  /** Timestamp */
  timestamp: number;
  /** Event payload */
  payload?: Record<string, unknown>;
}

/**
 * Workflow hook handler
 */
export type WorkflowHookHandler = (context: WorkflowHookContext) => void | Promise<void>;

/**
 * Workflow Hooks — managed hook system for workflow lifecycle
 */
export class WorkflowHooks {
  private emitter: EventEmitter = new EventEmitter();
  private handlers: Map<WorkflowHookEvent, WorkflowHookHandler[]> = new Map();

  /**
   * Register a handler for a workflow event
   */
  on(event: WorkflowHookEvent, handler: WorkflowHookHandler): () => void {
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
   * Emit a workflow event
   */
  emit(
    event: WorkflowHookEvent,
    context: Omit<WorkflowHookContext, 'event' | 'timestamp'>,
  ): void {
    const fullContext: WorkflowHookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };
    this.emitter.emit(event, fullContext);
  }
}
