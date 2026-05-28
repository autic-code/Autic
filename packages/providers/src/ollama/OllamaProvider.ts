/**
 * Ollama provider implementation
 * Provides access to locally-hosted models via Ollama
 */

import { BaseProvider } from '../BaseProvider.js';
import type { ChatRequest, ChatResponse, StreamChunk, ModelInfo } from '@autic/shared';

export interface OllamaConfig {
  baseUrl?: string;
  defaultModel?: string;
}

export class OllamaProvider extends BaseProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  private defaultModel: string;

  constructor(config: OllamaConfig = {}) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaultModel = config.defaultModel || 'llama3.2';
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      this.connected = response.ok;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async verifyKey(): Promise<boolean> {
    // Ollama doesn't use API keys; verify by checking server is reachable
    return this.connect();
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const json = (await response.json()) as {
        models?: Array<{ name: string; details?: { parameter_size?: string } }>;
      };
      return (json.models || []).map((model) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        contextLength: model.details?.parameter_size?.includes('7B') ? 8192 : 4096,
        capabilities: [{ type: 'chat' }, { type: 'streaming' }],
      }));
    } catch {
      return [];
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || this.defaultModel,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      model?: string;
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      id: `ollama-${Date.now()}`,
      model: json.model || request.model,
      message: {
        role: 'assistant',
        content: json.message?.content || '',
      },
      usage: json.prompt_eval_count
        ? {
            promptTokens: json.prompt_eval_count || 0,
            completionTokens: json.eval_count || 0,
            totalTokens: (json.prompt_eval_count || 0) + (json.eval_count || 0),
          }
        : undefined,
    };
  }

  async *stream(request: ChatRequest): AsyncIterable<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || this.defaultModel,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { done?: boolean; message?: { content?: string } };
            if (parsed.done) {
              yield { content: '', done: true };
              return;
            }
            if (parsed.message?.content) {
              yield { content: parsed.message.content, done: false };
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true };
  }
}
