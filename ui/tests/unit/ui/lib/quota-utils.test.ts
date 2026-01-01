/**
 * Tests for quota utility functions
 */

import { describe, it, expect } from 'vitest';
import { getMinClaudeQuota, sortModelsByPriority, getEarliestResetTime } from '@/lib/utils';

describe('getMinClaudeQuota', () => {
  describe('basic functionality', () => {
    it('returns null for empty models array', () => {
      expect(getMinClaudeQuota([])).toBeNull();
    });

    it('returns minimum of Claude models when present', () => {
      const models = [
        { name: 'claude-opus-4', displayName: 'Claude Opus 4', percentage: 95 },
        { name: 'claude-sonnet-4', displayName: 'Claude Sonnet 4', percentage: 90 },
        { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', percentage: 100 },
      ];
      expect(getMinClaudeQuota(models)).toBe(90);
    });

    it('falls back to minimum of all models when no Claude models', () => {
      const models = [
        { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', percentage: 100 },
        { name: 'gemini-3-pro', displayName: 'Gemini 3 Pro', percentage: 98 },
      ];
      expect(getMinClaudeQuota(models)).toBe(98);
    });

    it('handles single Claude model', () => {
      const models = [{ name: 'claude-opus-4', displayName: 'Claude Opus 4', percentage: 85 }];
      expect(getMinClaudeQuota(models)).toBe(85);
    });
  });

  describe('Claude detection', () => {
    it('detects Claude from displayName', () => {
      const models = [
        { name: 'model-abc', displayName: 'Claude Opus 4.5', percentage: 75 },
        { name: 'gemini-flash', displayName: 'Gemini Flash', percentage: 100 },
      ];
      expect(getMinClaudeQuota(models)).toBe(75);
    });

    it('detects Claude from name when displayName is missing', () => {
      const models = [
        { name: 'claude-sonnet-4-thinking', percentage: 80 },
        { name: 'gemini-2.5-flash', percentage: 100 },
      ];
      expect(getMinClaudeQuota(models)).toBe(80);
    });

    it('is case-insensitive for Claude detection', () => {
      const models = [
        { name: 'CLAUDE-OPUS', displayName: 'CLAUDE OPUS', percentage: 70 },
        { name: 'gemini', displayName: 'Gemini', percentage: 100 },
      ];
      expect(getMinClaudeQuota(models)).toBe(70);
    });
  });

  describe('edge cases', () => {
    it('handles models with 0% quota', () => {
      const models = [
        { name: 'claude-opus', displayName: 'Claude Opus', percentage: 0 },
        { name: 'claude-sonnet', displayName: 'Claude Sonnet', percentage: 50 },
      ];
      expect(getMinClaudeQuota(models)).toBe(0);
    });

    it('handles models with 100% quota', () => {
      const models = [{ name: 'claude-opus', displayName: 'Claude Opus', percentage: 100 }];
      expect(getMinClaudeQuota(models)).toBe(100);
    });

    it('handles undefined displayName gracefully', () => {
      const models = [{ name: 'claude-opus', displayName: undefined, percentage: 85 }];
      expect(getMinClaudeQuota(models)).toBe(85);
    });

    it('handles empty string displayName', () => {
      const models = [{ name: 'claude-opus', displayName: '', percentage: 85 }];
      expect(getMinClaudeQuota(models)).toBe(85);
    });

    it('filters out NaN percentages', () => {
      const models = [
        { name: 'claude-opus', displayName: 'Claude Opus', percentage: NaN },
        { name: 'claude-sonnet', displayName: 'Claude Sonnet', percentage: 80 },
      ];
      expect(getMinClaudeQuota(models)).toBe(80);
    });

    it('filters out Infinity percentages', () => {
      const models = [
        { name: 'claude-opus', displayName: 'Claude Opus', percentage: Infinity },
        { name: 'claude-sonnet', displayName: 'Claude Sonnet', percentage: 75 },
      ];
      expect(getMinClaudeQuota(models)).toBe(75);
    });

    it('returns null when all percentages are invalid', () => {
      const models = [
        { name: 'claude-opus', displayName: 'Claude Opus', percentage: NaN },
        { name: 'claude-sonnet', displayName: 'Claude Sonnet', percentage: Infinity },
      ];
      expect(getMinClaudeQuota(models)).toBeNull();
    });
  });

  describe('real-world scenarios', () => {
    it('matches screenshot scenario - Claude 95%, Gemini 100%', () => {
      const models = [
        {
          name: 'claude-opus-4-5-thinking',
          displayName: 'Claude Opus 4.5 (Thinking)',
          percentage: 95,
        },
        { name: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', percentage: 95 },
        {
          name: 'claude-sonnet-4-5-thinking',
          displayName: 'Claude Sonnet 4.5 (Thinking)',
          percentage: 95,
        },
        { name: 'gemini-2-5-flash', displayName: 'Gemini 2.5 Flash', percentage: 100 },
        {
          name: 'gemini-2-5-flash-thinking',
          displayName: 'Gemini 2.5 Flash (Thinking)',
          percentage: 100,
        },
        { name: 'gemini-2-5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', percentage: 100 },
        { name: 'gemini-2-5-pro', displayName: 'Gemini 2.5 Pro', percentage: 100 },
        { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash', percentage: 98 },
        { name: 'gemini-3-pro-high', displayName: 'Gemini 3 Pro (High)', percentage: 100 },
        { name: 'gemini-3-pro-low', displayName: 'Gemini 3 Pro (Low)', percentage: 100 },
        { name: 'gpt-oss-120b', displayName: 'GPT-OSS 120B (Medium)', percentage: 95 },
      ];
      // Should return 95 (min of Claude), not 99 (avg of all)
      expect(getMinClaudeQuota(models)).toBe(95);
    });

    it('handles mixed Claude percentages', () => {
      const models = [
        { name: 'claude-opus-4', displayName: 'Claude Opus 4', percentage: 80 },
        { name: 'claude-sonnet-4', displayName: 'Claude Sonnet 4', percentage: 95 },
        { name: 'claude-haiku-3', displayName: 'Claude Haiku 3', percentage: 100 },
        { name: 'gemini-flash', displayName: 'Gemini Flash', percentage: 100 },
      ];
      expect(getMinClaudeQuota(models)).toBe(80);
    });
  });
});

describe('sortModelsByPriority', () => {
  it('sorts Claude models first', () => {
    const models = [
      { name: 'gemini-flash', displayName: 'Gemini Flash' },
      { name: 'claude-opus', displayName: 'Claude Opus' },
      { name: 'gpt-4', displayName: 'GPT-4' },
    ];
    const sorted = sortModelsByPriority(models);
    expect(sorted[0].name).toBe('claude-opus');
    expect(sorted[1].name).toBe('gemini-flash');
    expect(sorted[2].name).toBe('gpt-4');
  });

  it('sorts alphabetically within same priority', () => {
    const models = [
      { name: 'claude-sonnet', displayName: 'Claude Sonnet' },
      { name: 'claude-opus', displayName: 'Claude Opus' },
      { name: 'claude-haiku', displayName: 'Claude Haiku' },
    ];
    const sorted = sortModelsByPriority(models);
    expect(sorted[0].displayName).toBe('Claude Haiku');
    expect(sorted[1].displayName).toBe('Claude Opus');
    expect(sorted[2].displayName).toBe('Claude Sonnet');
  });

  it('does not mutate original array', () => {
    const models = [
      { name: 'gemini-flash', displayName: 'Gemini Flash' },
      { name: 'claude-opus', displayName: 'Claude Opus' },
    ];
    const original = [...models];
    sortModelsByPriority(models);
    expect(models).toEqual(original);
  });
});

describe('getEarliestResetTime', () => {
  it('returns null for empty array', () => {
    expect(getEarliestResetTime([])).toBeNull();
  });

  it('returns null when all resetTime are null', () => {
    const models = [{ resetTime: null }, { resetTime: null }];
    expect(getEarliestResetTime(models)).toBeNull();
  });

  it('returns earliest reset time', () => {
    const models = [
      { resetTime: '2026-01-01T16:00:00Z' },
      { resetTime: '2026-01-01T14:00:00Z' },
      { resetTime: '2026-01-01T18:00:00Z' },
    ];
    expect(getEarliestResetTime(models)).toBe('2026-01-01T14:00:00Z');
  });

  it('handles mixed null and valid reset times', () => {
    const models = [
      { resetTime: null },
      { resetTime: '2026-01-01T14:00:00Z' },
      { resetTime: null },
    ];
    expect(getEarliestResetTime(models)).toBe('2026-01-01T14:00:00Z');
  });
});
