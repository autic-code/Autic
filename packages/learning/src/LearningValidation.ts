/**
 * LearningValidation — Confidence scoring, verification tracking, and quality control.
 *
 * Guards against polluted operational memory by:
 *   - Scoring confidence based on verification results
 *   - Detecting duplicate entries
 *   - Tracking verification history
 *   - Managing learning expiration
 *
 * Never stores unverified or low-confidence patterns.
 */

import { timestamp } from '@autic/shared';
import type { LearningEntry, LearningValidationScore } from '@autic/shared';

export interface ValidationRecord {
  entryId: string;
  confidence: number;
  verificationCount: number;
  lastVerified: number;
  createdAt: number;
}

export class LearningValidation {
  private records: Map<string, ValidationRecord> = new Map();
  // Track composite keys (title:type:framework) for duplicate detection
  private compositeKeys: Map<string, string> = new Map(); // compositeKey -> entryId

  /**
   * Validate a learning entry and compute confidence score.
   * Only considers a entry valid if verification checks pass.
   */
  validate(
    entry: LearningEntry,
    verificationResults?: Array<{ passed: boolean }>,
  ): LearningValidationScore {
    const now = timestamp();
    const existing = this.records.get(entry.id);
    const verificationCount = existing ? existing.verificationCount + 1 : 1;
    const baseConfidence = existing ? existing.confidence : 0;

    // Calculate confidence from verification results
    let verificationConfidence = 0;
    if (verificationResults && verificationResults.length > 0) {
      const passed = verificationResults.filter((r) => r.passed).length;
      verificationConfidence = passed / verificationResults.length;
    }

    // Combine base confidence with verification results
    const confidence = existing
      ? Math.min(1.0, baseConfidence + verificationConfidence * 0.3)
      : verificationConfidence > 0
        ? verificationConfidence * 0.8
        : 0.3; // Default low confidence for unverified entries

    // Check expiration
    const expired = entry.expiresAt !== undefined && now > entry.expiresAt;

    // Check for duplicate by composite key (title + type + framework)
    const compositeKey = `${entry.title}:${entry.type}:${entry.framework ?? ''}`;
    const duplicate = this.findDuplicate(compositeKey, entry.id);
    const isDuplicate = duplicate !== undefined;

    // Determine validity
    const isValid = confidence >= 0.5 && !isDuplicate && !expired;

    // Store record
    this.records.set(entry.id, {
      entryId: entry.id,
      confidence,
      verificationCount,
      lastVerified: now,
      createdAt: existing?.createdAt ?? now,
    });

    // Track composite key (only if this isn't a duplicate itself)
    if (!isDuplicate) {
      this.compositeKeys.set(compositeKey, entry.id);
    }

    return {
      entryId: entry.id,
      confidence,
      verificationCount,
      lastVerified: now,
      expired,
      duplicate: isDuplicate,
      duplicateOf: duplicate,
      isValid,
      reason: this.getReasonText(isValid, expired, isDuplicate, confidence),
    };
  }

  /**
   * Get the confidence score for an entry.
   */
  getConfidence(entryId: string): number | undefined {
    return this.records.get(entryId)?.confidence;
  }

  /**
   * Check if an entry is still valid (not expired, not superseded).
   */
  isValid(entry: LearningEntry): boolean {
    if (entry.expiresAt && timestamp() > entry.expiresAt) return false;
    const record = this.records.get(entry.id);
    return record ? record.confidence >= 0.5 : entry.confidence >= 0.5;
  }

  /**
   * Clear all validation records.
   */
  clear(): void {
    this.records.clear();
    this.compositeKeys.clear();
  }

  // ── Private ──

  private findDuplicate(compositeKey: string, entryId: string): string | undefined {
    const existingId = this.compositeKeys.get(compositeKey);
    if (existingId && existingId !== entryId) {
      return existingId;
    }
    return undefined;
  }

  private getReasonText(
    isValid: boolean,
    expired: boolean,
    isDuplicate: boolean,
    confidence: number,
  ): string {
    if (expired) return 'Entry has expired';
    if (isDuplicate) return 'Duplicate entry detected';
    if (!isValid && confidence < 0.5) return `Confidence too low: ${(confidence * 100).toFixed(0)}%`;
    if (isValid) return 'Entry validated successfully';
    return 'Validation failed';
  }
}
