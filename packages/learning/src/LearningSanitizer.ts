/**
 * LearningSanitizer — Privacy + sanitization for optional global sync.
 *
 * CRITICAL: Before ANY global sync, this module:
 *   - Sanitizes identifiers (project names, usernames, etc.)
 *   - Removes secrets (API keys, tokens, credentials)
 *   - Removes paths (file system paths, user home directories)
 *   - Removes repo references (URLs, organization names)
 *   - Abstracts patterns into generic, reusable form
 *
 * Example:
 *   BAD:  /home/user/payment-api.ts → Error: TS2304 in payment processing
 *   GOOD: TypeScript API dependency conflict
 */

import type { LearningEntry, SanitizedLearningEntry } from '@autic/shared';

// Patterns for sensitive data detection
const SECRET_PATTERNS = [
  /\b(?:[A-Za-z0-9+/]{40,})\b/g,                         // Potential API keys / tokens
  /\b(?:sk-[A-Za-z0-9]{20,})\b/g,                         // OpenAI-style keys
  /\b(?:pk-[A-Za-z0-9]{20,})\b/g,                         // Public keys
  /\b(?:[A-Za-z0-9+/=]{32,})\b/g,                         // Base64-encoded secrets
  /\b(?:ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{36,}\b/g,  // GitHub tokens
  /\b(?:xox[bpsa]-)[A-Za-z0-9-]{10,}\b/g,                // Slack tokens
];

const PATH_PATTERNS = [
  /\/(?:home|Users|usr|opt|var|tmp)\/[A-Za-z0-9_.-]+/g,   // Unix/macOS paths
  /\b(?:[A-Za-z]:\\[A-Za-z0-9_\\-]+)\b/g,                // Windows paths
  /\b(?:~\/[A-Za-z0-9_./-]+)\b/g,                         // Home directory paths
];

const REPO_PATTERNS = [
  /\b(?:github\.com|gitlab\.com|bitbucket\.org)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g,
  /\b(?:git@)[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g,
];

const IDENTIFIER_PATTERNS = [
  /\b[A-Z][a-z]+[A-Z][a-z]+(?:Inc|Corp|Ltd|LLC|LLP)?\b/g,  // Company names (PascalCase)
  /\b[A-Z]{2,}(?:-[A-Z]{2,})+\b/g,                          // Acronyms like AWS-S3
];

export class LearningSanitizer {
  /**
   * Prepare learning entries for optional global sync.
   * Strips all sensitive data and returns abstract patterns only.
   */
  prepareForSync(entries: LearningEntry[]): SanitizedLearningEntry[] {
    const sanitized: SanitizedLearningEntry[] = [];

    for (const entry of entries) {
      // Only include verified, high-confidence entries
      if (!entry.verified || entry.confidence < 0.6) continue;

      // Only include abstract patterns (not raw errors)
      if (entry.type !== 'pattern' && entry.type !== 'optimization') continue;

      const abstractPattern = this.anonymizeText(entry.description);

      // Skip if pattern is too generic after sanitization
      if (abstractPattern.length < 10) continue;

      sanitized.push({
        abstractPattern,
        type: entry.type,
        frameworks: entry.framework ? [entry.framework] : [],
        confidence: entry.confidence,
        occurrences: 1,
        source: 'global',
      });
    }

    return sanitized;
  }

  /**
   * Sanitize a single text string by removing all sensitive data.
   */
  sanitizeText(text: string): string {
    let cleaned = text;

    // Remove secrets
    for (const pattern of SECRET_PATTERNS) {
      cleaned = cleaned.replace(pattern, '[REDACTED_SECRET]');
    }

    // Remove paths
    for (const pattern of PATH_PATTERNS) {
      cleaned = cleaned.replace(pattern, '[REDACTED_PATH]');
    }

    // Remove repo references
    for (const pattern of REPO_PATTERNS) {
      cleaned = cleaned.replace(pattern, '[REDACTED_REPO]');
    }

    return cleaned;
  }

  /**
   * Anonymize text by extracting the abstract pattern and removing all identifiers.
   */
  anonymizeText(text: string): string {
    let cleaned = this.sanitizeText(text);

    // Remove company/org names
    for (const pattern of IDENTIFIER_PATTERNS) {
      cleaned = cleaned.replace(pattern, '[ORG]');
    }

    // Remove email addresses
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');

    // Remove IP addresses
    cleaned = cleaned.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');

    // Remove version numbers (keep X.Y.Z format as abstract)
    cleaned = cleaned.replace(/\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?/g, '[VERSION]');

    return cleaned;
  }

  /**
   * Verify that no sensitive data remains in a sanitized entry.
   */
  verifySanitized(entry: SanitizedLearningEntry): boolean {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(entry.abstractPattern)) return false;
    }
    for (const pattern of PATH_PATTERNS) {
      if (pattern.test(entry.abstractPattern)) return false;
    }
    for (const pattern of REPO_PATTERNS) {
      if (pattern.test(entry.abstractPattern)) return false;
    }
    return true;
  }
}
