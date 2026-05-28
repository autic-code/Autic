/**
 * CommandArea — Displays executed commands and their output.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface CommandEntry {
  command: string;
  output: string;
  status: 'running' | 'success' | 'error';
  duration?: string;
}

interface CommandAreaProps {
  title: string;
  commands: CommandEntry[];
}

export function CommandArea({ title, commands }: CommandAreaProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ {title}
        </Text>
      </Box>
      {commands.length === 0 ? (
        <Box marginLeft={2}>
          <Text dimColor>No commands executed yet.</Text>
        </Box>
      ) : (
        commands.map((entry, index) => (
          <Box key={index} marginLeft={2} flexDirection="column">
            <Box>
              <Text color="#E2E8F0">$ </Text>
              <Text bold>{entry.command}</Text>
              {entry.duration && (
                <Text dimColor> ({entry.duration})</Text>
              )}
            </Box>
            {entry.output && (
              <Box marginLeft={2}>
                <Text dimColor>{entry.output}</Text>
              </Box>
            )}
            {index < commands.length - 1 && <Box height={1} />}
          </Box>
        ))
      )}
    </Box>
  );
}
