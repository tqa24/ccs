/**
 * Cursor Model Catalog
 *
 * Manages available models from Cursor IDE.
 * Based on Cursor's supported models catalog.
 */

import * as http from 'http';
import type { CursorModel } from './types';
import { isDaemonRunning } from './cursor-daemon';

/** Default daemon port */
export const DEFAULT_CURSOR_PORT = 20129;

/** Default model ID */
export const DEFAULT_CURSOR_MODEL = 'gpt-5.3-codex';

/**
 * Default models available through Cursor IDE.
 * Used as fallback when daemon is not reachable.
 * Source: Cursor docs model catalog (Feb 2026)
 */
export const DEFAULT_CURSOR_MODELS: CursorModel[] = [
  // Anthropic Models
  {
    id: 'claude-4.6-opus',
    name: 'Claude 4.6 Opus',
    provider: 'anthropic',
  },
  {
    id: 'claude-4.6-opus-fast-mode',
    name: 'Claude 4.6 Opus (Fast mode)',
    provider: 'anthropic',
  },
  {
    id: 'claude-4.5-sonnet',
    name: 'Claude 4.5 Sonnet',
    provider: 'anthropic',
  },
  {
    id: 'claude-4.5-opus',
    name: 'Claude 4.5 Opus',
    provider: 'anthropic',
  },
  {
    id: 'claude-4.5-haiku',
    name: 'Claude 4.5 Haiku',
    provider: 'anthropic',
  },
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet',
    provider: 'anthropic',
  },
  {
    id: 'claude-4-sonnet-1m',
    name: 'Claude 4 Sonnet 1M',
    provider: 'anthropic',
  },

  // Cursor Models
  {
    id: 'composer-1.5',
    name: 'Composer 1.5',
    provider: 'cursor',
  },
  {
    id: 'composer-1',
    name: 'Composer 1',
    provider: 'cursor',
  },

  // OpenAI Models
  {
    id: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    provider: 'openai',
    isDefault: true,
  },
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    provider: 'openai',
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    provider: 'openai',
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    provider: 'openai',
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    provider: 'openai',
  },
  {
    id: 'gpt-5-codex',
    name: 'GPT-5-Codex',
    provider: 'openai',
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
  },
  {
    id: 'gpt-5-fast',
    name: 'GPT-5 Fast',
    provider: 'openai',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
  },

  // Google Models
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3 Pro Image Preview',
    provider: 'google',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
  },

  // xAI Models
  {
    id: 'grok-code',
    name: 'Grok Code',
    provider: 'xai',
  },
];

/**
 * Fetch available models from running cursor daemon.
 *
 * @param port The port cursor daemon is running on
 * @returns List of available models
 */
export async function fetchModelsFromDaemon(port: number): Promise<CursorModel[]> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (models: CursorModel[]) => {
      if (resolved) return;
      resolved = true;
      resolve(models);
    };

    const req = http.request(
      {
        // Use 127.0.0.1 instead of localhost for more reliable local connections
        hostname: '127.0.0.1',
        port,
        path: '/v1/models',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > MAX_BODY_SIZE) {
            req.destroy();
            safeResolve(DEFAULT_CURSOR_MODELS);
          }
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data) as { data?: Array<{ id: string }> };
            if (response.data && Array.isArray(response.data)) {
              const models: CursorModel[] = response.data.map((m) => ({
                id: m.id,
                name: formatModelName(m.id),
                provider: detectProvider(m.id),
                isDefault: m.id === DEFAULT_CURSOR_MODEL,
              }));
              safeResolve(models.length > 0 ? models : DEFAULT_CURSOR_MODELS);
            } else {
              safeResolve(DEFAULT_CURSOR_MODELS);
            }
          } catch {
            safeResolve(DEFAULT_CURSOR_MODELS);
          }
        });
      }
    );

    req.on('error', () => {
      safeResolve(DEFAULT_CURSOR_MODELS);
    });

    req.on('timeout', () => {
      req.destroy();
      safeResolve(DEFAULT_CURSOR_MODELS);
    });

    req.end();
  });
}

/**
 * Get available models (from daemon or defaults).
 * Checks daemon health first to avoid 5s timeout when daemon is not running.
 */
export async function getAvailableModels(port: number): Promise<CursorModel[]> {
  if (!(await isDaemonRunning(port))) {
    return DEFAULT_CURSOR_MODELS;
  }
  return fetchModelsFromDaemon(port);
}

/**
 * Get the default model.
 * Uses GPT-5.3 Codex as default.
 */
export function getDefaultModel(): string {
  return DEFAULT_CURSOR_MODEL;
}

/**
 * Detect provider from model ID.
 */
export function detectProvider(modelId: string): string {
  if (modelId.includes('claude')) return 'anthropic';
  if (modelId.includes('gpt') || /^o[1-9]\d*(-|$)/.test(modelId)) return 'openai';
  if (modelId.includes('gemini')) return 'google';
  if (modelId.includes('cursor') || modelId.includes('composer')) return 'cursor';
  if (modelId.includes('grok')) return 'xai';
  return 'unknown';
}

/**
 * Format model ID to human-readable name.
 */
export function formatModelName(modelId: string): string {
  // Find model in catalog for metadata
  const model = DEFAULT_CURSOR_MODELS.find((m) => m.id === modelId);
  if (model) {
    return model.name;
  }

  // Fallback: convert kebab-case to title case
  return modelId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
