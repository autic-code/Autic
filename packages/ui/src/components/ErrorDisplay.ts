/**
 * ErrorDisplay — Structured error messages for professional CLI experience.
 *
 * Every error includes:
 *   1. What happened (clear message)
 *   2. Why it happened (possible causes)
 *   3. What to do next (recommended actions)
 *
 * All output is plain text strings — lightweight, no framework dependencies.
 */

import { theme } from '../theme.js';
import { divider } from './Text.js';

// --- Types ---

export interface ErrorDisplayConfig {
  title: string;
  message: string;
  causes?: string[];
  actions?: string[];
  docs?: string;
  code?: string;
  level?: 'error' | 'warning' | 'info';
  recoverable?: boolean;
}

// --- Helpers ---

function levelColor(level: 'error' | 'warning' | 'info'): string {
  switch (level) {
    case 'error':
      return theme.colors.error;
    case 'warning':
      return theme.colors.warning;
    case 'info':
      return theme.colors.primary;
  }
}

function levelIcon(level: 'error' | 'warning' | 'info'): string {
  switch (level) {
    case 'error':
      return theme.icon.cross;
    case 'warning':
      return theme.icon.warning;
    case 'info':
      return theme.icon.check;
  }
}

function levelLabel(level: 'error' | 'warning' | 'info'): string {
  switch (level) {
    case 'error':
      return 'Error';
    case 'warning':
      return 'Warning';
    case 'info':
      return 'Information';
  }
}

// --- Render Functions ---

/**
 * Render a structured error block.
 */
export function renderError(config: ErrorDisplayConfig): string[] {
  const lines: string[] = [];
  const level = config.level || 'error';
  const color = levelColor(level);
  const icon = levelIcon(level);
  const label = levelLabel(level);

  // Error header
  lines.push('');
  lines.push(`  ${color}${icon} ${color}[${label}] ${config.title}${theme.colors.text}`);
  lines.push(`  ${divider(56)}`);

  // What happened
  lines.push(`  ${theme.colors.textDim}What happened:${theme.colors.text}`);
  lines.push(`    ${config.message}`);
  lines.push('');

  // Why it happened
  if (config.causes && config.causes.length > 0) {
    lines.push(`  ${theme.colors.textDim}Possible causes:${theme.colors.text}`);
    for (const cause of config.causes) {
      lines.push(`    ${theme.colors.textDim}•${theme.colors.text} ${cause}`);
    }
    lines.push('');
  }

  // What to do
  if (config.actions && config.actions.length > 0) {
    lines.push(`  ${theme.colors.textDim}Suggested actions:${theme.colors.text}`);
    for (const action of config.actions) {
      lines.push(`    ${theme.colors.primary}→${theme.colors.text} ${action}`);
    }
    lines.push('');
  }

  // Code reference
  if (config.code) {
    lines.push(`  ${theme.colors.textDim}Reference:${theme.colors.text} ${config.code}`);
  }

  // Docs link
  if (config.docs) {
    const docsColor = config.recoverable !== false ? theme.colors.primary : theme.colors.textDim;
    const docsAction = config.recoverable !== false ? 'For more help:' : 'See:';
    lines.push(
      `  ${theme.colors.textDim}${docsAction}${theme.colors.text} ${docsColor}${config.docs}${theme.colors.text}`,
    );
  }

  // Recoverable hint
  if (config.recoverable === true) {
    lines.push(
      `  ${theme.colors.success}This issue is recoverable. Continuing...${theme.colors.text}`,
    );
  } else if (config.recoverable === false) {
    lines.push(`  ${theme.colors.error}This issue is not recoverable.${theme.colors.text}`);
  }

  lines.push(`  ${divider(56)}`);
  lines.push('');

  return lines;
}

/**
 * Render a compact error line (for inline display).
 */
export function compactError(title: string, level: 'error' | 'warning' | 'info' = 'error'): string {
  const color = levelColor(level);
  const icon = levelIcon(level);
  return `  ${color}${icon} ${title}${theme.colors.text}`;
}

/**
 * Render a provider error with specific suggestions.
 */
export function providerError(providerName: string, errorMessage: string): string[] {
  return renderError({
    title: `Provider unavailable: ${providerName}`,
    message: errorMessage,
    level: 'error',
    causes: [
      'Provider API key is missing or invalid',
      'Provider is experiencing an outage',
      'Rate limit exceeded',
      'Network connectivity issue',
    ],
    actions: [
      `Run ${theme.colors.primary}autic providers check${theme.colors.text} to test connectivity`,
      `Run ${theme.colors.primary}autic doctor${theme.colors.text} to diagnose environment issues`,
      `Try ${theme.colors.primary}autic providers add ${providerName} --key <key>${theme.colors.text} to reconfigure`,
      'Check your network connection and proxy settings',
    ],
    docs: 'https://autic.dev/docs/providers',
    recoverable: true,
  });
}

/**
 * Render a configuration error with specific suggestions.
 */
export function configError(key: string, errorMessage: string): string[] {
  return renderError({
    title: `Configuration error: ${key}`,
    message: errorMessage,
    level: 'error',
    causes: [
      'Configuration value is missing or malformed',
      'Config file is corrupted',
      'Permission issue accessing config file',
    ],
    actions: [
      `Run ${theme.colors.primary}autic config get ${key}${theme.colors.text} to check current value`,
      `Run ${theme.colors.primary}autic config set ${key} <value>${theme.colors.text} to set a new value`,
      `Run ${theme.colors.primary}autic doctor${theme.colors.text} to verify environment`,
    ],
    docs: 'https://autic.dev/docs/configuration',
    recoverable: true,
  });
}

/**
 * Render a workflow error with specific suggestions.
 */
export function workflowError(errorMessage: string): string[] {
  return renderError({
    title: 'Workflow execution error',
    message: errorMessage,
    level: 'error',
    causes: [
      'Provider returned an error during execution',
      'Tool execution failed',
      'Workflow timeout exceeded',
      'Context size limit reached',
    ],
    actions: [
      `Try again with ${theme.colors.primary}--verbose${theme.colors.text} to see detailed events`,
      `Increase timeout with ${theme.colors.primary}--timeout <ms>${theme.colors.text}`,
      `Run ${theme.colors.primary}autic doctor${theme.colors.text} to check provider health`,
    ],
    docs: 'https://autic.dev/docs/workflows',
    recoverable: true,
  });
}

/**
 * Render a session/initalization toast message.
 */
export function toast(
  message: string,
  level: 'success' | 'error' | 'warning' | 'info' = 'info',
): string {
  const colors: Record<string, string> = {
    success: theme.colors.success,
    error: theme.colors.error,
    warning: theme.colors.warning,
    info: theme.colors.primary,
  };
  const icons: Record<string, string> = {
    success: theme.icon.check,
    error: theme.icon.cross,
    warning: theme.icon.warning,
    info: theme.icon.arrow,
  };
  const color = colors[level];
  const icon = icons[level];
  return `  ${color}${icon} ${message}${theme.colors.text}`;
}
