/**
 * StreamingLog — Displays real-time streaming log output.
 * Shows timestamped log entries in a scrollable list.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'system';
  message: string;
}

interface StreamingLogProps {
  title: string;
  entries: LogEntry[];
  maxDisplay?: number;
}

const levelColors: Record<string, string> = {
  info: '#94A3B8',
  warn: '#F59E0B',
  error: '#EF4444',
  debug: '#64748B',
  system: '#4A9EFF',
};

export function StreamingLog({ title, entries, maxDisplay = 50 }: StreamingLogProps) {
  const displayed = entries.slice(-maxDisplay);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ {title}
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {displayed.length === 0 ? (
          <Text dimColor>No output yet...</Text>
        ) : (
          displayed.map((entry, index) => (
            <Box key={index}>
              <Text dimColor>{entry.timestamp}</Text>
              <Text color={levelColors[entry.level]}> {entry.message}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
