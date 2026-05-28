/**
 * Secret sanitization middleware
 * Strips API keys, tokens, secrets, and credentials from logs, outputs, and prompts.
 */

const SENSITIVE_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-style keys
  /(?:api[_-]?key|apikey|secret|token|password)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}/gi,
  /Bearer\s+[a-zA-Z0-9_\-./+=]{20,}/g,
  /Authorization:\s*(?:Bearer|Basic)\s+[a-zA-Z0-9_\-./+=]{16,}/g,

  // .env sensitive value patterns — key=value pairs with well-known secret names
  /(?:SUPABASE_KEY|SUPABASE_URL|DATABASE_URL|POSTGRES_URL|POSTGRESQL_URL|MONGODB_URI|REDIS_URL|REDIS_TLS_URL)\s*=\s*.+/gi,
  /(?:JWT_SECRET|SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET|COOKIE_SECRET|ENCRYPTION_KEY|PRIVATE_KEY)\s*=\s*.+/gi,
  /(?:STRIPE_[A-Z_]+KEY|STRIPE_SECRET_KEY|STRIPE_PUBLISHABLE_KEY)\s*=\s*.+/gi,
  /(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|CLOUDFLARE_API_TOKEN)\s*=\s*.+/gi,
  /(?:GITHUB_TOKEN|GITLAB_TOKEN|SLACK_TOKEN|DISCORD_TOKEN|TELEGRAM_BOT_TOKEN|SENTRY_DSN)\s*=\s*.+/gi,
  /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|COHERE_API_KEY|AI21_API_KEY|HUGGINGFACE_API_KEY)\s*=\s*.+/gi,

  // JWT tokens (base64url-encoded JSON segments)
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,

  // Private key blocks
  /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----\n[\s\S]*?-----END\s+(?:RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g,

  // Connection strings (database URIs with credentials)
  /(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi,
];

const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

export interface SanitizeOptions {
  patterns?: RegExp[];
  customValues?: string[];
  maskWith?: string;
}

export class Sanitizer {
  private patterns: RegExp[];
  private customValues: string[];
  private maskWith: string;

  constructor(options: SanitizeOptions = {}) {
    this.patterns = [...SENSITIVE_PATTERNS, ...(options.patterns || [])];
    this.customValues = options.customValues || [];
    this.maskWith = options.maskWith || '***';
  }

  sanitize(input: string): string {
    let result = input;

    // Apply regex patterns
    for (const pattern of this.patterns) {
      result = result.replace(pattern, this.maskWith);
    }

    // Replace custom values (case-insensitive)
    for (const value of this.customValues) {
      if (!value) continue;
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), this.maskWith);
    }

    return result;
  }

  sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      sanitized[key] = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? this.maskWith : value;
    }
    return sanitized;
  }

  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  /**
   * Add multiple custom values to sanitize.
   */
  addCustomValues(values: string[]): void {
    for (const value of values) {
      this.addCustomValue(value);
    }
  }

  /**
   * Replace all custom values.
   */
  setCustomValues(values: string[]): void {
    this.customValues = [...values];
  }

  addCustomValue(value: string): void {
    this.customValues.push(value);
  }
}

export function createDefaultSanitizer(): Sanitizer {
  return new Sanitizer();
}
