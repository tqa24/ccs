/**
 * Shared Authentication Utilities
 *
 * Common functions for OAuth token handling across quota fetchers.
 */

/**
 * Sanitize email to match CLIProxyAPI auth file naming convention.
 * Replaces @ and . with underscores for filesystem compatibility.
 */
export function sanitizeEmail(email: string): string {
  return email.replace(/@/g, '_').replace(/\./g, '_');
}

/**
 * Check if token is expired based on the expired timestamp.
 * Returns false if timestamp is missing or invalid (fail-open for quota display).
 */
export function isTokenExpired(expiredStr?: string): boolean {
  if (!expiredStr) return false;
  try {
    const expiredDate = new Date(expiredStr);
    return expiredDate.getTime() < Date.now();
  } catch {
    return false;
  }
}
