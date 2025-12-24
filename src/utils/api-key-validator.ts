/**
 * API Key Pre-flight Validator
 *
 * Quick validation of API keys before Claude CLI launch.
 * Catches expired keys early with actionable error messages.
 */

import * as https from 'https';
import { URL } from 'url';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/** Default placeholders that indicate unconfigured keys */
const DEFAULT_PLACEHOLDERS = [
  'YOUR_GLM_API_KEY_HERE',
  'YOUR_KIMI_API_KEY_HERE',
  'YOUR_API_KEY_HERE',
  'your-api-key-here',
  'PLACEHOLDER',
  '',
];

/**
 * Validate GLM API key with quick health check
 *
 * @param apiKey - The ANTHROPIC_AUTH_TOKEN value
 * @param baseUrl - Optional base URL (defaults to Z.AI)
 * @param timeoutMs - Timeout in milliseconds (default 2000)
 */
export async function validateGlmKey(
  apiKey: string,
  baseUrl?: string,
  timeoutMs = 2000
): Promise<ValidationResult> {
  // Skip if disabled
  if (process.env.CCS_SKIP_PREFLIGHT === '1') {
    return { valid: true };
  }

  // Basic format check - detect placeholders
  if (!apiKey || DEFAULT_PLACEHOLDERS.includes(apiKey.toUpperCase())) {
    return {
      valid: false,
      error: 'API key not configured',
      suggestion:
        'Set ANTHROPIC_AUTH_TOKEN in ~/.ccs/glm.settings.json\n' +
        'Or run: ccs config -> API Profiles -> GLM',
    };
  }

  // Determine validation endpoint
  // Z.AI uses /api/anthropic path, we can test with a minimal request
  const targetBase = baseUrl || 'https://api.z.ai';
  let url: URL;
  try {
    url = new URL('/api/anthropic/v1/models', targetBase);
  } catch {
    // Invalid URL - fail-open
    return { valid: true };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // Fail-open on timeout - let Claude CLI handle it
      resolve({ valid: true });
    }, timeoutMs);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'CCS-Preflight/1.0',
      },
    };

    const req = https.request(options, (res) => {
      clearTimeout(timeout);

      if (res.statusCode === 200) {
        resolve({ valid: true });
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        resolve({
          valid: false,
          error: 'API key rejected by Z.AI',
          suggestion:
            'Your key may have expired. To fix:\n' +
            '  1. Go to Z.AI dashboard and regenerate your API key\n' +
            '  2. Update ~/.ccs/glm.settings.json with the new key\n' +
            '  3. Or run: ccs config -> API Profiles -> GLM',
        });
      } else {
        // Other errors (404, 500, etc.) - fail-open, let Claude CLI handle
        resolve({ valid: true });
      }

      // Consume response body to free resources
      res.resume();
    });

    req.on('error', () => {
      clearTimeout(timeout);
      // Network error - fail-open
      resolve({ valid: true });
    });

    req.end();
  });
}
