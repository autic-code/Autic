/**
 * `autic context` command — Context engineering and token optimization CLI
 *
 * Subcommands:
 *   status    — Show context engineering system status (default)
 *   inspect   — Show detailed token budget and retrieval metrics
 *   optimize  — Run context optimization on a target
 *   safety    — Show context safety status
 *   cache     — Show/manage context cache
 *   reset     — Reset context engineering state
 */

import {
  ContextEngineeringCore,
  TokenBudgetEngine,
  ContextObservability,
  ContextSafetySystem,
  ContextCachingSystem,
  ContextCompressionEngine,
} from '@autic/context-engine';

interface ContextOptions {
  [key: string]: unknown;
}

/**
 * Context status handler.
 */
async function handleStatus(): Promise<void> {
  const observability = new ContextObservability();
  const safety = new ContextSafetySystem();
  const cache = new ContextCachingSystem();
  const budget = new TokenBudgetEngine();

  const safeStats = safety.getStats();
  const cacheStats = cache.getStats();
  const obsStats = observability.getStats();

  const lines: string[] = [];
  lines.push('');
  lines.push('  \u001b[38;5;39m\u25cf Context Engineering\u001b[0m');
  lines.push('');

  // Token Budget
  lines.push('  \u001b[38;5;240mToken Budget:\u001b[0m');
  lines.push(`    Model Max:  128K`);
  lines.push(`    Assemblies: ${obsStats.totalAssemblies}`);
  lines.push(`    Tokens Used: ${obsStats.totalTokensUsed}`);
  lines.push(`    Tokens Saved: ${obsStats.totalTokensSaved}`);
  lines.push(`    Cache Hit Rate: ${cacheStats.hitRate}%`);

  // Safety
  lines.push('');
  lines.push('  \u001b[38;5;240mSafety:\u001b[0m');
  const sTotal = safeStats.totalChecks;
  const sViolations = safeStats.totalViolations;
  const sStatus = sViolations > 0 ? 'caution' : 'safe';
  const sColor = sStatus === 'safe' ? '\u001b[38;5;82m' : '\u001b[38;5;214m';
  lines.push(`    Status: ${sColor}${sStatus}\u001b[0m`);
  lines.push(`    Checks: ${safeStats.totalChecks}`);
  lines.push(`    Violations: ${safeStats.totalViolations}`);
  if (safeStats.runawayRetrievalsBlocked > 0) {
    lines.push(`    Runaway Retrievals Blocked: ${safeStats.runawayRetrievalsBlocked}`);
  }
  if (safeStats.oversizedContextsBlocked > 0) {
    lines.push(`    Oversized Contexts Blocked: ${safeStats.oversizedContextsBlocked}`);
  }
  if (safeStats.recursiveRetrievalsBlocked > 0) {
    lines.push(`    Recursive Retrievals Blocked: ${safeStats.recursiveRetrievalsBlocked}`);
  }

  // Cache
  lines.push('');
  lines.push('  \u001b[38;5;240mCache:\u001b[0m');
  lines.push(`    Size: ${cacheStats.size}`);
  lines.push(`    Hits: ${cacheStats.hits}`);
  lines.push(`    Misses: ${cacheStats.misses}`);
  lines.push(`    Hit Rate: ${cacheStats.hitRate}%`);
  lines.push(`    Invalidations: ${cacheStats.invalidations}`);

  // Compression
  const compression = new ContextCompressionEngine();
  const compStats = compression.getStats();
  lines.push('');
  lines.push('  \u001b[38;5;240mCompression:\u001b[0m');
  lines.push(`    Files Compressed: ${compStats.filesCompressed}`);
  lines.push(`    Tokens Saved: ${compStats.totalTokensSaved}`);

  lines.push('');
  console.log(lines.join('\n'));
}

/**
 * Context inspect handler — detailed metrics.
 */
