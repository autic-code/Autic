/**
 * Main Ink app layout — Premium minimal blue-themed terminal UI.
 * Composes TodoPanel, StatusArea, StreamingLog, and CommandArea.
 */

import React from 'react';
import { Text, Box, useStdout } from 'ink';
import { TodoPanel } from './TodoPanel.js';
import type { TodoItem } from './TodoPanel.js';
import { StatusArea } from './StatusArea.js';
import type { StatusMetrics } from './StatusArea.js';
import { StreamingLog } from './StreamingLog.js';
import type { LogEntry } from './StreamingLog.js';
import { CommandArea } from './CommandArea.js';
import type { CommandEntry } from './CommandArea.js';

interface AuticAppProps {
  todos?: TodoItem[];
  metrics?: StatusMetrics;
  logs?: LogEntry[];
  commands?: CommandEntry[];
  welcome?: boolean;
}

export function AuticApp({
  todos = [],
  metrics = {
    status: 'idle',
    uptime: '0s',
    activeWorkers: 0,
    queuedTasks: 0,
    memoryUsage: '0 B',
  },
  logs = [],
  commands = [],
  welcome = true,
}: AuticAppProps) {
  const { stdout } = useStdout();
  const columns = stdout?.columns || 80;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="#4A9EFF" marginBottom={1} paddingX={1}>
        <Text bold color="#4A9EFF">
          Autic v0.1.0
        </Text>
        <Text dimColor> — CLI-native autonomous AI engineering runtime</Text>
      </Box>

      {welcome && (
        <Box marginBottom={1} marginLeft={1}>
          <Text dimColor>Type a message or use /help for available commands.</Text>
        </Box>
      )}

      {/* Main content area */}
      <Box flexDirection="column">
        {todos.length > 0 && <TodoPanel title="Tasks" items={todos} />}
        <StatusArea metrics={metrics} />
        <StreamingLog title="Log" entries={logs} />
        <CommandArea title="Commands" commands={commands} />
      </Box>

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="#334155" paddingX={1}>
        <Text dimColor>Press Ctrl+C to exit · /help for commands</Text>
      </Box>
    </Box>
  );
}
