/**
 * Cursor IDE Type Definitions
 *
 * TypeScript interfaces for the Cursor auth module.
 */

/**
 * Cursor authentication credentials
 */
export interface CursorCredentials {
  /** Access token from Cursor IDE */
  accessToken: string;
  /** Machine ID for checksum generation */
  machineId: string;
  /** User email (if available from token) */
  email?: string;
  /** User ID (if available from token) */
  userId?: string;
  /** How credentials were obtained */
  authMethod: 'auto-detect' | 'manual';
  /** ISO datetime when credentials were imported */
  importedAt: string;
}

/**
 * Cursor authentication status
 */
export interface CursorAuthStatus {
  /** Whether user is authenticated */
  authenticated: boolean;
  /** Current credentials (if authenticated) */
  credentials?: CursorCredentials;
  /** Hours since credentials were imported (if available) */
  tokenAge?: number;
  /** Whether token has expired (>24 hours old) */
  expired?: boolean;
}

/**
 * Auto-detection result
 */
export interface AutoDetectResult {
  /** Whether tokens were found */
  found: boolean;
  /** Access token (if found) */
  accessToken?: string;
  /** Machine ID (if found) */
  machineId?: string;
  /** Error message (if detection failed) */
  error?: string;
}
