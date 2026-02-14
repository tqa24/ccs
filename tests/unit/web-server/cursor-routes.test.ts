/**
 * Cursor Routes Tests
 * Tests for daemon start precondition validation logic.
 */

import { describe, it, expect } from 'bun:test';
import { getDaemonStartPreconditionError } from '../../../src/web-server/routes/cursor-routes';

describe('Cursor Routes Logic', () => {
  describe('POST /daemon/start preconditions', () => {
    it('blocks start when integration is disabled', () => {
      const result = getDaemonStartPreconditionError({
        enabled: false,
        authenticated: true,
        tokenExpired: false,
      });

      expect(result).toEqual({
        status: 400,
        error: 'Cursor integration is disabled. Enable it before starting daemon.',
      });
    });

    it('blocks start when not authenticated', () => {
      const result = getDaemonStartPreconditionError({
        enabled: true,
        authenticated: false,
        tokenExpired: false,
      });

      expect(result).toEqual({
        status: 401,
        error: 'Cursor authentication required. Import credentials before starting daemon.',
      });
    });

    it('blocks start when token is expired', () => {
      const result = getDaemonStartPreconditionError({
        enabled: true,
        authenticated: true,
        tokenExpired: true,
      });

      expect(result).toEqual({
        status: 401,
        error: 'Cursor credentials expired. Re-authenticate before starting daemon.',
      });
    });

    it('allows start when all preconditions are met', () => {
      const result = getDaemonStartPreconditionError({
        enabled: true,
        authenticated: true,
        tokenExpired: false,
      });

      expect(result).toBeNull();
    });
  });
});
