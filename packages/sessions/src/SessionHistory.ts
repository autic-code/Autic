/**
 * SessionHistory — Tracks session activity timeline and stats.
 *
 * NOTE: This is a stub implementation for build compatibility.
 * Full implementation pending.
 */

import { timestamp } from '@autic/shared';

export interface TimelineEntry {
  id: string;
  sessionId: string;
  description: string;
  status: 'completed' | 'failed' | 'running';
  startedAt: number;
}

export interface SessionStats {
  totalEntries: number;
  completedTasks: number;
  failedTasks: number;
  totalCommands: number;
  avgDurationMs: number;
}

export class SessionHistory {
  private entries: Map<string, TimelineEntry[]> = new Map();

  async init(): Promise<void> {
    // Stub: no-op
  }

  getTimeline(sessionId: string, limit?: number): TimelineEntry[] {
    const timeline = this.entries.get(sessionId) || [];
    return limit ? timeline.slice(0, limit) : timeline;
  }

  getStats(sessionId: string): SessionStats {
    const timeline = this.entries.get(sessionId) || [];
    return {
      totalEntries: timeline.length,
      completedTasks: timeline.filter((e) => e.status === 'completed').length,
      failedTasks: timeline.filter((e) => e.status === 'failed').length,
      totalCommands: timeline.length,
      avgDurationMs: 0,
    };
  }

  async addEntry(sessionId: string, description: string): Promise<void> {
    const timeline = this.entries.get(sessionId) || [];
    timeline.push({
      id: `${timestamp()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      description,
      status: 'completed',
      startedAt: timestamp(),
    });
    this.entries.set(sessionId, timeline);
  }
}
