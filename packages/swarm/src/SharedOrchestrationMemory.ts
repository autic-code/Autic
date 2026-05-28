/**
 * SharedOrchestrationMemory — Lightweight coordination memory (#8)
 *
 * Scoped key-value memory for swarm agent coordination:
 *   - Global, pipeline, stage, and partition scoped cells
 *   - Owner tracking for accountability
 *   - TTL-based expiration
 *   - Bounded to prevent memory bloat (max 500 cells)
 *   - No giant shared memory blobs
 */

import { timestamp } from '@autic/shared';
import type { CoordinationMemoryCell } from '@autic/shared';

export type MemoryScope = 'global' | 'pipeline' | 'stage' | 'partition';

export interface MemoryWriteOptions {
  scope: MemoryScope;
  owner: string;
  ttl?: number;
}

export class SharedOrchestrationMemory {
  private cells: Map<string, CoordinationMemoryCell> = new Map();
  private maxCells = 500;

  /** Write a value to the coordination memory */
  write(key: string, value: unknown, options: MemoryWriteOptions): void {
    // Evict if at capacity
    if (this.cells.size >= this.maxCells) {
      const oldest = this.cells.entries().next();
      if (oldest.value) {
        this.cells.delete(oldest.value[0]);
      }
    }

    this.cells.set(key, {
      key,
      value,
      scope: options.scope,
      owner: options.owner,
      createdAt: timestamp(),
      updatedAt: timestamp(),
      ttl: options.ttl,
    });
  }

  /** Read a value from the coordination memory */
  read(key: string): CoordinationMemoryCell | undefined {
    const cell = this.cells.get(key);
    if (!cell) return undefined;

    // Check TTL
    if (cell.ttl) {
      const age = Date.now() - cell.updatedAt;
      if (age > cell.ttl) {
        this.cells.delete(key);
        return undefined;
      }
    }

    cell.updatedAt = timestamp();
    return cell;
  }

  /** Read a value and return just the value */
  readValue<T = unknown>(key: string): T | undefined {
    const cell = this.read(key);
    return cell?.value as T | undefined;
  }

  /** Delete a memory cell */
  delete(key: string): boolean {
    return this.cells.delete(key);
  }

  /** Clear all cells in a scope */
  clearScope(scope: MemoryScope): number {
    let count = 0;
    for (const [key, cell] of this.cells) {
      if (cell.scope === scope) {
        this.cells.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Clear cells owned by a specific agent */
  clearOwner(owner: string): number {
    let count = 0;
    for (const [key, cell] of this.cells) {
      if (cell.owner === owner) {
        this.cells.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Query cells by scope */
  queryByScope(scope: MemoryScope): CoordinationMemoryCell[] {
    return Array.from(this.cells.values()).filter((c) => c.scope === scope);
  }

  /** Query cells by owner */
  queryByOwner(owner: string): CoordinationMemoryCell[] {
    return Array.from(this.cells.values()).filter((c) => c.owner === owner);
  }

  /** Query cells by key prefix */
  queryByPrefix(prefix: string): CoordinationMemoryCell[] {
    return Array.from(this.cells.values()).filter((c) => c.key.startsWith(prefix));
  }

  /** Get all cells (for observability) */
  getAllCells(): CoordinationMemoryCell[] {
    return Array.from(this.cells.values());
  }

  /** Count cells */
  count(): number {
    return this.cells.size;
  }

  /** Get memory size in bytes (approximate) */
  estimateSizeBytes(): number {
    let total = 0;
    for (const [, cell] of this.cells) {
      total += cell.key.length + JSON.stringify(cell.value).length + cell.owner.length;
    }
    return total;
  }

  /** Clean up expired cells */
  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, cell] of this.cells) {
      if (cell.ttl) {
        const age = now - cell.updatedAt;
        if (age > cell.ttl) {
          this.cells.delete(key);
          count++;
        }
      }
    }
    return count;
  }

  /** Reset all memory */
  reset(): void {
    this.cells.clear();
  }
}
