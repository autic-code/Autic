/**
 * TaskStatusPanel — Live task execution progress display.
 * Shows active tasks, their states, and execution steps in real-time.
 * Minimal and engineering-focused, designed for long-running workflows.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface TaskStatusItem {
  id: string;
  description: string;
  state: 'pending' | 'queued' | 'planning' | 'running' | 'awaiting_tool' | 'completed' | 'failed' | 'retrying' | 'paused' | 'cancelled';
  type: string;
  steps: number;
  completedSteps: number;
  duration?: string;
}

const stateColors: Record<string, string> = {
  pending: '#64748B',
  queued: '#4A9EFF',
  planning: '#8B5CF6',
  running: '#22C55E',
  awaiting_tool: '#F59E0B',
  completed: '#22C55E',
  failed: '#EF4444',
  retrying: '#F59E0B',
  paused: '#94A3B8',
  cancelled: '#64748B',
};

const stateSymbols: Record<string, string> = {
  pending: '○',
  queued: '◷',
  planning: '◎',
  running: '●',
  awaiting_tool: '◉',
  completed: '✓',
  failed: '✗',
  retrying: '⟳',
  paused: '⏸',
  cancelled: '−',
};

interface TaskStatusPanelProps {
  title?: string;
  tasks: TaskStatusItem[];
  maxDisplay?: number;
}

export function TaskStatusPanel({ title = 'Tasks', tasks, maxDisplay = 10 }: TaskStatusPanelProps) {
  const displayed = tasks.slice(0, maxDisplay);
  const activeCount = tasks.filter((t) => ['queued', 'planning', 'running', 'awaiting_tool', 'retrying'].includes(t.state)).length;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ {title}
        </Text>
        <Text dimColor>
          {' '}{tasks.length} total{activeCount > 0 ? ` · ${activeCount} active` : ''}
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {displayed.length === 0 ? (
          <Text dimColor>No tasks...</Text>
        ) : (
          displayed.map((task, index) => {
            const color = stateColors[task.state] || '#94A3B8';
            const symbol = stateSymbols[task.state] || '○';
            const progress = task.steps > 0 ? ` [${task.completedSteps}/${task.steps}]` : '';
            const time = task.duration ? ` (${task.duration})` : '';

            return (
              <Box key={task.id || index}>
                <Text color={color}>{symbol}</Text>
                <Text color={color}>{' '}</Text>
                <Text color={color}>{task.description.slice(0, 60)}</Text>
                <Text dimColor>{progress}{time}</Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
