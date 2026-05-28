/**
 * ContextPanel — Terminal UI component for context engineering display (#13)
 *
 * Renders:
 *   - Token budget status and utilization
 *   - Retrieval statistics and selected files
 *   - Compression metrics and savings
 *   - Cache effectiveness
 *   - Safety status
 *   - Long-workflow context stability
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 * Follows the same pattern as SwarmPanel.ts and LearningPanel.ts.
 */

import { theme } from '../theme.js';

// --- Types ---

export interface ContextDisplay {
  core: {
    active: boolean;
    totalAssemblies: number;
    totalTokensProcessed: number;
    totalSavings: number;
  };
  budget: {
    modelMaxTokens: number;
    allocated: number;
    used: number;
    available: number;
    utilizationPercent: number;
    overflowPrevented: number;
    providerBudgets: Array<{ provider: string; limit: number; used: number }>;
  };
  retrieval: {
    totalRetrievals: number;
    selectedFiles: number;
    maxFiles: number;
    cacheHits: number;
    cacheMisses: number;
    hitRatePercent: number;
    topFiles?: Array<{ path: string; relevance: number }>;
  };
  compression: {
    totalCompressions: number;
    originalTokens: number;
    compressedTokens: number;
    savingsPercent: number;
    staleEntriesCleaned: number;
  };
  safety: {
    overflowPrevented: number;
    runawayDetections: number;
    recursiveProtections: number;
    status: string;
    isThrottled: boolean;
  };
  longWorkflow: {
    totalSummarizations: number;
    idleCleanups: number;
    staleEntriesPruned: number;
    isSummarized: boolean;
  };
}

// --- Helpers ---

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function utilizationBar(percent: number, width = 15): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const color =
    percent > 90
      ? theme.colors.error
      : percent > 70
        ? theme.colors.warning
        : percent > 40
          ? theme.colors.primary
          : theme.colors.success;
  const filledStr = color + '█'.repeat(filled) + theme.colors.text;
  const emptyStr = theme.colors.textDim + '░'.repeat(empty) + theme.colors.text;
  return `${filledStr}${emptyStr} ${percent.toFixed(0)}%`;
}

function savingsBar(savingsPercent: number, width = 10): string {
  const filled = Math.round((savingsPercent / 100) * width);
  const empty = width - filled;
  const color =
    savingsPercent > 50
      ? theme.colors.success
      : savingsPercent > 25
        ? theme.colors.primary
        : theme.colors.textDim;
  const filledStr = color + '▓'.repeat(filled) + theme.colors.text;
  const emptyStr = theme.colors.textDim + '░'.repeat(empty) + theme.colors.text;
  return `${filledStr}${emptyStr} ${savingsPercent.toFixed(0)}% saved`;
}

function safetyStatusColor(status: string): string {
  switch (status) {
    case 'safe':
      return theme.colors.success;
    case 'caution':
      return theme.colors.warning;
    case 'throttled':
      return theme.colors.error;
    default:
      return theme.colors.textMuted;
  }
}

// --- Render Functions ---

/**
 * Render the full context engineering panel as a list of strings.
 */
