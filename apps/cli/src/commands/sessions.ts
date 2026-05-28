/**
 * autic sessions — Create, list, restore, and inspect sessions.
 * Enhanced with session states, memory stats, and context optimization info.
 */

import { SessionManager, SessionHistory } from '@autic/sessions';
import { WorkspaceMemory, EngineeringMemory } from '@autic/memory';
import { RepoIntelligence, ContextOptimizer } from '@autic/context';

let sessionManager: SessionManager | null = null;
let sessionHistory: SessionHistory | null = null;

async function getManager(): Promise<SessionManager> {
  if (!sessionManager) {
    sessionManager = new SessionManager();
    await sessionManager.init();
  }
  return sessionManager;
}

async function getHistory(): Promise<SessionHistory> {
  if (!sessionHistory) {
    sessionHistory = new SessionHistory();
    await sessionHistory.init();
  }
  return sessionHistory;
}

export async function sessionsCommand(action?: string, name?: string): Promise<void> {
  const manager = await getManager();

  switch (action) {
    case 'create':
      await createAndShowSession(manager, name);
      break;
    case 'restore':
      await restoreSession(manager, name);
      break;
    case 'status':
      await showSessionStatus(manager, name);
      break;
    case 'memory':
      await showMemoryStats(manager, name);
      break;
    case 'context':
      await showContextOptimization(manager, name);
      break;
    default:
      console.log('❯ Autic Sessions\n');
      console.log('  Commands:\n');
      console.log('    autic sessions                    List all sessions');
      console.log('    autic sessions create [name]      Create new session');
      console.log('    autic sessions restore <id>       Restore a session');
      console.log('    autic sessions status [id]        Show session details + memory');
      console.log('    autic sessions memory [id]        Show memory statistics');
      console.log('    autic sessions context [id]       Show context optimization info\n');
      await listAllSessions(manager);
  }
}

export async function createSession(name: string): Promise<import('@autic/sessions').Session> {
  const manager = await getManager();
  const session = await manager.createSession(name, process.cwd());
  return session;
}

async function createAndShowSession(manager: SessionManager, name?: string): Promise<void> {
  const sessionName = name || `session-${Date.now()}`;
  const session = await manager.createSession(sessionName, process.cwd());

  console.log(`  ✓ Session created\n`);
  console.log(`     ID:      ${session.id}`);
  console.log(`     Name:    ${session.name}`);
  console.log(`     Dir:     ${session.workspaceDir}`);
  console.log(`     State:   ${session.state}`);
  console.log(`     Created: ${new Date(session.createdAt).toLocaleString()}\n`);
}

async function listAllSessions(manager: SessionManager): Promise<void> {
  const sessions = manager.listSessions();

  if (sessions.length === 0) {
    console.log('  No sessions found. Create one with: autic sessions create <name>\n');
    return;
  }

  console.log(`  Found ${sessions.length} session(s):\n`);

  for (const session of sessions) {
    const date = new Date(session.updatedAt).toLocaleString();
    const stateIcons: Record<string, string> = {
      active: '●',
      paused: '⏸',
      crashed: '✗',
      completed: '✓',
    };
    const icon = stateIcons[session.state] || '○';
    const stateColor =
      session.state === 'active' ? 'active' : session.state === 'crashed' ? 'failed' : 'idle';

    console.log(`  ${icon} ${session.name}`);
    console.log(`     ID:      ${session.id.slice(0, 16)}...`);
    console.log(`     State:   ${session.state}`);
    console.log(`     Tasks:   ${session.completedTaskCount}/${session.taskCount}`);
    console.log(`     Updated: ${date}\n`);
  }
}

async function restoreSession(manager: SessionManager, id?: string): Promise<void> {
  if (!id) {
    console.log('  Usage: autic sessions restore <session-id>\n');
    return;
  }

  const session = await manager.restoreSession(id);
  if (!session) {
    console.log(`  ✗ Session not found: ${id}\n`);
    return;
  }

  console.log(`  ✓ Session restored\n`);
  console.log(`     ID:    ${session.id}`);
  console.log(`     Name:  ${session.name}`);
  console.log(`     State: ${session.state}`);
  console.log(`     Dir:   ${session.workspaceDir}\n`);
}

async function showSessionStatus(manager: SessionManager, id?: string): Promise<void> {
  const session = id ? manager.getSession(id) : manager.getActiveSession();
  if (!session) {
    console.log('  No active session. Use: autic sessions create <name>\n');
    return;
  }

  console.log(`❯ Session Status — ${session.name}\n`);
  console.log(`     ID:          ${session.id}`);
  console.log(`     State:       ${session.state}`);
  console.log(`     Workspace:   ${session.workspaceId}`);
  console.log(`     Tasks:       ${session.completedTaskCount}/${session.taskCount}`);
  console.log(`     Tokens Used: ${session.totalTokensUsed}`);
  console.log(`     Active:      ${new Date(session.lastActiveAt).toLocaleString()}`);
  console.log(`     Created:     ${new Date(session.createdAt).toLocaleString()}\n`);

  // Show history stats
  const history = await getHistory();
  const timeline = history.getTimeline(session.id, 5);
  if (timeline.length > 0) {
    console.log('  Recent activity:\n');
    for (const entry of timeline.slice(0, 5)) {
      const icon = entry.status === 'completed' ? '✓' : entry.status === 'failed' ? '✗' : '−';
      const time = new Date(entry.startedAt).toLocaleTimeString();
      console.log(`     ${icon} [${time}] ${entry.description.slice(0, 60)}`);
    }
    console.log('');
  }

  // Show workspace memory stats
  try {
    const wsMemory = new WorkspaceMemory(session.workspaceDir);
    const stats = await wsMemory.getStorageStats();
    console.log(
      `  Workspace Memory: ${(stats.totalSizeBytes / 1024).toFixed(1)} KB across ${stats.totalFiles} files\n`,
    );
  } catch {
    // Workspace memory not available yet
  }
}

