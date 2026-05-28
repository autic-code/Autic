/**
 * StatusArea — Displays runtime metrics like health, uptime, workers, queue.
 */

import React from 'react';
import { Text, Box } from 'ink';

export interface StatusMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'idle';
  uptime: string;
  activeWorkers: number;
  queuedTasks: number;
  memoryUsage: string;
}

interface StatusAreaProps {
  metrics: StatusMetrics;
}

const statusColors: Record<string, string> = {
  healthy: '#22C55E',
  degraded: '#F59E0B',
  unhealthy: '#EF4444',
  idle: '#94A3B8',
};

export function StatusArea({ metrics }: StatusAreaProps) {
  const statusColor = statusColors[metrics.status] || '#94A3B8';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="#4A9EFF">
          ❯ Runtime Status
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="row" gap={2}>
        <Box>
          <Text dimColor>Status: </Text>
          <Text color={statusColor}>{metrics.status}</Text>
        </Box>
        <Box>
          <Text dimColor>Uptime: </Text>
          <Text>{metrics.uptime}</Text>
        </Box>
      </Box>
      <Box marginLeft={2} flexDirection="row" gap={2}>
        <Box>
          <Text dimColor>Workers: </Text>
          <Text>{metrics.activeWorkers}</Text>
        </Box>
        <Box>
          <Text dimColor>Queued: </Text>
          <Text>{metrics.queuedTasks}</Text>
        </Box>
        <Box>
          <Text dimColor>Memory: </Text>
          <Text>{metrics.memoryUsage}</Text>
        </Box>
      </Box>
    </Box>
  );
}
