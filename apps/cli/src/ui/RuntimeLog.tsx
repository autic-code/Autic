/**
 * RuntimeLog — Structured runtime event and log display.
 * Shows task events, queue events, system events, and errors in a clean format.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface RuntimeLogEntry {
  timestamp: string;
  type: 'task' | 'queue' | 'tool' | 'system' | 'error' | 'watchdog';
  message: string;
  detail?: string;
}

const typeColors: Record<string, string> = {
  task: '#4A9EFF',
  queue: '#8B5CF6',
  tool: '#22C55E',
  system: '#64748B',
  error: '#EF4444',
  watchdog: '#F59E0B',
};

const typeLabels: Record<string, string> = {
  task: 'TASK',
  queue: 'QUEUE',
  tool: 'TOOL',
  system: 'SYS',
  error: 'ERR',
  watchdog: 'WATCH',
};

interface RuntimeLogProps {
  title?: string;
  entries: RuntimeLogEntry[];
  maxDisplay?: number;
}

export function RuntimeLog({ title = 'Runtime Log', entries, maxDisplay = 15 }: RuntimeLogProps) {
  const displayed = entries.slice(-maxDisplay);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ {title}
        </Text>
        <Text dimColor> {entries.length} events</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {displayed.length === 0 ? (
          <Text dimColor>No events yet...</Text>
        ) : (
          displayed.map((entry, index) => {
            const color = typeColors[entry.type] || '#94A3B8';
            const label = typeLabels[entry.type] || '??';

            return (
              <Box key={index}>
                <Text dimColor>{entry.timestamp}</Text>
                <Text color={color}> [{label}]</Text>
                <Text> {entry.message}</Text>
                {entry.detail && <Text dimColor> {entry.detail}</Text>}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
