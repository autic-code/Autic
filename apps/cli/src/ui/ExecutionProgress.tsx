/**
 * ExecutionProgress — Real-time execution step progress display.
 * Shows individual tool calls, step status, and execution flow.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface ExecutionStepEntry {
  id: string;
  type: 'tool_call' | 'llm_call' | 'plan' | 'verify' | 'recover';
  toolName?: string;
  input?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: string;
}

const typeIcons: Record<string, string> = {
  tool_call: '🔧',
  llm_call: '🧠',
  plan: '📋',
  verify: '✓',
  recover: '⟳',
};

const statusColors: Record<string, string> = {
  pending: '#64748B',
  running: '#4A9EFF',
  success: '#22C55E',
  failed: '#EF4444',
  skipped: '#64748B',
};

interface ExecutionProgressProps {
  title?: string;
  steps: ExecutionStepEntry[];
  maxDisplay?: number;
}

export function ExecutionProgress({ title = 'Execution Steps', steps, maxDisplay = 20 }: ExecutionProgressProps) {
  const displayed = steps.slice(-maxDisplay);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ {title}
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {displayed.length === 0 ? (
          <Text dimColor>No steps executed yet...</Text>
        ) : (
          displayed.map((step, index) => {
            const icon = typeIcons[step.type] || '•';
            const color = statusColors[step.status] || '#94A3B8';
            const toolInfo = step.toolName ? ` ${step.toolName}` : '';
            const durationInfo = step.duration ? ` (${step.duration})` : '';
            const statusSymbol = step.status === 'running' ? '●' : step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '○';

            return (
              <Box key={step.id || index}>
                <Text color={color}>{statusSymbol}</Text>
                <Text color={color}>{' '}{icon}{toolInfo}</Text>
                {step.input && (
                  <Text dimColor>{' '}{step.input.slice(0, 40)}{step.input.length > 40 ? '...' : ''}</Text>
                )}
                <Text dimColor>{durationInfo}</Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
