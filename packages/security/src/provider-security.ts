/**
 * ProviderSecurityLayer — Security boundary between Autic and external providers.
 *
 * Ensures:
 *   - No secrets are leaked to providers
 *   - Prompts are sanitized before sending
 *   - Provider responses are safe to process
 *   - Provider permission boundaries are enforced
 *
 * Acts as middleware in the provider call chain:
 *   Runtime → ProviderSecurityLayer → Provider
 */

import { type RiskLevel } from '@autic/shared';
import { Sanitizer } from './sanitizer.js';
import { SecurityEventSystem } from './security-events.js';

export interface ProviderSecurityOptions {
  sanitizer?: Sanitizer;
  securityEvents?: SecurityEventSystem;
  maxPromptTokens?: number;
  blockHighRiskContext?: boolean;
}

export interface SanitizedPrompt {
  safeContent: string;
  redactedFields: string[];
  riskLevel: RiskLevel;
  tokenEstimate: number;
}

export interface ProviderSafetyCheck {
  allowed: boolean;
  reason?: string;
  sanitized: boolean;
  redactedCount: number;
}

export class ProviderSecurityLayer {
  private sanitizer: Sanitizer;
  private securityEvents: SecurityEventSystem;
  private maxPromptTokens: number;
  private blockHighRiskContext: boolean;

  /** Known sensitive key patterns to redact from prompts */
  private readonly SENSITIVE_PATTERNS = [
    /SUPABASE_KEY\s*=\s*.+/gi,
    /SUPABASE_URL\s*=\s*.+/gi,
    /DATABASE_URL\s*=\s*.+/gi,
    /POSTGRES_URL\s*=\s*.+/gi,
    /MONGODB_URI\s*=\s*.+/gi,
    /REDIS_URL\s*=\s*.+/gi,
    /JWT_SECRET\s*=\s*.+/gi,
    /SESSION_SECRET\s*=\s*.+/gi,
    /COOKIE_SECRET\s*=\s*.+/gi,
    /ENCRYPTION_KEY\s*=\s*.+/gi,
    /AWS_ACCESS_KEY_ID\s*=\s*.+/gi,
    /AWS_SECRET_ACCESS_KEY\s*=\s*.+/gi,
    /AWS_SESSION_TOKEN\s*=\s*.+/gi,
    /GITHUB_TOKEN\s*=\s*.+/gi,
    /GITLAB_TOKEN\s*=\s*.+/gi,
    /SLACK_TOKEN\s*=\s*.+/gi,
    /DISCORD_TOKEN\s*=\s*.+/gi,
    /STRIPE_[A-Z_]+KEY\s*=\s*.+/gi,
    /NEXTAUTH_SECRET\s*=\s*.+/gi,
    /AUTH_SECRET\s*=\s*.+/gi,
    /PRIVATE_KEY\s*[-]+[\\s\\S]*?[-]+/gi,
  ];

  constructor(options: ProviderSecurityOptions = {}) {
    this.sanitizer = options.sanitizer || new Sanitizer();
    this.securityEvents = options.securityEvents || new SecurityEventSystem();
    this.maxPromptTokens = options.maxPromptTokens || 128_000;
    this.blockHighRiskContext = options.blockHighRiskContext ?? true;
  }

  /**
   * Sanitize a prompt before sending to a provider.
   * Strips secrets, detects risky patterns, and estimates token count.
   */
  sanitizePrompt(content: string): SanitizedPrompt {
    const redactedFields: string[] = [];
    let safeContent = content;

    // Apply security patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const keyName = match.split('=')[0] || 'unknown';
          redactedFields.push(keyName.trim());
        }
        safeContent = safeContent.replace(pattern, '$1=[REDACTED]');
      }
    }

    // Apply generic sanitizer for API keys and tokens
    const beforeSanitize = safeContent;
    safeContent = this.sanitizer.sanitize(safeContent);
    if (beforeSanitize !== safeContent) {
      redactedFields.push('api_key_or_token');
    }

    // Estimate token count
    const tokenEstimate = Math.ceil(safeContent.length / 3);

    // Determine risk level
    const riskLevel: RiskLevel = redactedFields.length > 0 ? 'medium' : 'low';

    // Record sanitization event if secrets were found
    if (redactedFields.length > 0) {
      this.securityEvents.record({
        type: 'sanitization:triggered',
        severity: 'warning',
        message: `Sanitized ${redactedFields.length} secret(s) from prompt content`,
        action: 'provider.sanitize',
        details: { redactedFields, tokenEstimate },
      });
    }

    return {
      safeContent,
      redactedFields,
      riskLevel,
      tokenEstimate,
    };
  }

  /**
   * Check if a provider request is safe to send.
   */
  checkRequestSafety(params: {
    providerId: string;
    modelId: string;
    content: string;
    promptTokens: number;
  }): ProviderSafetyCheck {
    const { providerId, modelId, content, promptTokens } = params;

    // Check token limit
    if (promptTokens > this.maxPromptTokens) {
      this.securityEvents.record({
        type: 'provider:boundary_check',
        severity: 'warning',
        message: `Prompt exceeds max tokens for ${providerId}/${modelId}`,
        action: 'provider.check',
        resource: `${providerId}/${modelId}`,
        details: { promptTokens, maxTokens: this.maxPromptTokens },
      });

      return {
        allowed: false,
        reason: `Prompt (${promptTokens} tokens) exceeds maximum allowed (${this.maxPromptTokens})`,
        sanitized: false,
        redactedCount: 0,
      };
    }

    // Sanitize content
    const sanitized = this.sanitizePrompt(content);

    // Block if high-risk context and configured to do so
    if (this.blockHighRiskContext && sanitized.riskLevel === 'high') {
      this.securityEvents.record({
        type: 'provider:boundary_check',
        severity: 'critical',
        message: `Blocked high-risk provider request to ${providerId}/${modelId}`,
        action: 'provider.block',
        resource: `${providerId}/${modelId}`,
        details: { redactedFields: sanitized.redactedFields },
      });

      return {
        allowed: false,
        reason: 'High-risk context detected in provider request',
        sanitized: true,
        redactedCount: sanitized.redactedFields.length,
      };
    }

    return {
      allowed: true,
      sanitized: sanitized.redactedFields.length > 0,
      redactedCount: sanitized.redactedFields.length,
    };
  }

  /**
   * Sanitize provider response to strip any leaked secrets.
   */
  sanitizeResponse(content: string): string {
    const before = content;
    const sanitized = this.sanitizer.sanitize(content);

    if (before !== sanitized) {
      this.securityEvents.record({
        type: 'sanitization:triggered',
        severity: 'warning',
        message: 'Secrets redacted from provider response',
        action: 'provider.response.sanitize',
      });
    }

    return sanitized;
  }

  /**
   * Get the underlying sanitizer instance.
   */
  getSanitizer(): Sanitizer {
    return this.sanitizer;
  }

  /**
   * Get the security events system.
   */
  getSecurityEvents(): SecurityEventSystem {
    return this.securityEvents;
  }
}