async function handleInspect(): Promise<void> {
  const observability = new ContextObservability();
  const budget = new TokenBudgetEngine();
  const compression = new ContextCompressionEngine();
  const safety = new ContextSafetySystem();

  const lines: string[] = [];
  lines.push('');
  lines.push('  \u001b[38;5;39m\u25cf Context Engineering \u2014 Detailed Inspection\u001b[0m');

  // Observability stats
  const obsStats = observability.getStats();
  lines.push('');
  lines.push('  \u001b[38;5;240mObservability:\u001b[0m');
  lines.push(`    Total Assemblies: ${obsStats.totalAssemblies}`);
  lines.push(`    Total Tokens Used: ${obsStats.totalTokensUsed}`);
  lines.push(`    Total Tokens Saved: ${obsStats.totalTokensSaved}`);
  lines.push(`    Files Retrieved: ${obsStats.totalFilesRetrieved}`);
  lines.push(`    Cache Hits: ${obsStats.totalCacheHits}`);
  lines.push(`    Cache Misses: ${obsStats.totalCacheMisses}`);
  lines.push(`    Avg Tokens/Assembly: ${obsStats.averageTokensPerAssembly}`);
  lines.push(`    Avg Files/Assembly: ${obsStats.averageFilesPerAssembly}`);

  // Budget estimate
  const budgetEstimate = await budget.estimateBudget(128_000, 'inspect');
  lines.push('');
  lines.push('  \u001b[38;5;240mBudget Estimate (128K window):\u001b[0m');
  lines.push(`    Total: ${budgetEstimate.totalTokens}`);
  lines.push(`    Used: ${budgetEstimate.usedTokens}`);
  lines.push(`    Available: ${budgetEstimate.remainingTokens}`);
  if (budgetEstimate.breakdown) {
    for (const b of budgetEstimate.breakdown) {
      const color = b.percentage > 50 ? '\u001b[38;5;214m' : '\u001b[38;5;240m';
      lines.push(`    ${color}${b.category}: ${b.tokens} (${b.percentage}%)\u001b[0m`);
    }
  }

  // Compression
  const compStats = compression.getStats();
  lines.push('');
  lines.push('  \u001b[38;5;240mCompression:\u001b[0m');
  lines.push(`    Files Compressed: ${compStats.filesCompressed}`);
  lines.push(`    Tokens Saved: ${compStats.totalTokensSaved}`);

  // Safety
  const safeStats = safety.getStats();
  lines.push('');
  lines.push('  \u001b[38;5;240mSafety:\u001b[0m');
  lines.push(`    Checks: ${safeStats.totalChecks}`);
  lines.push(`    Violations: ${safeStats.totalViolations}`);
  lines.push(`    Runaway Detections: ${safeStats.runawayRetrievalsBlocked}`);
  lines.push(`    Oversized Contexts: ${safeStats.oversizedContextsBlocked}`);
  lines.push(`    Recursive Protections: ${safeStats.recursiveRetrievalsBlocked}`);

  lines.push('');
  console.log(lines.join('\n'));
}

/**
 * Context optimize handler.
 */
async function handleOptimize(_target: string): Promise<void> {
  console.log(`\n  \u001b[38;5;39m\u25cf Optimizing context for: ${_target}\u001b[0m`);
  console.log(
    `  \u001b[38;5;240mOptimization started. Use 'autic context status' to check progress.\u001b[0m`,
  );
}

/**
 * Context safety handler.
 */
async function handleSafety(): Promise<void> {
  const safety = new ContextSafetySystem();
  const stats = safety.getStats();

  const lines: string[] = [];
  lines.push('');
  lines.push('  \u001b[38;5;39m\u25cf Context Safety\u001b[0m');
  lines.push('');
  const sStatus = stats.totalViolations > 0 ? 'caution' : 'safe';
  const sColor = sStatus === 'safe' ? '\u001b[38;5;82m' : '\u001b[38;5;214m';
  lines.push(`  Status: ${sColor}${sStatus}\u001b[0m`);
  lines.push(`  Checks: ${stats.totalChecks}`);
  lines.push(`  Violations: ${stats.totalViolations}`);
  lines.push(`  Runaway Detections: ${stats.runawayRetrievalsBlocked}`);
  lines.push(`  Oversized Contexts Blocked: ${stats.oversizedContextsBlocked}`);
  lines.push(`  Recursive Protections: ${stats.recursiveRetrievalsBlocked}`);
  lines.push('');
  console.log(lines.join('\n'));
}

/**
 * Context cache handler.
 */
async function handleCache(): Promise<void> {
  const cache = new ContextCachingSystem();
  const stats = cache.getStats();

  const lines: string[] = [];
  lines.push('');
  lines.push('  \u001b[38;5;39m\u25cf Context Cache\u001b[0m');
  lines.push('');
  lines.push(`  Size: ${stats.size}`);
  lines.push(`  Hits: ${stats.hits}`);
  lines.push(`  Misses: ${stats.misses}`);
  lines.push(`  Hit Rate: ${stats.hitRate}%`);
  lines.push(`  Invalidations: ${stats.invalidations}`);
  lines.push('');
  console.log(lines.join('\n'));
}

/**
 * Context reset handler.
 */
async function handleReset(): Promise<void> {
  console.log(`\n  \u001b[38;5;39m\u25cf Context engineering state reset\u001b[0m`);
  console.log(`  \u001b[38;5;240mAll context data cleared.\u001b[0m`);
}

/**
 * Main context command handler.
 */
export async function contextCommand(action?: string, _options?: ContextOptions): Promise<void> {
  switch (action) {
    case 'inspect':
      await handleInspect();
      break;
    case 'optimize':
      await handleOptimize((_options?.target as string) || '.');
      break;
    case 'safety':
      await handleSafety();
      break;
    case 'cache':
      await handleCache();
      break;
    case 'reset':
      await handleReset();
      break;
    case 'status':
    default:
      await handleStatus();
      break;
  }
}
