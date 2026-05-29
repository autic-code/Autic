/**
 * AuticApp — Full-screen Ink terminal UI.
 *
 * Premium blue-themed engineering runtime UI with:
 *   - Header branding
 *   - Status bar (Workspace / Provider / Model / Session)
 *   - Todo panel (✓ ⟳ ○ ⚠ ✕)
 *   - Agent panel with active highlight
 *   - Live execution feed
 *   - Always-visible input area at the bottom
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

// ── Types ──────────────────────────────────────────────────────

export type TodoStatus = 'completed' | 'running' | 'pending' | 'blocked' | 'failed';

export interface TodoItem {
  id: string;
  description: string;
  status: TodoStatus;
}

export interface AgentState {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  task?: string;
  model?: string;
}

export interface EventEntry {
  id: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'phase';
  timestamp: number;
}

export interface AppState {
  workspace: string;
  provider: string;
  model: string;
  session: string;
  objective: string;
}

// ── Constants ───────────────────────────────────────────────────

const THEME = {
  primary: '#4A9EFF',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  dim: '#94A3B8',
  muted: '#64748B',
  border: '#334155',
  text: '#E2E8F0',
} as const;

const TODO_ICONS: Record<TodoStatus, { char: string; color: string }> = {
  completed: { char: '✓', color: THEME.success },
  running: { char: '⟳', color: THEME.primary },
  pending: { char: '○', color: THEME.dim },
  blocked: { char: '⚠', color: THEME.warning },
  failed: { char: '✕', color: THEME.error },
};

const AGENT_NAMES = [
  'Research Agent',
  'Planning Agent',
  'Architecture Agent',
  'Engineering Agent',
  'Verification Agent',
  'Repair Agent',
  'Final Review Agent',
] as const;

// ── Mock data generator commands ────────────────────────────────

const TODO_TEMPLATES: Record<string, TodoItem[]> = {
  build: [
    { id: '1', description: 'Analyse Repository', status: 'completed' },
    { id: '2', description: 'Create Build Plan', status: 'completed' },
    { id: '3', description: 'Implement Build', status: 'running' },
    { id: '4', description: 'Verify Build', status: 'pending' },
    { id: '5', description: 'Final Review', status: 'pending' },
  ],
  fix: [
    { id: '1', description: 'Analyse Issues', status: 'completed' },
    { id: '2', description: 'Create Fix Plan', status: 'completed' },
    { id: '3', description: 'Implement Fix', status: 'running' },
    { id: '4', description: 'Verify Fix', status: 'pending' },
    { id: '5', description: 'Final Review', status: 'pending' },
  ],
  default: [
    { id: '1', description: 'Analyse Repository', status: 'completed' },
    { id: '2', description: 'Create Plan', status: 'completed' },
    { id: '3', description: 'Implement Changes', status: 'running' },
    { id: '4', description: 'Verification', status: 'pending' },
    { id: '5', description: 'Final Review', status: 'pending' },
  ],
};

// ── Components ──────────────────────────────────────────────────

/** Small status dot */
function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <Box>
      <Text color={color}>●</Text>
      <Text> </Text>
      <Text color={THEME.dim}>{label}</Text>
    </Box>
  );
}

/** Header bar */
function Header() {
  return (
    <Box borderStyle="round" borderColor={THEME.primary} paddingX={1}>
      <Box flexDirection="column">
        <Box>
          <Text bold color={THEME.primary}>
            AUTIC
          </Text>
          <Text dimColor> — Autonomous AI Engineering Runtime</Text>
        </Box>
      </Box>
    </Box>
  );
}

/** Status bar showing runtime info */
function StatusBar({ state }: { state: AppState }) {
  return (
    <Box flexDirection="row" gap={4} marginY={1} paddingX={1}>
      <StatusDot color={THEME.success} label={`WS: ${state.workspace}`} />
      <StatusDot color={THEME.primary} label={`Provider: ${state.provider}`} />
      <StatusDot color={THEME.primary} label={`Model: ${state.model}`} />
      <StatusDot color={THEME.success} label={`Session: ${state.session}`} />
    </Box>
  );
}

/** Divider line */
function Divider() {
  const { stdout } = useStdout();
  const width = stdout?.columns || 80;
  return <Text color={THEME.border}>{'─'.repeat(Math.max(width - 2, 40))}</Text>;
}

