/**
 * Shared utilities
 */

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

export function timestamp(): number {
  return Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readJSON<T = unknown>(filePath: string): Promise<T> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * EvictableMap — A Map wrapper with configurable size limits and LRU-style eviction.
 * Automatically evicts oldest entries when the max size is exceeded.
 */
export class EvictableMap<K, V> {
  private map: Map<K, V> = new Map();
  private maxSize: number;
  private accessOrder: K[] = [];
  private evictionCallback: ((key: K, value: V) => void) | undefined;

  constructor(maxSize: number, evictionCallback?: (key: K, value: V) => void) {
    this.maxSize = maxSize;
    this.evictionCallback = evictionCallback;
  }

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V): this {
    // If key already exists, remove from access order first
    const existingIndex = this.accessOrder.indexOf(key);
    if (existingIndex >= 0) {
      this.accessOrder.splice(existingIndex, 1);
    }

    // Evict oldest if at capacity
    while (this.map.size >= this.maxSize && !this.map.has(key)) {
      const oldest = this.accessOrder.shift();
      if (oldest === undefined) break;
      const oldValue = this.map.get(oldest);
      this.map.delete(oldest);
      if (oldValue !== undefined && this.evictionCallback) {
        this.evictionCallback(oldest, oldValue);
      }
    }

    this.map.set(key, value);
    this.accessOrder.push(key);
    return this;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.accessOrder = [];
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void {
    this.map.forEach(callbackfn);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  /**
   * Record access to promote a key to the front of the eviction order.
   */
  touch(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  /**
   * Get all keys in access order (oldest first).
   */
  getAccessOrder(): K[] {
    return [...this.accessOrder];
  }

  /**
   * Resize the max capacity, evicting oldest entries if necessary.
   */
  setMaxSize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    while (this.map.size > this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest === undefined) break;
      const oldValue = this.map.get(oldest);
      this.map.delete(oldest);
      if (oldValue !== undefined && this.evictionCallback) {
        this.evictionCallback(oldest, oldValue);
      }
    }
  }

  /**
   * Returns the remaining capacity before eviction starts.
   */
  getRemainingCapacity(): number {
    return Math.max(0, this.maxSize - this.map.size);
  }
}
