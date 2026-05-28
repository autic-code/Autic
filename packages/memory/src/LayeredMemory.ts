/**
 * LayeredMemory — Short-term, mid-term, and long-term memory layers.
 *
 * Layers:
 *   short_term — Active execution state (volatile, TTL-based expiry)
 *   mid_term  — Recent workflow state (persistent, limited retention)
 *   long_term — Architecture intelligence (persistent, no expiry)
 *
 * Each layer has independent storage and retrieval semantics.
 */

import { generateId, timestamp } from '@autic/shared';
import type { MemoryLayer, MemoryRecord } from '@autic/shared';

// TTL for each layer in milliseconds
const LAYER_TTL: Record<MemoryLayer, number | null> = {
  short_term: 30 * 60 * 1000,   // 30 minutes
  mid_term: 24 * 60 * 60 * 1000, // 24 hours
  long_term: null,                // No expiry
};

// Max entries per layer
const LAYER_MAX_ENTRIES: Record<MemoryLayer, number> = {
  short_term: 50,
  mid_term: 200,
  long_term: 1000,
};

export class LayeredMemory {
  private layers: Map<MemoryLayer, Map<string, MemoryRecord>> = new Map();
  private initialized = false;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  init(): void {
    if (this.initialized) return;

    // Initialize layer maps
    for (const layer of ['short_term', 'mid_term', 'long_term'] as MemoryLayer[]) {
      this.layers.set(layer, new Map());
    }

    this.initialized = true;

    // Periodic cleanup for short-term and mid-term layers
    this.cleanupTimer = setInterval(() => this.runCleanup(), 60_000);
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Store a value in the specified memory layer.
   */
  async set(
    key: string,
    value: unknown,
    layer: MemoryLayer = 'short_term',
    tags: string[] = [],
    sessionId?: string,
  ): Promise<MemoryRecord> {
    this.init();

    const now = timestamp();
    const record: MemoryRecord = {
      id: generateId(),
      key,
      value,
      layer,
      tags,
      sessionId,
      createdAt: now,
      updatedAt: now,
      ttl: LAYER_TTL[layer] ?? undefined,
    };

    const layerMap = this.layers.get(layer)!;
    layerMap.set(key, record);

    // Enforce max entries — remove oldest if over limit
    if (layerMap.size > LAYER_MAX_ENTRIES[layer]) {
      const sorted = Array.from(layerMap.entries())
        .sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
      const toRemove = layerMap.size - LAYER_MAX_ENTRIES[layer];
      for (let i = 0; i < toRemove; i++) {
        layerMap.delete(sorted[i][0]);
      }
    }

    return record;
  }

  /**
   * Retrieve a value from a specific layer (or all layers in order).
   */
  get<T = unknown>(key: string, layer?: MemoryLayer): T | undefined {
    this.init();

    if (layer) {
      const layerMap = this.layers.get(layer);
      if (!layerMap) return undefined;
      const record = layerMap.get(key);
      if (!record) return undefined;

      // Check TTL for short-term and mid-term
      if (record.ttl) {
        const elapsed = timestamp() - record.updatedAt;
        if (elapsed > record.ttl) {
          layerMap.delete(key);
          return undefined;
        }
      }

      return record.value as T;
    }

    // Search all layers in priority order
    for (const l of ['short_term', 'mid_term', 'long_term'] as MemoryLayer[]) {
      const layerMap = this.layers.get(l);
      if (!layerMap) continue;
      const record = layerMap.get(key);
      if (record) {
        // Check TTL
        if (record.ttl) {
          const elapsed = timestamp() - record.updatedAt;
          if (elapsed > record.ttl) {
            layerMap.delete(key);
            continue;
          }
        }
        return record.value as T;
      }
    }

    return undefined;
  }

  /**
   * Get a full record (with metadata) from a specific layer.
   */
  getRecord(key: string, layer?: MemoryLayer): MemoryRecord | undefined {
    this.init();

    if (layer) {
      const layerMap = this.layers.get(layer);
      if (!layerMap) return undefined;
      const record = layerMap.get(key);
      if (!record) return undefined;
      if (record.ttl) {
        const elapsed = timestamp() - record.updatedAt;
        if (elapsed > record.ttl) {
          layerMap.delete(key);
          return undefined;
        }
      }
      return record;
    }

    for (const l of ['short_term', 'mid_term', 'long_term'] as MemoryLayer[]) {
      const layerMap = this.layers.get(l);
      if (!layerMap) continue;
      const record = layerMap.get(key);
      if (record) {
        if (record.ttl) {
          const elapsed = timestamp() - record.updatedAt;
          if (elapsed > record.ttl) {
            layerMap.delete(key);
            continue;
          }
        }
        return record;
      }
    }

    return undefined;
  }

  /**
   * Delete a key from a specific layer (or all layers).
   */
  async delete(key: string, layer?: MemoryLayer): Promise<boolean> {
    this.init();

    if (layer) {
      const layerMap = this.layers.get(layer);
      if (!layerMap) return false;
      return layerMap.delete(key);
    }

    let deleted = false;
    for (const l of ['short_term', 'mid_term', 'long_term'] as MemoryLayer[]) {
      const layerMap = this.layers.get(l);
      if (layerMap?.delete(key)) {
        deleted = true;
      }
    }
    return deleted;
  }

  /**
   * Find records by tag across a specific layer (or all layers).
   */
  findByTag(tag: string, layer?: MemoryLayer): MemoryRecord[] {
    this.init();
    const results: MemoryRecord[] = [];

    const searchLayers = layer ? [layer] : (['short_term', 'mid_term', 'long_term'] as MemoryLayer[]);

    for (const l of searchLayers) {
      const layerMap = this.layers.get(l);
      if (!layerMap) continue;

      for (const record of layerMap.values()) {
        if (record.tags.includes(tag)) {
          // Check TTL
          if (record.ttl) {
            const elapsed = timestamp() - record.updatedAt;
            if (elapsed > record.ttl) {
              layerMap.delete(record.key);
              continue;
            }
          }
          results.push(record);
        }
      }
    }

    return results;
  }

  /**
   * List all keys in a specific layer.
   */
  listKeys(layer: MemoryLayer): string[] {
    this.init();
    const layerMap = this.layers.get(layer);
    if (!layerMap) return [];
    return Array.from(layerMap.keys());
  }

  /**
   * Get all records in a specific layer.
   */
  listRecords(layer: MemoryLayer): MemoryRecord[] {
    this.init();
    const layerMap = this.layers.get(layer);
    if (!layerMap) return [];

    return Array.from(layerMap.values()).filter((record) => {
      if (record.ttl) {
        const elapsed = timestamp() - record.updatedAt;
        if (elapsed > record.ttl) {
          layerMap.delete(record.key);
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get stats for each layer.
   */
  getStats(): Record<MemoryLayer, { entryCount: number; size: number }> {
    this.init();
    const stats: Record<string, { entryCount: number; size: number }> = {};

    for (const layer of ['short_term', 'mid_term', 'long_term'] as MemoryLayer[]) {
      const records = this.listRecords(layer);
      stats[layer] = {
        entryCount: records.length,
        size: JSON.stringify(records).length,
      };
    }

    return stats as Record<MemoryLayer, { entryCount: number; size: number }>;
  }

  /**
   * Promote a key from short-term to mid-term (or mid-term to long-term).
   */
  async promote(key: string): Promise<boolean> {
    this.init();

    // Try to find in short_term first
    const shortTermMap = this.layers.get('short_term')!;
    const shortRecord = shortTermMap.get(key);
    if (shortRecord) {
      shortTermMap.delete(key);
      await this.set(key, shortRecord.value, 'mid_term', shortRecord.tags, shortRecord.sessionId);
      return true;
    }

    // Try to promote mid-term to long-term
    const midTermMap = this.layers.get('mid_term')!;
    const midRecord = midTermMap.get(key);
    if (midRecord) {
      midTermMap.delete(key);
      await this.set(key, midRecord.value, 'long_term', midRecord.tags, midRecord.sessionId);
      return true;
    }

    return false;
  }

  /**
   * Clear a specific layer (or all layers).
   */
  async clear(layer?: MemoryLayer): Promise<void> {
    this.init();

    if (layer) {
      this.layers.get(layer)?.clear();
    } else {
      for (const l of ['short_term', 'mid_term', 'long_term'] as MemoryLayer[]) {
        this.layers.get(l)?.clear();
      }
    }
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ---- Private ----

  private runCleanup(): void {
    const now = timestamp();
    for (const layer of ['short_term', 'mid_term'] as MemoryLayer[]) {
      const layerMap = this.layers.get(layer);
      if (!layerMap) continue;
      for (const [key, record] of layerMap.entries()) {
        if (record.ttl) {
          const elapsed = now - record.updatedAt;
          if (elapsed > record.ttl) {
            layerMap.delete(key);
          }
        }
      }
    }
  }
}
