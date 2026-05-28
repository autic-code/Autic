/**
 * LearningPanel — Terminal UI component for engineering learning display.
 *
 * Renders:
 *   - Learning retrieval indicators
 *   - Verified fix status
 *   - Optimization memory usage
 *   - Confidence scoring visibility
 *   - Learning activity indicators
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';

// --- Types ---

export interface LearningDisplay {
  engine: {
    totalEntries: number;
    verifiedEntries: number;
    totalFixes: number;
    avgConfidence: number;
  };
  retrieval: {
    totalHits: number;
    topQueries: Array<{ query: string; count: number }>;
  };
  localLearning: {
    totalWorkspaces: number;
    totalPatterns: number;
  };
  global: {
    totalEntries: number;
    syncEnabled: boolean;
  };
  optimizations: {
    totalOptimizations: number;
    totalSuccesses: number;
    totalFailures: number;
  };
  experienceDB: {
    totalFrameworks: number;
    totalResolutions: number;
    totalRecoveryPatterns: number;
  };
  observability: {
    totalEvents: number;
    recentHits: number;
    recentMisses: number;
  };
}

// --- Helpers ---

function confidenceIndicator(confidence: number): string {
  if (confidence >= 0.8) return `${theme.colors.success}■${theme.colors.text}`;
  if (confidence >= 0.5) return `${theme.colors.warning}■${theme.colors.text}`;
  return `${theme.colors.textDim}■${theme.colors.text}`;
}

function confidenceBar(confidence: number, width = 10): string {
  const filled = Math.round(confidence * width);
  const empty = width - filled;
  const filledStr = theme.colors.success + '█'.repeat(filled) + theme.colors.text;
  const emptyStr = theme.colors.textDim + '░'.repeat(empty) + theme.colors.text;
  return `${filledStr}${emptyStr} ${(confidence * 100).toFixed(0)}%`;
}

// --- Render Functions ---

/**
 * Render full learning panel as a list of strings.
 */
export function renderLearningPanel(display: LearningDisplay): string[] {
  const lines: string[] = [];
  const enabled = display.engine.totalEntries > 0;

  // Header
  lines.push(`${theme.colors.info}${theme.icon.bullet} Learning System${theme.colors.text} ${enabled ? theme.colors.success + 'active' : theme.colors.textDim + 'no data'}${theme.colors.text}`);

  if (!enabled) {
    lines.push(`  ${theme.colors.textDim}No learning data recorded yet. Start a workflow to build operational memory.${theme.colors.text}`);
    return lines;
  }

  // Engine stats
  lines.push(`  ${theme.colors.textDim}Entries:${theme.colors.text} ${display.engine.totalEntries} total, ${display.engine.verifiedEntries} verified`);
  lines.push(`  ${theme.colors.textDim}Avg Confidence:${theme.colors.text} ${confidenceBar(display.engine.avgConfidence)}`);
  lines.push(`  ${theme.colors.textDim}Verified Fixes:${theme.colors.text} ${display.engine.totalFixes}`);

  // Retrieval section
  if (display.retrieval.totalHits > 0) {
    const hitRate = display.retrieval.totalHits > 0
      ? Math.round((display.retrieval.totalHits / Math.max(1, display.retrieval.totalHits + display.observability.recentMisses)) * 100)
      : 0;
    lines.push(`  ${theme.colors.textDim}Retrieval:${theme.colors.text} ${display.retrieval.totalHits} hits ${theme.colors.textDim}(${hitRate}% success rate)${theme.colors.text}`);

    if (display.retrieval.topQueries.length > 0) {
      const topQuery = display.retrieval.topQueries[0];
      lines.push(`    ${theme.colors.textDim}Top query:${theme.colors.text} "${topQuery.query}" ${theme.colors.textDim}(${topQuery.count}x)${theme.colors.text}`);
    }
  }

  // Local learning section
  if (display.localLearning.totalWorkspaces > 0) {
    lines.push(`  ${theme.colors.textDim}Local Learning:${theme.colors.text} ${display.localLearning.totalWorkspaces} workspaces, ${display.localLearning.totalPatterns} patterns`);
  }

  // Global section
  if (display.global.syncEnabled) {
    lines.push(`  ${theme.colors.textDim}Global Intelligence:${theme.colors.text} ${display.global.totalEntries} entries ${theme.colors.textDim}(sync enabled)${theme.colors.text}`);
  } else if (display.global.totalEntries > 0) {
    lines.push(`  ${theme.colors.textDim}Global Intelligence:${theme.colors.text} ${display.global.totalEntries} entries ${theme.colors.textDim}(sync disabled)${theme.colors.text}`);
  }

  // Optimizations section
  if (display.optimizations.totalOptimizations > 0) {
    const successRate = (display.optimizations.totalSuccesses + display.optimizations.totalFailures) > 0
      ? Math.round((display.optimizations.totalSuccesses / Math.max(1, display.optimizations.totalSuccesses + display.optimizations.totalFailures)) * 100)
      : 0;
    lines.push(`  ${theme.colors.textDim}Optimizations:${theme.colors.text} ${display.optimizations.totalOptimizations} entries ${theme.colors.textDim}(${successRate}% success rate)${theme.colors.text}`);
  }

  // Experience DB section
  if (display.experienceDB.totalFrameworks > 0 || display.experienceDB.totalResolutions > 0) {
    lines.push(`  ${theme.colors.textDim}Experience DB:${theme.colors.text} ${display.experienceDB.totalFrameworks} frameworks, ${display.experienceDB.totalResolutions} ${display.experienceDB.totalResolutions === 1 ? 'resolution' : 'resolutions'}, ${display.experienceDB.totalRecoveryPatterns} recovery patterns`);
  }

  // Observability section
  if (display.observability.totalEvents > 0) {
    lines.push(`  ${theme.colors.textDim}Observability:${theme.colors.text} ${display.observability.totalEvents} events logged`);
  }

  return lines;
}

/**
 * Render a compact one-line learning status.
 */
export function compactLearningLine(display: LearningDisplay): string {
  if (display.engine.totalEntries === 0) {
    return `${theme.colors.textDim}Learning: idle${theme.colors.text}`;
  }

  return `${theme.colors.info}${theme.icon.bullet} Learning: ${display.engine.totalEntries} entries, ${display.engine.verifiedEntries} verified, ${confidenceIndicator(display.engine.avgConfidence)} ${(display.engine.avgConfidence * 100).toFixed(0)}% conf${theme.colors.text}`;
}

/**
 * Render confidence for a specific entry.
 */
export function confidenceLine(label: string, confidence: number): string {
  return `  ${label}: ${confidenceIndicator(confidence)} ${confidenceBar(confidence)}`;
}

/**
 * Render retrieval hit status.
 */
export function retrievalLine(query: string, hits: number, total: number): string {
  const rate = total > 0 ? Math.round((hits / total) * 100) : 0;
  const color = rate > 50 ? theme.colors.success : rate > 20 ? theme.colors.warning : theme.colors.textDim;
  return `  Retrieval "${query}": ${color}${hits}/${total} hits (${rate}%)${theme.colors.text}`;
}
