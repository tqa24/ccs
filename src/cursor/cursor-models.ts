/**
 * Cursor Model Catalog
 *
 * Manages available models from Cursor IDE.
 */

import * as http from 'http';
import type { CursorModel } from './types';
import type { CursorCredentials } from './cursor-protobuf-schema';
import { isDaemonRunning } from './cursor-daemon';
import { buildCursorModelsHeaders } from './cursor-client-policy';
import {
  DEFAULT_CURSOR_MODEL,
  DEFAULT_CURSOR_MODELS,
  detectProvider,
  formatModelName,
} from './cursor-default-models';

/** Default daemon port */
export const DEFAULT_CURSOR_PORT = 20129;

export { DEFAULT_CURSOR_MODEL, DEFAULT_CURSOR_MODELS, detectProvider, formatModelName };

const CURSOR_MODELS_API_ENDPOINT = 'https://api2.cursor.sh/v1/models';
const CURSOR_MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

let liveModelsCache: {
  models: CursorModel[];
  expiresAtMs: number;
} | null = null;

interface CursorModelsApiResponse {
  data?: Array<{ id?: unknown; name?: unknown; provider?: unknown }>;
  models?: Array<{ id?: unknown; name?: unknown; provider?: unknown }>;
}

function normalizeModelRecords(
  records: Array<{ id?: unknown; name?: unknown; provider?: unknown }>
): CursorModel[] {
  const models: CursorModel[] = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (typeof record.id !== 'string' || !record.id) continue;
    const modelId = record.id;
    const modelName = typeof record.name === 'string' && record.name ? record.name : modelId;
    const provider =
      typeof record.provider === 'string' && record.provider
        ? record.provider
        : detectProvider(modelId);
    models.push({
      id: modelId,
      name: modelName,
      provider,
      isDefault: modelId === DEFAULT_CURSOR_MODEL,
    });
  }
  return models;
}

function parseApiModelsResponse(payload: unknown): CursorModel[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const response = payload as CursorModelsApiResponse;
  const records = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.models)
      ? response.models
      : null;

  if (!records) return null;

  const models = normalizeModelRecords(records);
  return models.length > 0 ? models : null;
}

function getCachedLiveModels(nowMs: number = Date.now()): CursorModel[] | null {
  if (!liveModelsCache) return null;
  if (liveModelsCache.expiresAtMs <= nowMs) {
    liveModelsCache = null;
    return null;
  }
  return liveModelsCache.models;
}

function setCachedLiveModels(models: CursorModel[], nowMs: number = Date.now()): void {
  liveModelsCache = {
    models,
    expiresAtMs: nowMs + CURSOR_MODELS_CACHE_TTL_MS,
  };
}

export function clearCursorModelsCache(): void {
  liveModelsCache = null;
}

export async function fetchModelsFromCursorApi(
  credentials: CursorCredentials,
  options: {
    endpoint?: string;
    timeoutMs?: number;
  } = {}
): Promise<CursorModel[] | null> {
  if (!credentials.accessToken || !credentials.machineId) {
    return null;
  }

  const endpoint = options.endpoint || CURSOR_MODELS_API_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? 5000;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: buildCursorModelsHeaders(credentials),
      signal: abortController.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    return parseApiModelsResponse(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getModelsForDaemon(
  options: {
    credentials?: CursorCredentials | null;
    endpoint?: string;
    timeoutMs?: number;
  } = {}
): Promise<CursorModel[]> {
  const cached = getCachedLiveModels();
  if (cached) {
    return cached;
  }

  const credentials = options.credentials;
  if (credentials?.accessToken && credentials.machineId) {
    const liveModels = await fetchModelsFromCursorApi(credentials, {
      endpoint: options.endpoint,
      timeoutMs: options.timeoutMs,
    });
    if (liveModels && liveModels.length > 0) {
      setCachedLiveModels(liveModels);
      return liveModels;
    }
  }

  return DEFAULT_CURSOR_MODELS;
}

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
