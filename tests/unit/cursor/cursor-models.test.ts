/**
 * Unit tests for Cursor models module
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import * as http from 'http';
import {
  DEFAULT_CURSOR_MODELS,
  DEFAULT_CURSOR_PORT,
  DEFAULT_CURSOR_MODEL,
  getDefaultModel,
  detectProvider,
  formatModelName,
  fetchModelsFromDaemon,
  fetchModelsFromCursorApi,
  getModelsForDaemon,
  clearCursorModelsCache,
} from '../../../src/cursor/cursor-models';

describe('DEFAULT_CURSOR_MODELS', () => {
  it('contains models from multiple providers', () => {
    const providers = new Set(DEFAULT_CURSOR_MODELS.map((m) => m.provider));
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('google')).toBe(true);
  });

  it('has exactly one default model', () => {
    const defaults = DEFAULT_CURSOR_MODELS.filter((m) => m.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(DEFAULT_CURSOR_MODEL);
  });
});

describe('DEFAULT_CURSOR_PORT', () => {
  it('is 20129', () => {
    expect(DEFAULT_CURSOR_PORT).toBe(20129);
  });
});

describe('DEFAULT_CURSOR_MODEL', () => {
  it('is gpt-5.3-codex', () => {
    expect(DEFAULT_CURSOR_MODEL).toBe('gpt-5.3-codex');
  });
});

describe('getDefaultModel', () => {
  it('returns the default model constant', () => {
    expect(getDefaultModel()).toBe(DEFAULT_CURSOR_MODEL);
  });
});

describe('detectProvider', () => {
  it('detects anthropic models', () => {
    expect(detectProvider('claude-4.5-sonnet')).toBe('anthropic');
    expect(detectProvider('claude-4.6-opus')).toBe('anthropic');
  });

  it('detects openai models', () => {
    expect(detectProvider('gpt-5.3-codex')).toBe('openai');
    expect(detectProvider('gpt-5-mini')).toBe('openai');
    expect(detectProvider('o3-mini')).toBe('openai');
  });

  it('detects o1 and o4 models as openai', () => {
    expect(detectProvider('o1')).toBe('openai');
    expect(detectProvider('o1-preview')).toBe('openai');
    expect(detectProvider('o4-mini')).toBe('openai');
  });

  it('detects google models', () => {
    expect(detectProvider('gemini-3-pro')).toBe('google');
  });

  it('detects cursor models', () => {
    expect(detectProvider('composer-1.5')).toBe('cursor');
    expect(detectProvider('cursor-model')).toBe('cursor');
  });

  it('detects xai models', () => {
    expect(detectProvider('grok-code')).toBe('xai');
  });

  it('defaults to unknown for unrecognized models', () => {
    expect(detectProvider('unknown-model')).toBe('unknown');
  });
});

describe('formatModelName', () => {
  it('returns catalog name for known models', () => {
    expect(formatModelName('claude-4.6-opus')).toBe('Claude 4.6 Opus');
    expect(formatModelName('gpt-5.3-codex')).toBe('GPT-5.3 Codex');
  });

  it('converts kebab-case to title case for unknown models', () => {
    expect(formatModelName('my-custom-model')).toBe('My Custom Model');
  });
});

describe('fetchModelsFromDaemon', () => {
  it('falls back to DEFAULT_CURSOR_MODELS when daemon is unreachable', async () => {
    // Use a port that nothing is listening on
    const unreachablePort = 9999;
    const models = await fetchModelsFromDaemon(unreachablePort);

    expect(models).toEqual(DEFAULT_CURSOR_MODELS);
  });
});

describe('fetchModelsFromCursorApi', () => {
  it('parses model list from API response', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [
            { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', provider: 'openai' },
            { id: 'claude-4.6-opus', name: 'Claude 4.6 Opus', provider: 'anthropic' },
          ],
        })
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve test server port');
    }

    try {
      const models = await fetchModelsFromCursorApi(
        {
          accessToken: 'test-token-123',
          machineId: '1234567890abcdef1234567890abcdef',
        },
        {
          endpoint: `http://127.0.0.1:${address.port}/v1/models`,
          timeoutMs: 2000,
        }
      );

      expect(models).not.toBeNull();
      expect(models?.[0].id).toBe('gpt-5.3-codex');
      expect(models?.[1].id).toBe('claude-4.6-opus');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns null for non-200 responses', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'forbidden' }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve test server port');
    }

    try {
      const models = await fetchModelsFromCursorApi(
        {
          accessToken: 'test-token-123',
          machineId: '1234567890abcdef1234567890abcdef',
        },
        {
          endpoint: `http://127.0.0.1:${address.port}/v1/models`,
          timeoutMs: 2000,
        }
      );

      expect(models).toBeNull();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('getModelsForDaemon', () => {
  beforeEach(() => {
    clearCursorModelsCache();
  });

  it('falls back to defaults without credentials', async () => {
    const models = await getModelsForDaemon();
    expect(models).toEqual(DEFAULT_CURSOR_MODELS);
  });

  it('uses cached live models when endpoint becomes unavailable', async () => {
    const liveModelId = 'test-live-model';
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [{ id: liveModelId, name: 'Live Model', provider: 'openai' }],
        })
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve test server port');
    }

    const endpoint = `http://127.0.0.1:${address.port}/v1/models`;

    try {
      const first = await getModelsForDaemon({
        credentials: {
          accessToken: 'test-token-123',
          machineId: '1234567890abcdef1234567890abcdef',
        },
        endpoint,
        timeoutMs: 2000,
      });

      expect(first[0]?.id).toBe(liveModelId);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    const second = await getModelsForDaemon({
      endpoint: 'http://127.0.0.1:9/v1/models',
      timeoutMs: 250,
    });

    expect(second[0]?.id).toBe(liveModelId);
  });
});
