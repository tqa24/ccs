/**
 * Unit tests for Cursor models module
 */

import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_CURSOR_MODELS,
  DEFAULT_CURSOR_PORT,
  DEFAULT_CURSOR_MODEL,
  getDefaultModel,
  detectProvider,
  formatModelName,
  fetchModelsFromDaemon,
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
