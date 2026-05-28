/**
 * WorkspaceMemory — Structured persistent workspace intelligence.
 *
 * Stores engineering context in structured files:
 *   architecture.json   — Project architecture summaries
 *   repo-summary.json   — Repo overview and stats
 *   completed-tasks.json — Task completion records
 *   workflow-memory.json — Active goals and recent decisions
 *
 * No raw chat dumps — only structured, token-efficient data.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { timestamp } from '@autic/shared';
import type { ArchitectureMemory, RepoSummary, CompletedTask, WorkflowMemory } from '@autic/shared';

const MEMORY_DIR = join(homedir(), '.autic', 'memory', 'workspace');

export class WorkspaceMemory {
  private basePath: string;

  constructor(workspaceDir?: string) {
    const wsHash = (workspaceDir || process.cwd())
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .slice(0, 40);
    this.basePath = join(MEMORY_DIR, wsHash);
  }

  // ---- Initialization ----

  async init(): Promise<void> {
    try {
      await access(this.basePath);
    } catch {
      await mkdir(this.basePath, { recursive: true });
    }
  }

  // ---- Architecture Memory ----

  async getArchitecture(): Promise<ArchitectureMemory | null> {
    try {
      const data = await readFile(join(this.basePath, 'architecture.json'), 'utf-8');
      return JSON.parse(data) as ArchitectureMemory;
    } catch {
      return null;
    }
  }

  async saveArchitecture(arch: ArchitectureMemory): Promise<void> {
    await this.init();
    arch.updatedAt = timestamp();
    await writeFile(
      join(this.basePath, 'architecture.json'),
      JSON.stringify(arch, null, 2),
      'utf-8',
    );
  }

  async updateArchitecture(updates: Partial<ArchitectureMemory>): Promise<ArchitectureMemory> {
    const current = (await this.getArchitecture()) || {
      projectName: '',
      framework: '',
      packageManager: '',
      language: '',
      keyFiles: [],
      dependencies: [],
      updatedAt: timestamp(),
    };
    Object.assign(current, updates);
    current.updatedAt = timestamp();
    await this.saveArchitecture(current);
    return current;
  }

  // ---- Repo Summary ----

  async getRepoSummary(): Promise<RepoSummary | null> {
    try {
      const data = await readFile(join(this.basePath, 'repo-summary.json'), 'utf-8');
      return JSON.parse(data) as RepoSummary;
    } catch {
      return null;
    }
  }

  async saveRepoSummary(summary: RepoSummary): Promise<void> {
    await this.init();
    summary.detectedAt = timestamp();
    await writeFile(
      join(this.basePath, 'repo-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8',
    );
  }

  // ---- Completed Tasks ----

  async getCompletedTasks(): Promise<CompletedTask[]> {
    try {
      const data = await readFile(join(this.basePath, 'completed-tasks.json'), 'utf-8');
      return JSON.parse(data) as CompletedTask[];
    } catch {
      return [];
    }
  }

  async addCompletedTask(task: CompletedTask): Promise<void> {
    const tasks = await this.getCompletedTasks();
    tasks.push(task);

    // Keep only last 100 completed tasks per workspace
    const trimmed = tasks.slice(-100);

    await writeFile(
      join(this.basePath, 'completed-tasks.json'),
      JSON.stringify(trimmed, null, 2),
      'utf-8',
    );
  }

  async getCompletedTaskCount(): Promise<number> {
    const tasks = await this.getCompletedTasks();
    return tasks.length;
  }

  // ---- Workflow Memory ----

  async getWorkflowMemory(): Promise<WorkflowMemory | null> {
    try {
      const data = await readFile(join(this.basePath, 'workflow-memory.json'), 'utf-8');
      return JSON.parse(data) as WorkflowMemory;
    } catch {
      return null;
    }
  }

  async saveWorkflowMemory(memory: WorkflowMemory): Promise<void> {
    await this.init();
    memory.updatedAt = timestamp();
    await writeFile(
      join(this.basePath, 'workflow-memory.json'),
      JSON.stringify(memory, null, 2),
      'utf-8',
    );
  }

  async addDecision(decision: string, context: string): Promise<void> {
    const memory = (await this.getWorkflowMemory()) || {
      activeGoals: [],
      recentDecisions: [],
      currentContext: '',
      updatedAt: timestamp(),
    };

    memory.recentDecisions.push({ decision, context, timestamp: timestamp() });

    // Keep only last 20 decisions
    if (memory.recentDecisions.length > 20) {
      memory.recentDecisions = memory.recentDecisions.slice(-20);
    }

    await this.saveWorkflowMemory(memory);
  }

  async setGoals(goals: string[]): Promise<void> {
    const memory = (await this.getWorkflowMemory()) || {
      activeGoals: [],
      recentDecisions: [],
      currentContext: '',
      updatedAt: timestamp(),
    };

    memory.activeGoals = goals;
    await this.saveWorkflowMemory(memory);
  }

  async setCurrentContext(context: string): Promise<void> {
    const memory = (await this.getWorkflowMemory()) || {
      activeGoals: [],
      recentDecisions: [],
      currentContext: '',
      updatedAt: timestamp(),
    };

    memory.currentContext = context;
    await this.saveWorkflowMemory(memory);
  }

  // ---- Storage stats ----

  async getStorageStats(): Promise<{ totalFiles: number; totalSizeBytes: number }> {
    let totalSizeBytes = 0;
    let totalFiles = 0;

    const files = [
      'architecture.json',
      'repo-summary.json',
      'completed-tasks.json',
      'workflow-memory.json',
    ];
    for (const file of files) {
      try {
        const data = await readFile(join(this.basePath, file), 'utf-8');
        totalSizeBytes += Buffer.byteLength(data, 'utf-8');
        totalFiles++;
      } catch {
        // File doesn't exist yet
      }
    }

    return { totalFiles, totalSizeBytes };
  }
}
