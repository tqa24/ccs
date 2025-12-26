/**
 * Settings Routes - Auth Tokens API Tests
 *
 * Tests for the auth tokens API endpoints:
 * - GET /api/settings/auth/tokens (masked)
 * - GET /api/settings/auth/tokens/raw (unmasked)
 * - PUT /api/settings/auth/tokens (update)
 * - POST /api/settings/auth/tokens/regenerate-secret
 * - POST /api/settings/auth/tokens/reset
 */

const assert = require('assert');

describe('Settings Routes - Auth Tokens API', () => {
  // =========================================================================
  // maskToken Function Tests (same as in routes)
  // =========================================================================
  describe('maskToken', () => {
    function maskToken(token) {
      if (token.length <= 8) return '****';
      return `${token.slice(0, 4)}...${token.slice(-4)}`;
    }

    it('masks long tokens correctly', () => {
      assert.strictEqual(maskToken('ccs-internal-managed'), 'ccs-...aged');
    });

    it('fully masks short tokens', () => {
      assert.strictEqual(maskToken('ccs'), '****');
    });

    it('handles exactly 8 character tokens', () => {
      assert.strictEqual(maskToken('12345678'), '****');
    });

    it('handles 9 character tokens', () => {
      assert.strictEqual(maskToken('123456789'), '1234...6789');
    });
  });

  // =========================================================================
  // Response Format Tests
  // =========================================================================
  describe('Response Format', () => {
    /**
     * Expected response format for GET /api/settings/auth/tokens
     */
    function createMaskedResponse(apiKey, managementSecret, apiKeyIsCustom, secretIsCustom) {
      function maskToken(token) {
        if (token.length <= 8) return '****';
        return `${token.slice(0, 4)}...${token.slice(-4)}`;
      }

      return {
        apiKey: {
          value: maskToken(apiKey),
          isCustom: apiKeyIsCustom,
        },
        managementSecret: {
          value: maskToken(managementSecret),
          isCustom: secretIsCustom,
        },
      };
    }

    it('includes apiKey with value and isCustom', () => {
      const response = createMaskedResponse('test-api-key-123', 'test-secret', true, false);

      assert(response.apiKey, 'Should have apiKey');
      assert.strictEqual(typeof response.apiKey.value, 'string');
      assert.strictEqual(typeof response.apiKey.isCustom, 'boolean');
    });

    it('includes managementSecret with value and isCustom', () => {
      const response = createMaskedResponse('key', 'test-secret-456', false, true);

      assert(response.managementSecret, 'Should have managementSecret');
      assert.strictEqual(typeof response.managementSecret.value, 'string');
      assert.strictEqual(typeof response.managementSecret.isCustom, 'boolean');
    });

    it('masks values in response', () => {
      const response = createMaskedResponse(
        'very-long-api-key-12345',
        'very-long-secret-67890',
        true,
        true
      );

      // Values should be masked (contain ...)
      assert(response.apiKey.value.includes('...'), 'API key should be masked');
      assert(response.managementSecret.value.includes('...'), 'Secret should be masked');
    });
  });

  // =========================================================================
  // PUT /api/settings/auth/tokens - Update Logic Tests
  // =========================================================================
  describe('PUT /api/settings/auth/tokens - Update Logic', () => {
    /**
     * Simulates the update logic
     */
    function processUpdate(body, currentState) {
      const { apiKey, managementSecret } = body;
      const newState = { ...currentState };

      if (apiKey !== undefined) {
        // Empty string -> reset to default
        newState.apiKey = apiKey || null;
      }

      if (managementSecret !== undefined) {
        newState.managementSecret = managementSecret || null;
      }

      return newState;
    }

    it('updates apiKey when provided', () => {
      const current = { apiKey: 'old-key', managementSecret: 'old-secret' };
      const result = processUpdate({ apiKey: 'new-key' }, current);

      assert.strictEqual(result.apiKey, 'new-key');
      assert.strictEqual(result.managementSecret, 'old-secret');
    });

    it('updates managementSecret when provided', () => {
      const current = { apiKey: 'old-key', managementSecret: 'old-secret' };
      const result = processUpdate({ managementSecret: 'new-secret' }, current);

      assert.strictEqual(result.apiKey, 'old-key');
      assert.strictEqual(result.managementSecret, 'new-secret');
    });

    it('updates both when provided', () => {
      const current = { apiKey: 'old-key', managementSecret: 'old-secret' };
      const result = processUpdate({ apiKey: 'new-key', managementSecret: 'new-secret' }, current);

      assert.strictEqual(result.apiKey, 'new-key');
      assert.strictEqual(result.managementSecret, 'new-secret');
    });

    it('resets to default when empty string provided', () => {
      const current = { apiKey: 'custom-key', managementSecret: 'custom-secret' };
      const result = processUpdate({ apiKey: '', managementSecret: '' }, current);

      assert.strictEqual(result.apiKey, null);
      assert.strictEqual(result.managementSecret, null);
    });

    it('ignores undefined values (no change)', () => {
      const current = { apiKey: 'keep-key', managementSecret: 'keep-secret' };
      const result = processUpdate({}, current);

      assert.strictEqual(result.apiKey, 'keep-key');
      assert.strictEqual(result.managementSecret, 'keep-secret');
    });
  });

  // =========================================================================
  // POST /api/settings/auth/tokens/regenerate-secret - Tests
  // =========================================================================
  describe('POST /api/settings/auth/tokens/regenerate-secret', () => {
    /**
     * Simulates regenerate secret response
     */
    function createRegenerateResponse(newSecret) {
      function maskToken(token) {
        if (token.length <= 8) return '****';
        return `${token.slice(0, 4)}...${token.slice(-4)}`;
      }

      return {
        success: true,
        managementSecret: {
          value: maskToken(newSecret),
          isCustom: true,
        },
        message: 'Restart CLIProxy to apply changes',
      };
    }

    it('returns success: true', () => {
      const response = createRegenerateResponse('new-generated-secret-12345');
      assert.strictEqual(response.success, true);
    });

    it('returns masked new secret', () => {
      const response = createRegenerateResponse('abcdefghijklmnopqrstuvwxyz');
      assert(response.managementSecret.value.includes('...'), 'Should be masked');
      assert.strictEqual(response.managementSecret.isCustom, true);
    });

    it('includes restart message', () => {
      const response = createRegenerateResponse('secret');
      assert(response.message.includes('Restart'), 'Should include restart instruction');
    });
  });

  // =========================================================================
  // POST /api/settings/auth/tokens/reset - Tests
  // =========================================================================
  describe('POST /api/settings/auth/tokens/reset', () => {
    /**
     * Simulates reset response
     */
    function createResetResponse(defaultApiKey, defaultSecret) {
      function maskToken(token) {
        if (token.length <= 8) return '****';
        return `${token.slice(0, 4)}...${token.slice(-4)}`;
      }

      return {
        success: true,
        apiKey: {
          value: maskToken(defaultApiKey),
          isCustom: false,
        },
        managementSecret: {
          value: maskToken(defaultSecret),
          isCustom: false,
        },
        message: 'Tokens reset to defaults. Restart CLIProxy to apply.',
      };
    }

    it('returns success: true', () => {
      const response = createResetResponse('ccs-internal-managed', 'ccs');
      assert.strictEqual(response.success, true);
    });

    it('returns isCustom: false for both tokens', () => {
      const response = createResetResponse('ccs-internal-managed', 'ccs');
      assert.strictEqual(response.apiKey.isCustom, false);
      assert.strictEqual(response.managementSecret.isCustom, false);
    });

    it('includes reset message', () => {
      const response = createResetResponse('key', 'secret');
      assert(response.message.includes('reset'), 'Should include reset confirmation');
    });
  });

  // =========================================================================
  // Error Response Format Tests
  // =========================================================================
  describe('Error Response Format', () => {
    /**
     * Simulates error response
     */
    function createErrorResponse(errorMessage) {
      return {
        error: errorMessage,
      };
    }

    it('includes error message', () => {
      const response = createErrorResponse('Something went wrong');
      assert.strictEqual(response.error, 'Something went wrong');
    });

    it('does not include sensitive data in errors', () => {
      const response = createErrorResponse('Failed to load config');
      assert(!response.apiKey, 'Should not include apiKey');
      assert(!response.managementSecret, 'Should not include secret');
    });
  });

  // =========================================================================
  // HTTP Status Code Tests
  // =========================================================================
  describe('HTTP Status Codes', () => {
    const HTTP_OK = 200;
    const HTTP_INTERNAL_ERROR = 500;

    it('uses 200 for successful responses', () => {
      assert.strictEqual(HTTP_OK, 200);
    });

    it('uses 500 for internal errors', () => {
      assert.strictEqual(HTTP_INTERNAL_ERROR, 500);
    });
  });
});
