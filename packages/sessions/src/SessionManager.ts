/**
 * SessionManager — Manages session lifecycle.
 *
 * NOTE: This is a stub implementation for build compatibility.
 * Full implementation pending.
 */

import { generateId, timestamp } from '@autic/shared';

export class Session {
  readonly id: string;
  name: string;
  workspaceDir: string;
  workspaceId: string;
  state: 'active' | 'paused' | 'crashed' | 'completed';
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  taskCount: number;
  completedTaskCount: number;
  totalTokensUsed: number;
  model?: string;
  provider?: string;

  constructor(name: string, workspaceDir: string) {
    const now = timestamp();
    this.id = generateId();
    this.name = name;
    this.workspaceDir = workspaceDir;
    this.workspaceId = workspaceDir.replace(/[^a-zA-Z0-9]/g, '_');
    this.state = 'active';
    this.createdAt = now;
    this.updatedAt = now;
    this.lastActiveAt = now;
    this.taskCount = 0;
    this.completedTaskCount = 0;
    this.totalTokensUsed = 0;
  }

  setModel(model: string, provider: string): void {
    this.model = model;
    this.provider = provider;
    this.updatedAt = timestamp();
  }
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  async init(): Promise<void> {
    // Stub: no-op
  }

  async createSession(name: string, workspaceDir: string): Promise<Session> {
    const session = new Session(name, workspaceDir);
    this.sessions.set(session.id, session);
    return session;
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getActiveSession(): Session | undefined {
    return Array.from(this.sessions.values()).find((s) => s.state === 'active');
  }

  async restoreSession(id: string): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (session) {
      session.state = 'active';
      session.updatedAt = timestamp();
    }
    return session;
  }
}
