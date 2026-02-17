/**
 * Codex Quota Fetcher Unit Tests
 *
 * Tests for Codex quota window parsing and transformation logic
 */

import { describe, it, expect } from 'bun:test';
import {
  buildCodexQuotaWindows,
  buildCodexCoreUsageSummary,
  getUnknownCodexWindowLabels,
} from '../../../src/cliproxy/quota-fetcher-codex';

describe('Codex Quota Fetcher', () => {
  describe('buildCodexQuotaWindows', () => {
    it('should parse snake_case API response', () => {
      const response = {
        rate_limit: {
          primary_window: {
            used_percent: 25,
            reset_after_seconds: 3600,
          },
          secondary_window: {
            used_percent: 50,
            reset_after_seconds: 86400,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows).toHaveLength(2);
      expect(windows[0].label).toBe('Primary');
      expect(windows[0].usedPercent).toBe(25);
      expect(windows[0].remainingPercent).toBe(75);
      expect(windows[0].resetAfterSeconds).toBe(3600);
      expect(windows[1].label).toBe('Secondary');
      expect(windows[1].usedPercent).toBe(50);
    });

    it('should parse camelCase API response', () => {
      const response = {
        rateLimit: {
          primaryWindow: {
            usedPercent: 30,
            resetAfterSeconds: 7200,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows).toHaveLength(1);
      expect(windows[0].usedPercent).toBe(30);
      expect(windows[0].resetAfterSeconds).toBe(7200);
    });

    it('should handle code review rate limits', () => {
      const response = {
        code_review_rate_limit: {
          primary_window: {
            used_percent: 80,
            reset_after_seconds: 1800,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows).toHaveLength(1);
      expect(windows[0].label).toBe('Code Review (Primary)');
      expect(windows[0].usedPercent).toBe(80);
    });

    it('should clamp usedPercent to 0-100 range', () => {
      const response = {
        rate_limit: {
          primary_window: {
            used_percent: 150, // Over 100
            reset_after_seconds: null,
          },
          secondary_window: {
            used_percent: -20, // Negative
            reset_after_seconds: null,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows[0].usedPercent).toBe(100);
      expect(windows[0].remainingPercent).toBe(0);
      expect(windows[1].usedPercent).toBe(0);
      expect(windows[1].remainingPercent).toBe(100);
    });

    it('should handle null reset_after_seconds', () => {
      const response = {
        rate_limit: {
          primary_window: {
            used_percent: 10,
            reset_after_seconds: null,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows[0].resetAfterSeconds).toBeNull();
      expect(windows[0].resetAt).toBeNull();
    });

    it('should calculate resetAt from positive seconds', () => {
      const response = {
        rate_limit: {
          primary_window: {
            used_percent: 10,
            reset_after_seconds: 3600, // 1 hour
          },
        },
      };

      const before = Date.now();
      const windows = buildCodexQuotaWindows(response);
      const after = Date.now();

      expect(windows[0].resetAt).not.toBeNull();
      const resetTime = new Date(windows[0].resetAt!).getTime();
      expect(resetTime).toBeGreaterThanOrEqual(before + 3600000);
      expect(resetTime).toBeLessThanOrEqual(after + 3600000);
    });

    it('should not calculate resetAt for zero or negative seconds', () => {
      const response = {
        rate_limit: {
          primary_window: {
            used_percent: 10,
            reset_after_seconds: 0,
          },
          secondary_window: {
            used_percent: 20,
            reset_after_seconds: -100,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows[0].resetAt).toBeNull();
      expect(windows[1].resetAt).toBeNull();
    });

    it('should return empty array for empty response', () => {
      const windows = buildCodexQuotaWindows({});
      expect(windows).toHaveLength(0);
    });

    it('should return empty array for missing rate limit', () => {
      const response = {
        plan_type: 'plus',
      };

      const windows = buildCodexQuotaWindows(response);
      expect(windows).toHaveLength(0);
    });

    it('should handle missing window data gracefully', () => {
      const response = {
        rate_limit: {
          primary_window: undefined,
          secondary_window: null,
        },
      };

      const windows = buildCodexQuotaWindows(response as never);
      expect(windows).toHaveLength(0);
    });

    it('should default usedPercent to 0 when missing', () => {
      const response = {
        rate_limit: {
          primary_window: {
            reset_after_seconds: 3600,
          },
        },
      };

      const windows = buildCodexQuotaWindows(response);

      expect(windows[0].usedPercent).toBe(0);
      expect(windows[0].remainingPercent).toBe(100);
    });
  });

  describe('buildCodexCoreUsageSummary', () => {
    it('extracts 5h and weekly windows from labeled usage windows', () => {
      const windows = buildCodexQuotaWindows({
        rate_limit: {
          primary_window: {
            used_percent: 35,
            reset_after_seconds: 18000,
          },
          secondary_window: {
            used_percent: 60,
            reset_after_seconds: 604800,
          },
        },
      });

      const summary = buildCodexCoreUsageSummary(windows);

      expect(summary.fiveHour?.label).toBe('Primary');
      expect(summary.fiveHour?.remainingPercent).toBe(65);
      expect(summary.fiveHour?.resetAfterSeconds).toBe(18000);
      expect(summary.weekly?.label).toBe('Secondary');
      expect(summary.weekly?.remainingPercent).toBe(40);
      expect(summary.weekly?.resetAfterSeconds).toBe(604800);
    });

    it('falls back to shortest and longest reset windows when labels are unknown', () => {
      const windows = [
        {
          label: 'Window A',
          usedPercent: 20,
          remainingPercent: 80,
          resetAfterSeconds: 18000,
          resetAt: '2026-02-15T15:00:00Z',
        },
        {
          label: 'Window B',
          usedPercent: 45,
          remainingPercent: 55,
          resetAfterSeconds: 604800,
          resetAt: '2026-02-21T10:00:00Z',
        },
        {
          label: 'Code Review (Primary)',
          usedPercent: 10,
          remainingPercent: 90,
          resetAfterSeconds: 3600,
          resetAt: '2026-02-15T11:00:00Z',
        },
      ];

      const summary = buildCodexCoreUsageSummary(windows);

      expect(summary.fiveHour?.label).toBe('Window A');
      expect(summary.fiveHour?.resetAfterSeconds).toBe(18000);
      expect(summary.weekly?.label).toBe('Window B');
      expect(summary.weekly?.resetAfterSeconds).toBe(604800);
    });

    it('returns null summaries when no windows are available', () => {
      const summary = buildCodexCoreUsageSummary([]);
      expect(summary.fiveHour).toBeNull();
      expect(summary.weekly).toBeNull();
    });
  });

  describe('getUnknownCodexWindowLabels', () => {
    it('returns unknown labels and de-duplicates them', () => {
      const labels = getUnknownCodexWindowLabels([
        {
          label: 'Window A',
          usedPercent: 1,
          remainingPercent: 99,
          resetAfterSeconds: 10,
          resetAt: null,
        },
        {
          label: 'Window A',
          usedPercent: 2,
          remainingPercent: 98,
          resetAfterSeconds: 20,
          resetAt: null,
        },
        {
          label: 'Primary',
          usedPercent: 3,
          remainingPercent: 97,
          resetAfterSeconds: 30,
          resetAt: null,
        },
      ]);

      expect(labels).toEqual(['Window A']);
    });

    it('returns empty array when all labels are recognized', () => {
      const labels = getUnknownCodexWindowLabels([
        {
          label: 'Primary',
          usedPercent: 10,
          remainingPercent: 90,
          resetAfterSeconds: 100,
          resetAt: null,
        },
        {
          label: 'Code Review (Secondary)',
          usedPercent: 20,
          remainingPercent: 80,
          resetAfterSeconds: 200,
          resetAt: null,
        },
      ]);

      expect(labels).toEqual([]);
    });
  });
});
