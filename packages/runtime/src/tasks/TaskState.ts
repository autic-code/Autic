/**
 * Task state machine.
 * Validates and manages legal state transitions for task lifecycle.
 */

import type { TaskState } from '@autic/shared';

const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending:    ['queued', 'cancelled'],
  queued:     ['planning', 'running', 'cancelled'],
  planning:   ['running', 'failed', 'paused'],
  running:    ['awaiting_tool', 'completed', 'failed', 'paused', 'cancelled'],
  awaiting_tool: ['running', 'failed', 'cancelled'],
  completed:  [],
  failed:     ['retrying'],
  retrying:   ['queued', 'failed', 'cancelled'],
  paused:     ['queued', 'cancelled'],
  cancelled:  [],
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertTransition(from: TaskState, to: TaskState): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid state transition: ${from} -> ${to}. Allowed: [${VALID_TRANSITIONS[from]?.join(', ') || 'none'}]`,
    );
  }
}

export function transitionTask(current: TaskState, next: TaskState): TaskState {
  assertTransition(current, next);
  return next;
}

export function isTerminal(state: TaskState): boolean {
  return state === 'completed' || state === 'cancelled';
}

export function isActive(state: TaskState): boolean {
  return ['queued', 'planning', 'running', 'awaiting_tool', 'retrying'].includes(state);
}

export function isFailed(state: TaskState): boolean {
  return state === 'failed';
}

export function isPaused(state: TaskState): boolean {
  return state === 'paused';
}

export function canRetry(state: TaskState): boolean {
  return state === 'failed';
}

export function canCancel(state: TaskState): boolean {
  return ['pending', 'queued', 'planning', 'running', 'awaiting_tool', 'paused', 'retrying'].includes(state);
}