async function showMemoryStats(manager: SessionManager, id?: string): Promise<void> {
  const session = id ? manager.getSession(id) : manager.getActiveSession();
  if (!session) {
    console.log('  No active session. Use: autic sessions create <name>\n');
    return;
  }

  console.log(`❯ Memory Statistics — ${session.name}\n`);

  // Workspace memory
  try {
    const wsMemory = new WorkspaceMemory(session.workspaceDir);
    await wsMemory.init();
    const wsStats = await wsMemory.getStorageStats();

    const arch = await wsMemory.getArchitecture();
    const repo = await wsMemory.getRepoSummary();
    const taskCount = await wsMemory.getCompletedTaskCount();

    console.log('  Workspace Memory:');
    console.log(`     Files:        ${wsStats.totalFiles}`);
    console.log(`     Size:         ${(wsStats.totalSizeBytes / 1024).toFixed(1)} KB`);
    if (arch) {
      console.log(`     Architecture: ${arch.projectName || 'unknown'}`);
      console.log(`     Framework:    ${arch.framework || 'unknown'}`);
    }
    if (repo) {
      console.log(`     Languages:    ${repo.languages.join(', ')}`);
      console.log(`     Frameworks:   ${repo.frameworks.join(', ')}`);
      console.log(`     Files Scanned: ${repo.totalFiles}`);
    }
    console.log(`     Tasks Saved:  ${taskCount}\n`);
  } catch {
    console.log('  Workspace Memory: not initialized\n');
  }

  // Engineering memory
  try {
    const engMemory = new EngineeringMemory();
    await engMemory.init();
    const engStats = await engMemory.getStorageStats();
    const errorCount = await engMemory.getErrorCount();
    const fixCount = await engMemory.getFixCount();
    const patternCount = await engMemory.getPatternCount();

    console.log('  Engineering Memory:');
    console.log(`     Files:     ${engStats.totalFiles}`);
    console.log(`     Size:      ${(engStats.totalSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`     Errors:    ${errorCount}`);
    console.log(`     Fixes:     ${fixCount}`);
    console.log(`     Patterns:  ${patternCount}\n`);
  } catch {
    console.log('  Engineering Memory: not initialized\n');
  }

  // History stats
  try {
    const history = await getHistory();
    const stats = history.getStats(session.id);

    console.log('  Session History:');
    console.log(`     Total Entries:   ${stats.totalEntries}`);
    console.log(`     Tasks Completed: ${stats.completedTasks}`);
    console.log(`     Tasks Failed:    ${stats.failedTasks}`);
    console.log(`     Commands Run:    ${stats.totalCommands}`);
    console.log(`     Avg Duration:    ${(stats.avgDurationMs / 1000).toFixed(1)}s\n`);
  } catch {
    console.log('  Session History: not available\n');
  }
}

async function showContextOptimization(manager: SessionManager, id?: string): Promise<void> {
  const session = id ? manager.getSession(id) : manager.getActiveSession();
  if (!session) {
    console.log('  No active session. Use: autic sessions create <name>\n');
    return;
  }

  console.log(`❯ Context Optimization — ${session.name}\n`);

  try {
    const optimizer = new ContextOptimizer(session.workspaceDir);
    const budget = await optimizer.getContextBudget();

    console.log('  Token Budget:');
    console.log(`     Total:     ${(budget.totalTokens / 1000).toFixed(0)}K tokens`);
    console.log(`     Used:      ${(budget.usedTokens / 1000).toFixed(0)}K tokens`);
    console.log(`     Remaining: ${(budget.remainingTokens / 1000).toFixed(0)}K tokens\n`);

    console.log('  Breakdown:');
    for (const b of budget.breakdown) {
      const bar = '█'.repeat(Math.round(b.percentage / 5));
      const label = b.category.replace(/_/g, ' ').padEnd(20);
      console.log(`     ${label} ${bar} ${b.percentage}% (${(b.tokens / 1000).toFixed(1)}K)`);
    }

    // Show optimization if we selected files for the task
    const { files, result } = await optimizer.selectFiles('', { maxTokens: 32_000 });
    if (result.filesSelected > 0) {
      console.log(
        `\n  Selected Files:  ${result.filesSelected} / ${result.filesTotal} (${result.reductionPercentage} reduction)\n`,
      );

      for (const file of files.slice(0, 8)) {
        console.log(
          `     ${file.path} (${file.relevanceScore}% relevance, ${(file.tokenCount / 1000).toFixed(1)}K tokens)`,
        );
      }
      if (files.length > 8) {
        console.log(`     ... and ${files.length - 8} more files`);
      }
    }
    console.log('');
  } catch (error) {
    console.log(
      `  ✗ Context optimization error: ${error instanceof Error ? error.message : 'unknown'}\n`,
    );
  }
}
