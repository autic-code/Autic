/**
 * CLI constants
 */

export const CLI_NAME = 'autic';
export const CLI_VERSION = '0.1.0';
export const CLI_DESCRIPTION = 'Autic — CLI-native autonomous AI engineering runtime';

export const DEFAULT_DATA_DIR = '.autic';
export const DEFAULT_SESSIONS_DIR = 'sessions';
export const DEFAULT_MEMORY_DIR = 'memory';

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE_ERROR: 2,
  ABORTED: 130,
} as const;
