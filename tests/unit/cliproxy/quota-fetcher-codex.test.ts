/**
 * Codex Quota Fetcher Unit Tests
 *
 * Tests for Codex quota window parsing and transformation logic
 */

import { describe, it, expect } from 'bun:test';
import { buildCodexQuotaWindows } from '../../../src/cliproxy/quota-fetcher-codex';

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
});