/** Todo panel with 5-state items */
function TodoPanel({ items, title }: { items: TodoItem[]; title?: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={THEME.primary}>
          ❯ {title || 'Tasks'}
        </Text>
      </Box>
      {items.map((item) => {
        const iconDef = TODO_ICONS[item.status];
        const isActive = item.status === 'running';
        return (
          <Box key={item.id} marginLeft={2}>
            <Text color={iconDef.color}>{iconDef.char}</Text>
            <Text> </Text>
            <Text color={isActive ? THEME.primary : undefined} bold={isActive}>
              {item.description}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

/** Agent panel showing active agent highlighted */
function AgentPanel({ agents }: { agents: AgentState[] }) {
  const visible = agents.slice(0, 5);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={THEME.primary}>
          ❯ Agents
        </Text>
      </Box>
      {visible.map((agent) => {
        const isActive = agent.status === 'running';
        const dotColor = isActive
          ? THEME.primary
          : agent.status === 'completed'
            ? THEME.success
            : agent.status === 'failed'
              ? THEME.error
              : THEME.dim;
        const dot = isActive
          ? '●'
          : agent.status === 'completed'
            ? '✓'
            : agent.status === 'failed'
              ? '✕'
              : '○';
        return (
          <Box key={agent.id} marginLeft={2}>
            <Text color={dotColor}>{dot}</Text>
            <Text> </Text>
            <Text color={isActive ? THEME.text : THEME.dim} bold={isActive}>
              {agent.name}
            </Text>
            {agent.task && (
              <Text color={isActive ? THEME.primary : THEME.dim}> — {agent.task.slice(0, 50)}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Live execution feed */
function ExecutionFeed({ events, maxEvents = 8 }: { events: EventEntry[]; maxEvents?: number }) {
  const TOTAL_EVENTS = events.length;
  const clippedCount = Math.max(0, TOTAL_EVENTS - maxEvents);
  const displayed = events.slice(-maxEvents);
  const feedContent =
    displayed.length === 0 ? (
      <Text dimColor>No events yet. Type a command below and press Enter.</Text>
    ) : (
      <>
        {clippedCount > 0 && (
          <Box marginBottom={1}>
            <Text dimColor>
              … {clippedCount} earlier event{clippedCount > 1 ? 's' : ''}
            </Text>
          </Box>
        )}
        {displayed.map((event) => {
          const color =
            event.level === 'success'
              ? THEME.success
              : event.level === 'error'
                ? THEME.error
                : event.level === 'warning'
                  ? THEME.warning
                  : event.level === 'phase'
                    ? THEME.primary
                    : THEME.dim;
          return (
            <Box key={event.id}>
              <Text color={color}>{event.message}</Text>
            </Box>
          );
        })}
      </>
    );

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={THEME.primary}>
          ❯ Execution Feed
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {feedContent}
      </Box>
    </Box>
  );
}

/** Input area — always at the bottom */
function InputArea({
  input,
  setInput,
  onSubmit,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (cmd: string) => void;
}) {
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink cursor every 530ms
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useInput(
    (char, key) => {
      if (key.return) {
        const cmd = input.trim();
        if (cmd) {
          onSubmit(cmd);
          setInput('');
        }
      } else if (key.backspace || key.delete) {
        setInput(input.slice(0, -1));
      } else if (key.ctrl && char === 'c') {
        // Will be handled by process signal
      } else if (!key.ctrl && !key.meta && !key.escape) {
        setInput(input + char);
      }
    },
    { isActive: true },
  );

  return (
    <Box>
      <Text bold color={THEME.primary}>
        ❯
      </Text>
      <Text> </Text>
      <Text>{input}</Text>
      {cursorVisible && <Text color={THEME.primary}>▌</Text>}
    </Box>
  );
}

// ── Helper: generate contextual responses ───────────────────────

function generateEvents(command: string, baseId: string): EventEntry[] {
  const ts = Date.now();
  const lower = command.toLowerCase();

  if (lower.includes('build') || lower.includes('compile')) {
    return [
      { id: `${baseId}-1`, message: 'Repository scanned', level: 'info', timestamp: ts + 100 },
      { id: `${baseId}-2`, message: 'Dependencies resolved', level: 'info', timestamp: ts + 300 },
      { id: `${baseId}-3`, message: 'Build started', level: 'phase', timestamp: ts + 500 },
      {
        id: `${baseId}-4`,
        message: 'TypeScript compilation passed',
        level: 'success',
        timestamp: ts + 1200,
      },
      { id: `${baseId}-5`, message: 'Build complete', level: 'success', timestamp: ts + 1500 },
    ];
  }

  if (lower.includes('fix') || lower.includes('repair') || lower.includes('error')) {
    return [
      { id: `${baseId}-1`, message: 'Repository analysed', level: 'info', timestamp: ts + 100 },
      {
        id: `${baseId}-2`,
        message: 'Issues identified: 3 files affected',
        level: 'info',
        timestamp: ts + 400,
      },
      { id: `${baseId}-3`, message: 'Fix plan created', level: 'phase', timestamp: ts + 600 },
      { id: `${baseId}-4`, message: 'Editing src/app.ts', level: 'info', timestamp: ts + 900 },
      {
        id: `${baseId}-5`,
        message: 'Fix applied successfully',
        level: 'success',
        timestamp: ts + 1400,
      },
    ];
  }

  if (lower.includes('test') || lower.includes('verify') || lower.includes('check')) {
    return [
      { id: `${baseId}-1`, message: 'Running test suite', level: 'info', timestamp: ts + 100 },
      {
        id: `${baseId}-2`,
        message: 'Unit tests: 42 passed, 0 failed',
        level: 'success',
        timestamp: ts + 800,
      },
      {
        id: `${baseId}-3`,
        message: 'Integration tests: 12 passed',
        level: 'success',
        timestamp: ts + 1200,
      },
      { id: `${baseId}-4`, message: 'Verification passed', level: 'success', timestamp: ts + 1500 },
    ];
  }

  if (lower.includes('deploy') || lower.includes('release') || lower.includes('publish')) {
    return [
      {
        id: `${baseId}-1`,
        message: 'Pre-deployment checks passed',
        level: 'info',
        timestamp: ts + 100,
      },
      { id: `${baseId}-2`, message: 'Artifact built', level: 'info', timestamp: ts + 400 },
      {
        id: `${baseId}-3`,
        message: 'Deploying to production',
        level: 'phase',
        timestamp: ts + 700,
      },
      { id: `${baseId}-4`, message: 'Deployment complete', level: 'success', timestamp: ts + 1200 },
      {
        id: `${baseId}-5`,
        message: 'Health checks passing',
        level: 'success',
        timestamp: ts + 1500,
      },
    ];
  }

  // Default response
  return [
    {
      id: `${baseId}-1`,
      message: `Processing: "${command.slice(0, 50)}"`,
      level: 'info',
      timestamp: ts + 100,
    },
    {
      id: `${baseId}-2`,
      message: 'Analysing workspace context',
      level: 'info',
      timestamp: ts + 300,
    },
    { id: `${baseId}-3`, message: 'Task queued', level: 'phase', timestamp: ts + 500 },
    { id: `${baseId}-4`, message: 'Execution started', level: 'info', timestamp: ts + 700 },
    { id: `${baseId}-5`, message: 'Task completed', level: 'success', timestamp: ts + 1200 },
  ];
}

function generateTodos(command: string): TodoItem[] {
  const lower = command.toLowerCase();
  if (lower.includes('build')) return TODO_TEMPLATES.build.map((t) => ({ ...t }));
  if (lower.includes('fix') || lower.includes('repair'))
    return TODO_TEMPLATES.fix.map((t) => ({ ...t }));
  return TODO_TEMPLATES.default.map((t) => ({ ...t }));
}

function generateAgents(command: string, baseTime: number): AgentState[] {
  return [
    { id: 'research', name: 'Research Agent', status: 'completed', task: 'Context gathered' },
    { id: 'planning', name: 'Planning Agent', status: 'completed', task: 'Plan created' },
    {
      id: 'architecture',
      name: 'Architecture Agent',
      status: 'completed',
      task: 'Design approved',
    },
    {
      id: 'engineering',
      name: 'Engineering Agent',
      status: 'running',
      task: command.slice(0, 40),
      model: 'gpt-4o',
    },
    { id: 'verification', name: 'Verification Agent', status: 'idle' },
    { id: 'repair', name: 'Repair Agent', status: 'idle' },
    { id: 'review', name: 'Final Review Agent', status: 'idle' },
  ];
}

// ── Main App Component ──────────────────────────────────────────

export function AuticApp() {
  const [state, setState] = useState<AppState>({
    workspace: process.cwd().split('/').pop() || 'unknown',
    provider: 'OpenRouter',
    model: 'auto',
    session: `session-${Date.now().toString(36)}`,
    objective: 'Ready',
  });

  const [todos, setTodos] = useState<TodoItem[]>([
    { id: '0', description: 'Type a command to begin', status: 'pending' },
  ]);

  const [agents, setAgents] = useState<AgentState[]>([
    { id: 'start', name: 'Autic Runtime', status: 'running', task: 'Awaiting your input...' },
  ]);

  const [events, setEvents] = useState<EventEntry[]>([]);

  const [input, setInput] = useState('');

  const eventCounter = useRef(0);

  const handleSubmit = useCallback((command: string) => {
    const baseId = `cmd-${++eventCounter.current}`;

    // Add user command event
    const userEvent: EventEntry = {
      id: `${baseId}-user`,
      message: `❯ ${command}`,
      level: 'info',
      timestamp: Date.now(),
    };
    setEvents((prev) => [...prev, userEvent]);

    // Update objective
    setState((s) => ({ ...s, objective: command }));

    // Generate new todos
    const newTodos = generateTodos(command);
    setTodos(newTodos);

    // Generate agents
    setAgents(generateAgents(command, Date.now()));

    // Stream events in real-time
    const resultEvents = generateEvents(command, baseId);
    resultEvents.forEach((event, i) => {
      setTimeout(() => {
        setEvents((prev) => [...prev, event]);

        // Update todo: mark running item as completed after events progress
        if (i === 2) {
          setTodos((prev) =>
            prev.map((t, idx) => {
              if (idx === 2 && t.status === 'running') {
                return { ...t, status: 'completed' };
              }
              return t;
            }),
          );
        }

        // Update next todo to running
        if (i === 1) {
          setTodos((prev) =>
            prev.map((t, idx) => {
              if (idx === 2) return { ...t, status: 'running' };
              if (idx === 0) return { ...t, status: 'completed' };
              if (idx === 1) return { ...t, status: 'completed' };
              return t;
            }),
          );
        }

        // Advance to verify step
        if (i === 3) {
          setTodos((prev) =>
            prev.map((t, idx) => {
              if (idx === 2) return { ...t, status: 'completed' };
              if (idx === 3) return { ...t, status: 'running' };
              return t;
            }),
          );
        }

        // Completion
        if (i === resultEvents.length - 1) {
          setTodos((prev) =>
            prev.map((t) => {
              if (t.status === 'running' || t.status === 'pending')
                return { ...t, status: 'completed' };
              return t;
            }),
          );
          setAgents((prev) =>
            prev.map((a) => {
              if (a.status === 'running') return { ...a, status: 'completed' };
              return a;
            }),
          );
          setState((s) => ({ ...s, objective: 'Ready' }));
        }
      }, i * 700);
    });
  }, []);

  const { stdout } = useStdout();
  const rows = stdout?.rows || 24;

  // Small-terminal guard
  if (rows < 16) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text bold color={THEME.error}>
          Terminal too small
        </Text>
        <Text dimColor>Autic requires at least 16 rows to display properly.</Text>
        <Text dimColor>Current size: {rows} rows. Resize your terminal and run again.</Text>
        <Box marginTop={1}>
          <Text color={THEME.primary}>autic help</Text>
          <Text dimColor> — Show command reference instead</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0} minHeight={rows}>
      {/* Header */}
      <Header />

      {/* Status Bar */}
      <StatusBar state={state} />

      <Divider />

      {/* Main content — scrollable area */}
      <Box flexGrow={1} flexDirection="column" marginY={1}>
        <TodoPanel items={todos} title="Tasks" />
        <AgentPanel agents={agents} />
        <ExecutionFeed events={events} />
      </Box>

      <Divider />

      {/* Input area — always at bottom */}
      <Box marginY={1}>
        <InputArea input={input} setInput={setInput} onSubmit={handleSubmit} />
      </Box>

      {/* Footer help */}
      <Box>
        <Text dimColor>
          Press{' '}
          <Text bold color={THEME.primary}>
            Enter
          </Text>{' '}
          to run ·{' '}
          <Text bold color={THEME.primary}>
            Ctrl+C
          </Text>{' '}
          to exit
        </Text>
      </Box>
    </Box>
  );
}
