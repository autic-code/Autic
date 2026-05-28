/**
 * Provider abstraction types
 */

import type { ChatRequest, ChatResponse, StreamChunk, ModelInfo } from '@autic/shared';

export interface ProviderHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  error?: string;
  lastChecked: number;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  verifyKey(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<StreamChunk>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  options?: Record<string, unknown>;
}
