/**
 * ProviderError — Structured provider diagnostics and error handling.
 *
 * Classifies provider errors into actionable types, provides retry metadata,
 * and generates user-friendly suggestions.
 */

import { timestamp } from '@autic/shared';
import type { ProviderError, ProviderErrorCode } from '@autic/shared';

export interface ErrorClassificationResult {
  code: ProviderErrorCode;
  retryable: boolean;
  retryAfterMs?: number;
  actionable: boolean;
  suggestion: string;
}

/**
 * Classify an HTTP status code and error message into a structured ProviderError.
 */
export function classifyProviderError(
  _providerId: string,
  statusCode: number,
  message: string,
  modelId?: string,
): ErrorClassificationResult {
  // Rate limit (429)
  if (statusCode === 429) {
    return {
      code: 'rate_limited',
      retryable: true,
      retryAfterMs: extractRetryAfter(message) || 30_000,
      actionable: true,
      suggestion:
        'Provider is rate-limited. Waiting before retrying. Consider adding additional API keys for rotation.',
    };
  }

  // Unauthorized (401)
  if (statusCode === 401) {
    return {
      code: 'auth_failed',
      retryable: false,
      actionable: true,
      suggestion:
        'Invalid API key. Check your provider credentials and update the key with: autic providers add --key <your-key>',
    };
  }

  // Forbidden (403)
  if (statusCode === 403) {
    return {
      code: 'invalid_key',
      retryable: false,
      actionable: true,
      suggestion:
        'API key does not have access to the requested resource. Check your key permissions or top up your account.',
    };
  }

  // Not Found (404)
  if (statusCode === 404) {
    return {
      code: 'model_unavailable',
      retryable: false,
      actionable: true,
      suggestion: modelId
        ? `Model "${modelId}" is not available. Try: autic models list to see available models.`
        : 'The requested resource was not found. Check the provider URL and model ID.',
    };
  }

  // Payment Required / Insufficient Quota (402)
  if (statusCode === 402) {
    return {
      code: 'insufficient_quota',
      retryable: false,
      actionable: true,
      suggestion:
        'Insufficient quota or credits. Top up your account or switch to a different provider.',
    };
  }

  // Server errors (5xx)
  if (statusCode >= 500) {
    return {
      code: 'provider_offline',
      retryable: true,
      retryAfterMs: 10_000,
      actionable: false,
      suggestion: 'Provider server error. This is a temporary issue — retrying automatically.',
    };
  }

  // Default classification based on message content
  if (isTimeoutError(message)) {
    return {
      code: 'timeout',
      retryable: true,
      retryAfterMs: 5_000,
      actionable: false,
      suggestion:
        'Request timed out. The provider may be experiencing high load. Retrying with a longer timeout.',
    };
  }

  if (isNetworkError(message)) {
    return {
      code: 'network_error',
      retryable: true,
      retryAfterMs: 10_000,
      actionable: true,
      suggestion: 'Network error. Check your internet connection or the provider endpoint URL.',
    };
  }

  if (isInvalidRequestError(message)) {
    return {
      code: 'invalid_request',
      retryable: false,
      actionable: true,
      suggestion:
        'Invalid request. This may be caused by an unsupported parameter or message format.',
    };
  }

  // Default: internal error
  return {
    code: 'internal_error',
    retryable: false,
    actionable: false,
    suggestion:
      'An unexpected provider error occurred. Check the provider status with: autic doctor',
  };
}

/**
 * Create a structured ProviderError from a caught error and HTTP response info.
 */
export function createProviderError(
  providerId: string,
  error: unknown,
  statusCode?: number,
  modelId?: string,
): ProviderError {
  const message = error instanceof Error ? error.message : String(error);
  const code = statusCode
    ? classifyProviderError(providerId, statusCode, message, modelId)
    : classifyErrorFromMessage(providerId, message, modelId);

  return {
    code: code.code,
    message,
    providerId,
    modelId,
    statusCode,
    retryable: code.retryable,
    retryAfterMs: code.retryAfterMs,
    actionable: code.actionable,
    suggestion: code.suggestion,
    originalError: message,
    timestamp: timestamp(),
  };
}

/**
 * Format a ProviderError for user-facing display.
 */
export function formatProviderError(error: ProviderError): string {
  const icon = error.retryable ? '○' : '✗';
  const lines: string[] = [`  ${icon} [${error.code}] ${error.message}`];

  if (error.suggestion) {
    lines.push(`     ${error.suggestion}`);
  }

  if (error.retryAfterMs) {
    lines.push(`     Retry after: ${(error.retryAfterMs / 1000).toFixed(0)}s`);
  }

  return lines.join('\n');
}

// ---- Helper functions ----

function extractRetryAfter(message: string): number | undefined {
  // Try to extract retry-after duration from error message
  const matches = message.match(
    /retry\s*(?:after|in)?\s*(?:(\d+)\s*(?:ms|milliseconds|seconds?|s))?/i,
  );
  if (matches?.[1]) {
    const value = parseInt(matches[1], 10);
    if (message.toLowerCase().includes('ms')) return value;
    return value * 1000; // Convert seconds to ms
  }

  // Try rate limit reset timestamp
  const resetMatch = message.match(/(?:reset|retry)_after[=:]\s*(\d+)/i);
  if (resetMatch?.[1]) {
    return parseInt(resetMatch[1], 10) * 1000;
  }

  return undefined;
}

function isTimeoutError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    lower.includes('econnrefused')
  );
}

function isNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('dns') ||
    lower.includes('socket')
  );
}

function isInvalidRequestError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid') ||
    lower.includes('bad request') ||
    lower.includes('unprocessable') ||
    lower.includes('validation')
  );
}

function classifyErrorFromMessage(
  _providerId: string,
  message: string,
  modelId?: string,
): ErrorClassificationResult {
  const lower = message.toLowerCase();

  if (isTimeoutError(message)) {
    return {
      code: 'timeout',
      retryable: true,
      retryAfterMs: 5_000,
      actionable: false,
      suggestion: 'Request timed out. Retrying automatically.',
    };
  }

  if (isNetworkError(message)) {
    return {
      code: 'network_error',
      retryable: true,
      retryAfterMs: 10_000,
      actionable: true,
      suggestion: 'Network error. Check your connection or provider endpoint.',
    };
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      code: 'rate_limited',
      retryable: true,
      retryAfterMs: extractRetryAfter(message) || 30_000,
      actionable: true,
      suggestion: 'Rate limited. Waiting before retrying.',
    };
  }

  if (
    lower.includes('auth') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid key') ||
    lower.includes('api key')
  ) {
    return {
      code: 'auth_failed',
      retryable: false,
      actionable: true,
      suggestion: 'Authentication failed. Check your API key.',
    };
  }

  if (
    lower.includes('quota') ||
    lower.includes('credit') ||
    lower.includes('billing') ||
    lower.includes('insufficient')
  ) {
    return {
      code: 'insufficient_quota',
      retryable: false,
      actionable: true,
      suggestion:
        'Insufficient credits or quota. Top up your account or switch to a different model.',
    };
  }

  if (
    modelId &&
    (lower.includes(modelId.toLowerCase()) ||
      lower.includes('not found') ||
      lower.includes('unavailable'))
  ) {
    return {
      code: 'model_unavailable',
      retryable: false,
      actionable: true,
      suggestion: `Model "${modelId}" is not available. Check available models with: autic models list`,
    };
  }

  return {
    code: 'internal_error',
    retryable: false,
    actionable: false,
    suggestion: 'Unexpected provider error. Run: autic doctor',
  };
}
