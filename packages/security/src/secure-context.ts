/**
 * SecureContextGenerator — Safe context assembly for provider payloads.
 *
 * Ensures:
 *   - Only relevant files are included (selective context)
 *   - Secrets are filtered out before assembly
 *   - File paths are sanitized (no absolute paths in prompts)
 *   - Token budget is respected
 *   - Provider payloads are safe and minimal
 *
 * Acts as the final middleware before context is sent to a provider.
 */

import { type SecureContextConfig } from '@autic/shared';
import { Sanitizer } from './sanitizer.js';
import { ProviderSecurityLayer } from './provider-security.js';

export interface ContextFile {
  path: string;
  content: string;
  tokenEstimate: number;
  priority: number;
}

export interface SecureContext {
  assembled: string;
  files: number;
  totalTokens: number;
  redactedFields: number;
  skippedFiles: number;
}

export class SecureContextGenerator {
  private sanitizer: Sanitizer;
  private providerSecurity: ProviderSecurityLayer;

  /** File extensions to exclude from context */
  private readonly EXCLUDED_EXTENSIONS = new Set([
    '.env', '.env.local', '.env.production', '.env.development',
    '.key', '.pem', '.crt', '.cert', '.keystore',
    '.gitconfig', '.netrc', '.npmrc', '.yarnrc',
  ]);

  /** File names to exclude from context */
  private readonly EXCLUDED_FILES = new Set([
    '.env', '.env.local', '.env.example',
    'id_rsa', 'id_ed25519', 'known_hosts',
    '.git-credentials', '.dockerconfigjson',
    'credentials.json', 'service-account.json',
    '.npmrc', '.yarnrc',
  ]);

  /** File patterns to always strip from context */
  private readonly STRIP_PATTERNS = [
    /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
    /(?:api[_-]?key|apikey)\s*[:=]\s*\S+/gi,
    /(?:secret|token)\s*[:=]\s*\S+/gi,
    /(?:auth|authorization)\s*[:=]\s*\S+/gi,
    /BEGIN\s+(?:RSA|EC|OPENSSH)\s+PRIVATE\s+KEY/gi,
  ];

  constructor(sanitizer?: Sanitizer, providerSecurity?: ProviderSecurityLayer) {
    this.sanitizer = sanitizer || new Sanitizer();
    this.providerSecurity = providerSecurity || new ProviderSecurityLayer();
  }

  /**
   * Assemble a secure context from a list of files.
   * Strips secrets, sanitizes paths, and respects token budget.
   */
  async assembleContext(
    files: ContextFile[],
    config: Partial<SecureContextConfig> = {},
  ): Promise<SecureContext> {
    const maxFiles = config.maxFiles || 20;
    const maxTokens = config.maxTokens || 16_000;
    const stripSecrets = config.stripSecrets ?? true;
    const sanitizePaths = config.sanitizePaths ?? true;

    // Sort by priority descending
    const sorted = [...files].sort((a, b) => b.priority - a.priority);

    let assembled = '';
    let totalTokens = 0;
    let redactedFields = 0;
    let skippedFiles = 0;
    let includedCount = 0;

    for (const file of sorted) {
      if (includedCount >= maxFiles) {
        skippedFiles++;
        continue;
      }

      // Check excluded extensions
      const ext = '.' + file.path.split('.').pop()?.toLowerCase();
      if (this.EXCLUDED_EXTENSIONS.has(ext)) {
        skippedFiles++;
        continue;
      }

      // Check excluded file names
      const baseName = file.path.split('/').pop() || '';
      if (this.EXCLUDED_FILES.has(baseName)) {
        skippedFiles++;
        continue;
      }

      // Check token budget
      if (totalTokens + file.tokenEstimate > maxTokens) {
        skippedFiles++;
        continue;
      }

      let fileContent = file.content;

      // Strip secrets
      if (stripSecrets) {
        for (const pattern of this.STRIP_PATTERNS) {
          const matches = fileContent.match(pattern);
          if (matches) {
            redactedFields += matches.length;
            fileContent = fileContent.replace(pattern, '[REDACTED]');
          }
        }

        // Apply sanitizer
        const beforeSanitize = fileContent;
        fileContent = this.sanitizer.sanitize(fileContent);
        if (beforeSanitize !== fileContent) {
          redactedFields++;
        }
      }

      // Sanitize path (remove absolute paths)
      let safePath = file.path;
      if (sanitizePaths) {
        // Remove leading / and replace with relative marker
        safePath = safePath.replace(/^\/+/, '');
        // Strip workspace directory prefix
        safePath = safePath.replace(/^.*?\/src\//, 'src/');
      }

      // Append file to context
      assembled += `\n--- ${safePath} ---\n${fileContent}\n`;
      totalTokens += file.tokenEstimate;
      includedCount++;
    }

    // Final sanitization of the entire assembled context
    const safeAssembled = this.providerSecurity.sanitizePrompt(assembled);

    return {
      assembled: safeAssembled.safeContent,
      files: includedCount,
      totalTokens,
      redactedFields: redactedFields + safeAssembled.redactedFields.length,
      skippedFiles,
    };
  }

  /**
   * Check if a file should be excluded from context.
   */
  isFileExcluded(filePath: string): boolean {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    if (this.EXCLUDED_EXTENSIONS.has(ext)) return true;

    const baseName = filePath.split('/').pop() || '';
    if (this.EXCLUDED_FILES.has(baseName)) return true;

    return false;
  }

  /**
   * Sanitize a single file path for safe display.
   */
  sanitizePath(filePath: string): string {
    // Remove absolute paths, keep relative
    return filePath
      .replace(/^\/+/, '')
      .replace(/^.*?\/src\//, 'src/')
      .replace(/^.*?\/(packages|apps|lib)\//, '$1/');
  }
}
