/**
 * Task Orchestrator — Core task lifecycle manager.
 * Handles creation, execution flow, state transitions, and lifecycle events.
 */

import { generateId, timestamp } from '@autic/shared';
import type { TaskRecord, ExecutionStep, TaskState, ExecutionResult, RuntimeEvent } from '@autic/shared';
import { EventEmitter } from 'node:events';
import { transitionTask, canCancel, isTerminal } from './TaskState.js';
import { ExecutionEngine } from '../execution/ExecutionEngine.js';

export interface TaskOrchestratorOptions {
  maxRetries?: number;
  autoRecover?: boolean;
}

export interface TaskOrchestratorEvents {
  taskCreated: (task: TaskRecord) => void;
  taskStateChanged: (taskId: string, from: TaskState, to: TaskState) => void;
  stepCompleted: (taskId: string, step: ExecutionStep) => void;
  taskCompleted: (result: ExecutionResult) => void;
  taskFailed: (taskId: string, error: string) => void;
  event: (event: RuntimeEvent) => void;
}

export class TaskOrchestrator extends EventEmitter {
  private tasks: Map<string, TaskRecord> = new Map();
  private readonly maxRetries: number;
  private executionEngine: ExecutionEngine;

  constructor(options: TaskOrchestratorOptions = {}) {
    super();
    this.maxRetries = options.maxRetries || 3;
    this.executionEngine = new ExecutionEngine();
  }

  getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  createTask(params: {
    sessionId: string;
    type: string;
    description: string;
    priority?: number;
    parentId?: string;
    metadata?: Record<string, string>;
  }): TaskRecord {
    const task: TaskRecord = {
      id: generateId(),
      sessionId: params.sessionId,
      parentId: params.parentId,
      type: params.type,
      description: params.description,
      state: 'pending',
      priority: params.priority ?? 0,
      createdAt: timestamp(),
      steps: [],
      retries: 0,
      maxRetries: this.maxRetries,
      metadata: params.metadata || {},
    };

    this.tasks.set(task.id, task);
    this.emit('taskCreated', task);
    this.emitEvent('task:created', { taskId: task.id });

    return task;
  }

  transitionTo(taskId: string, nextState: TaskState): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const prevState = task.state;
    task.state = transitionTask(task.state, nextState);

    if (nextState === 'running') {
      task.startedAt = timestamp();
    }
    if (isTerminal(nextState)) {
      task.completedAt = timestamp();
    }

    this.emit('taskStateChanged', taskId, prevState, nextState);
    this.emitEvent(`task:${nextState}` as Parameters<typeof this.emitEvent>[0], { taskId });

    if (isTerminal(nextState)) {
      const result = this.getResult(taskId);
      if (result) {
        this.emit('taskCompleted', result);
      }
    }
  }

  addStep(taskId: string, step: Omit<ExecutionStep, 'id' | 'startedAt'>): ExecutionStep {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const fullStep: ExecutionStep = {
      ...step,
      id: generateId(),
      startedAt: timestamp(),
    };

    task.steps.push(fullStep);
    return fullStep;
  }

  updateStep(taskId: string, stepId: string, updates: Partial<ExecutionStep>): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const step = task.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`Step not found: ${stepId}`);

    Object.assign(step, updates);

    if (updates.status === 'success' || updates.status === 'failed') {
      step.completedAt = timestamp();
      step.durationMs = step.completedAt - step.startedAt;
      this.emit('stepCompleted', taskId, step);
      this.emitEvent(`step:${updates.status}` as Parameters<typeof this.emitEvent>[0], {
        taskId,
        stepId,
      });
    }
  }

  getResult(taskId: string): ExecutionResult | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const startTime = task.startedAt || task.createdAt;
    return {
      taskId: task.id,
      success: task.state === 'completed',
      steps: [...task.steps],
      totalDurationMs: task.completedAt ? task.completedAt - startTime : timestamp() - startTime,
      error: task.error,
    };
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (!canCancel(task.state)) return false;

    this.transitionTo(taskId, 'cancelled');
    return true;
  }

  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== 'running') return false;

    this.transitionTo(taskId, 'paused');
    return true;
  }

  resumeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== 'paused') return false;

    this.transitionTo(taskId, 'queued');
    return true;
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): TaskRecord[] {
    return Array.from(this.tasks.values());
  }

  listByState(state: TaskState): TaskRecord[] {
    return this.listTasks().filter((t) => t.state === state);
  }

  private emitEvent(type: RuntimeEvent['type'], data?: Record<string, unknown>): void {
    const event: RuntimeEvent = {
      type,
      timestamp: timestamp(),
      ...data,
    };
    this.emit('event', event);
  }
}