export function renderContextPanel(display: ContextDisplay): string[] {
  const lines: string[] = [];
  const headerColor = display.core.active ? theme.colors.primary : theme.colors.textDim;

  // Header
  lines.push(
    `${theme.icon.bullet} ${headerColor}Context Engineering${theme.colors.text} ${display.core.active ? theme.colors.success + 'active' : theme.colors.textDim + 'inactive'}${theme.colors.text}`,
  );

  if (!display.core.active && display.core.totalAssemblies === 0) {
    lines.push(
      `  ${theme.colors.textDim}No context data recorded yet. Start a workflow to build token optimization stats.${theme.colors.text}`,
    );
    return lines;
  }

  // Core stats
  lines.push(
    `  ${theme.colors.textDim}Assemblies:${theme.colors.text} ${display.core.totalAssemblies}  ${theme.colors.textDim}Tokens Processed:${theme.colors.text} ${formatTokens(display.core.totalTokensProcessed)}  ${theme.colors.textDim}Total Savings:${theme.colors.text} ${formatTokens(display.core.totalSavings)}`,
  );

  // Divider
  lines.push(`  ${theme.colors.textDim}${theme.icon.divider.repeat(40)}${theme.colors.text}`);

  // --- Token Budget Section ---
  lines.push(`  ${theme.colors.textDim}Token Budget:${theme.colors.text}`);
  lines.push(
    `    ${theme.colors.textDim}Model Limit:${theme.colors.text} ${formatTokens(display.budget.modelMaxTokens)}  ${theme.colors.textDim}Allocated:${theme.colors.text} ${formatTokens(display.budget.allocated)}  ${theme.colors.textDim}Used:${theme.colors.text} ${formatTokens(display.budget.used)}  ${theme.colors.textDim}Available:${theme.colors.text} ${formatTokens(display.budget.available)}`,
  );
  lines.push(
    `    ${theme.colors.textDim}Utilization:${theme.colors.text} ${utilizationBar(display.budget.utilizationPercent)}`,
  );
  if (display.budget.overflowPrevented > 0) {
    lines.push(
      `    ${theme.icon.check} ${theme.colors.success}${display.budget.overflowPrevented} overflows prevented${theme.colors.text}`,
    );
  }

  // Provider budgets
  if (display.budget.providerBudgets.length > 0) {
    for (const pb of display.budget.providerBudgets) {
      const pbPercent = pb.limit > 0 ? Math.round((pb.used / pb.limit) * 100) : 0;
      const pbColor =
        pbPercent > 90
          ? theme.colors.error
          : pbPercent > 70
            ? theme.colors.warning
            : theme.colors.textDim;
      lines.push(
        `    ${theme.colors.textDim}${pb.provider}:${theme.colors.text} ${formatTokens(pb.used)} / ${formatTokens(pb.limit)} ${pbColor}(${pbPercent}%)${theme.colors.text}`,
      );
    }
  }

  // --- Retrieval Section ---
  lines.push(`  ${theme.colors.textDim}File Retrieval:${theme.colors.text}`);
  const hitColor =
    display.retrieval.hitRatePercent > 50
      ? theme.colors.success
      : display.retrieval.hitRatePercent > 20
        ? theme.colors.warning
        : theme.colors.textDim;
  lines.push(
    `    ${theme.colors.textDim}Retrievals:${theme.colors.text} ${display.retrieval.totalRetrievals}  ${theme.colors.textDim}Files:${theme.colors.text} ${display.retrieval.selectedFiles} / ${display.retrieval.maxFiles}  ${theme.colors.textDim}Cache:${theme.colors.text} ${display.retrieval.cacheHits}h / ${display.retrieval.cacheMisses}m ${hitColor}(${display.retrieval.hitRatePercent}%)${theme.colors.text}`,
  );

  if (display.retrieval.topFiles && display.retrieval.topFiles.length > 0) {
    const maxRelevance = Math.max(...display.retrieval.topFiles.map((f) => f.relevance), 1);
    for (const file of display.retrieval.topFiles.slice(0, 5)) {
      const barLen = Math.round((file.relevance / maxRelevance) * 10);
      const bar = theme.colors.info + '─'.repeat(barLen) + theme.colors.text;
      lines.push(
        `      ${bar} ${file.relevance.toFixed(0)}% ${theme.colors.textDim}${file.path}${theme.colors.text}`,
      );
    }
  }

  // --- Compression Section ---
  if (display.compression.totalCompressions > 0) {
    lines.push(`  ${theme.colors.textDim}Context Compression:${theme.colors.text}`);
    lines.push(
      `    ${theme.colors.textDim}Compressions:${theme.colors.text} ${display.compression.totalCompressions}  ${theme.colors.textDim}Original:${theme.colors.text} ${formatTokens(display.compression.originalTokens)}  ${theme.colors.textDim}Compressed:${theme.colors.text} ${formatTokens(display.compression.compressedTokens)}`,
    );
    lines.push(
      `    ${theme.colors.textDim}Savings:${theme.colors.text} ${savingsBar(display.compression.savingsPercent)}`,
    );
    if (display.compression.staleEntriesCleaned > 0) {
      lines.push(
        `    ${theme.colors.textDim}Stale entries cleaned:${theme.colors.text} ${display.compression.staleEntriesCleaned}`,
      );
    }
  }

  // --- Safety Section ---
  const sColor = safetyStatusColor(display.safety.status);
  lines.push(
    `  ${theme.colors.textDim}Context Safety:${theme.colors.text} ${sColor}${display.safety.status}${theme.colors.text}`,
  );
  if (
    display.safety.overflowPrevented > 0 ||
    display.safety.runawayDetections > 0 ||
    display.safety.recursiveProtections > 0
  ) {
    lines.push(
      `    ${theme.colors.textDim}Overflows prevented:${theme.colors.text} ${display.safety.overflowPrevented}  ${theme.colors.textDim}Runaway detections:${theme.colors.text} ${display.safety.runawayDetections}  ${theme.colors.textDim}Recursive protections:${theme.colors.text} ${display.safety.recursiveProtections}`,
    );
  }
  if (display.safety.isThrottled) {
    lines.push(
      `    ${theme.icon.warning} ${theme.colors.warning}Context retrieval throttled${theme.colors.text}`,
    );
  }

  // --- Long Workflow Section ---
  if (display.longWorkflow.totalSummarizations > 0) {
    lines.push(`  ${theme.colors.textDim}Long-Workflow Context:${theme.colors.text}`);
    lines.push(
      `    ${theme.colors.textDim}Summarizations:${theme.colors.text} ${display.longWorkflow.totalSummarizations}  ${theme.colors.textDim}Idle Cleanups:${theme.colors.text} ${display.longWorkflow.idleCleanups}  ${theme.colors.textDim}Pruned:${theme.colors.text} ${display.longWorkflow.staleEntriesPruned}`,
    );
    if (display.longWorkflow.isSummarized) {
      lines.push(
        `    ${theme.icon.check} ${theme.colors.success}Context summarized${theme.colors.text}`,
      );
    }
  }

  return lines;
}

