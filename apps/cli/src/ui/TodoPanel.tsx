/**
 * TodoPanel — Displays a list of tasks/todos during execution.
 * Minimal, structured, engineering-focused.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface TodoItem {
  task: string;
  completed: boolean;
  active?: boolean;
  error?: boolean;
}

interface TodoPanelProps {
  title: string;
  items: TodoItem[];
}

export function TodoPanel({ title, items }: TodoPanelProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ {title}
        </Text>
      </Box>
      {items.map((item, index) => (
        <Box key={index} marginLeft={2}>
          <Text>
            {item.active
              ? '●'
              : item.completed
                ? '✓'
                : item.error
                  ? '✗'
                  : '○'}{' '}
            <Text
              color={
                item.active
                  ? '#4A9EFF'
                  : item.completed
                    ? '#22C55E'
                    : item.error
                      ? '#EF4444'
                      : '#94A3B8'
              }
              dimColor={!item.active && !item.completed && !item.error}
            >
              {item.task}
            </Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}
