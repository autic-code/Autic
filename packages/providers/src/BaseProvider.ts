/**
 * Abstract base provider with shared logic
 */

import type { LLMProvider, ProviderHealth } from './types.js';
import type { ChatRequest, ChatResponse, StreamChunk, ModelInfo } from '@autic/shared';
import { timestamp } from '@autic/shared';

export abstract class BaseProvider implements LLMProvider {
  abstract readonly id: string;
  abstract readonly name: string;

  protected connected = false;
  protected baseUrl = '';

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract verifyKey(): Promise<boolean>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract stream(request: ChatRequest): AsyncIterable<StreamChunk>;

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const start = Date.now();
      const ok = await this.verifyKey();
      const latencyMs = Date.now() - start;
      return {
        status: ok ? 'healthy' : 'unhealthy',
        latencyMs,
        lastChecked: timestamp(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: timestamp(),
      };
    }
  }
}