/**
 * Render a compact one-line context engineering status.
 */
export function compactContextLine(display: ContextDisplay): string {
  if (!display.core.active && display.core.totalAssemblies === 0) {
    return `${theme.colors.textDim}Context: idle${theme.colors.text}`;
  }

  const budgetColor =
    display.budget.utilizationPercent > 90
      ? theme.colors.error
      : display.budget.utilizationPercent > 70
        ? theme.colors.warning
        : theme.colors.success;

  return `${theme.colors.info}${theme.icon.bullet} Context: ${formatTokens(display.budget.used)}/${formatTokens(display.budget.allocated)} tokens ${budgetColor}(${display.budget.utilizationPercent.toFixed(0)}%)${theme.colors.text}, ${display.retrieval.selectedFiles} files, ${savingsBar(display.compression.savingsPercent)}${theme.colors.text}`;
}

/**
 * Render the token budget utilization line.
 */
export function tokenBudgetLine(label: string, used: number, limit: number): string {
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const color =
    percent > 90 ? theme.colors.error : percent > 70 ? theme.colors.warning : theme.colors.primary;
  return `  ${label}: ${formatTokens(used)} / ${formatTokens(limit)} ${color}(${percent}%)${theme.colors.text} ${utilizationBar(percent, 10)}`;
}

/**
 * Render file selection status line.
 */
export function fileSelectionLine(selected: number, max: number): string {
  const color =
    selected > max * 0.9
      ? theme.colors.warning
      : selected > max * 0.5
        ? theme.colors.primary
        : theme.colors.success;
  return `  ${theme.colors.textDim}Selected Files:${theme.colors.text} ${color}${selected} / ${max}${theme.colors.text}`;
}

/**
 * Render compression savings indicator.
 */
export function compressionSavingsLine(original: number, compressed: number): string {
  const saved = original - compressed;
  const percent = original > 0 ? Math.round((saved / original) * 100) : 0;
  const color =
    percent > 50
      ? theme.colors.success
      : percent > 25
        ? theme.colors.primary
        : theme.colors.textDim;
  return `  ${theme.colors.textDim}Context Reduced:${theme.colors.text} ${color}${percent}%${theme.colors.text} ${theme.colors.textDim}(${formatTokens(original)} → ${formatTokens(compressed)})${theme.colors.text}`;
}

/**
 * Render safety status line.
 */
export function safetyStatusLine(status: string): string {
  const color = safetyStatusColor(status);
  const icon =
    status === 'safe'
      ? theme.icon.check
      : status === 'caution'
        ? theme.icon.dot
        : theme.icon.warning;
  return `  ${theme.colors.textDim}Context Safety:${theme.colors.text} ${color}${icon} ${status}${theme.colors.text}`;
}
