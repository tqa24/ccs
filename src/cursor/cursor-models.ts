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
export const DEFAULT_CURSOR_MODEL = 'gpt-4.1';

/**
 * Default models available through Cursor IDE.
 * Used as fallback when daemon is not reachable.
 * Source: Cursor IDE supported models (Feb 2025)
 */
export const DEFAULT_CURSOR_MODELS: CursorModel[] = [
  // Anthropic Models
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
  },

  // OpenAI Models
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    isDefault: true,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
  },
  {
    id: 'o3-mini',
    name: 'O3 Mini',
    provider: 'openai',
  },

  // Google Models
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
  },

  // Cursor Custom Models
  {
    id: 'cursor-small',
    name: 'Cursor Small',
    provider: 'cursor',
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
 * Uses gpt-4.1 as it's commonly available.
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
  if (modelId.includes('cursor')) return 'cursor';
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
