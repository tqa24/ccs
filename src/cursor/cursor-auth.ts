/**
 * Cursor IDE Authentication Handler
 *
 * Handles token import and authentication for Cursor IDE integration.
 * Supports auto-detection from Cursor's SQLite database.
 *
 * Token Location:
 * - Linux: ~/.config/Cursor/User/globalStorage/state.vscdb
 * - macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
 * - Windows: %APPDATA%\Cursor\User\globalStorage\state.vscdb
 *
 * Database Keys:
 * - cursorAuth/accessToken: Access token
 * - storage.serviceMachineId: Machine ID for checksum
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CursorCredentials, CursorAuthStatus, AutoDetectResult } from './types';
import { getCcsDir } from '../utils/config-manager';

/**
 * Get platform-specific path to Cursor's state.vscdb
 */
export function getTokenStoragePath(): string {
  const platform = process.platform;
  const home = os.homedir();

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  } else if (platform === 'darwin') {
    return path.join(
      home,
      'Library',
      'Application Support',
      'Cursor',
      'User',
      'globalStorage',
      'state.vscdb'
    );
  } else {
    // Linux
    return path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  }
}

/**
 * Query Cursor's SQLite database using sqlite3 CLI
 */
function queryStateDb(dbPath: string, key: string): string | null {
  try {
    // Escape single quotes to prevent SQL injection
    const sanitizedKey = key.replace(/'/g, "''");
    const result = execFileSync(
      'sqlite3',
      [dbPath, `SELECT value FROM itemTable WHERE key='${sanitizedKey}'`],
      { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    return result || null;
  } catch (err) {
    // Check if sqlite3 is not installed
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // sqlite3 not found - could log this if needed
      return null;
    }
    return null;
  }
}

/**
 * Auto-detect tokens from Cursor's SQLite database
 */
export function autoDetectTokens(): AutoDetectResult {
  // sqlite3 CLI is not bundled with Windows
  if (process.platform === 'win32') {
    return {
      found: false,
      error:
        'Auto-detection is not supported on Windows. Please import tokens manually using ccs cursor auth --manual.',
    };
  }

  const dbPath = getTokenStoragePath();

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    return {
      found: false,
      error:
        'Cursor state database not found. Make sure Cursor IDE is installed and you are logged in.',
    };
  }

  // Try to query access token
  const accessToken = queryStateDb(dbPath, 'cursorAuth/accessToken');
  if (!accessToken) {
    return {
      found: false,
      error: 'Access token not found in database. Please log in to Cursor IDE first.',
    };
  }

  // Try to query machine ID
  const machineId = queryStateDb(dbPath, 'storage.serviceMachineId');
  if (!machineId) {
    return {
      found: false,
      error: 'Machine ID not found in database.',
    };
  }

  return {
    found: true,
    accessToken,
    machineId,
  };
}

/**
 * Validate token and machine ID format
 */
export function validateToken(accessToken: string, machineId: string): boolean {
  // Basic validation
  if (!accessToken || typeof accessToken !== 'string') {
    return false;
  }

  if (!machineId || typeof machineId !== 'string') {
    return false;
  }

  // Token format validation (Cursor tokens are typically long strings)
  if (accessToken.length < 50) {
    return false;
  }

  // Machine ID format validation (UUID without hyphens = exactly 32 hex chars)
  const hexRegex = /^[a-f0-9]{32}$/i;
  if (!hexRegex.test(machineId.replace(/-/g, ''))) {
    return false;
  }

  return true;
}

/**
 * Extract user info from token if possible
 * Cursor tokens may contain encoded user info as JWT
 */
export function extractUserInfo(
  accessToken: string
): { email?: string; userId?: string; exp?: number } | null {
  try {
    // Try to decode as JWT
    const parts = accessToken.split('.');
    if (parts.length === 3) {
      let payload = parts[1];
      // Add padding if needed
      while (payload.length % 4) {
        payload += '=';
      }
      const decoded = JSON.parse(
        Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
      ) as Record<string, unknown>;

      const email = typeof decoded.email === 'string' ? decoded.email : undefined;
      const userId =
        typeof decoded.sub === 'string'
          ? decoded.sub
          : typeof decoded.user_id === 'string'
            ? decoded.user_id
            : undefined;
      const exp = typeof decoded.exp === 'number' ? decoded.exp : undefined;

      // If all claims are undefined, treat as if JWT parsing failed
      if (!email && !userId && exp === undefined) return null;

      return { email, userId, exp };
    }
  } catch {
    // Token is not a JWT, that's okay
  }

  return null;
}

/**
 * Get path to credentials file
 */
export function getCredentialsPath(): string {
  return path.join(getCcsDir(), 'cursor', 'credentials.json');
}

/**
 * Save credentials to CCS config directory
 */
export function saveCredentials(credentials: CursorCredentials): void {
  const credPath = getCredentialsPath();
  const dir = path.dirname(credPath);

  // Ensure directory exists with restrictive permissions
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  // Write credentials with restrictive permissions
  fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

/**
 * Load credentials from CCS config directory
 */
export function loadCredentials(): CursorCredentials | null {
  const credPath = getCredentialsPath();

  if (!fs.existsSync(credPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(credPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    // Basic validation
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'accessToken' in parsed &&
      'machineId' in parsed &&
      'authMethod' in parsed &&
      'importedAt' in parsed
    ) {
      // Type validation
      if (
        typeof parsed.accessToken !== 'string' ||
        typeof parsed.machineId !== 'string' ||
        typeof parsed.importedAt !== 'string' ||
        (parsed.authMethod !== 'auto-detect' && parsed.authMethod !== 'manual')
      ) {
        return null;
      }

      return parsed as CursorCredentials;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check authentication status
 */
export function checkAuthStatus(): CursorAuthStatus {
  const credentials = loadCredentials();

  if (!credentials) {
    return { authenticated: false };
  }

  // Validate credentials are still valid format
  if (!validateToken(credentials.accessToken, credentials.machineId)) {
    return { authenticated: false };
  }

  // Try to get token expiry from JWT exp claim
  let tokenAge: number | undefined;
  let expired = false;
  const userInfo = extractUserInfo(credentials.accessToken);

  if (userInfo?.exp) {
    // Use JWT exp claim for expiry detection
    const now = Math.floor(Date.now() / 1000);
    expired = now >= userInfo.exp;
  }

  // Always use importedAt for tokenAge (more reliable than reverse-engineering JWT lifetime)
  const TOKEN_EXPIRY_HOURS = 24;
  const importedDate = new Date(credentials.importedAt);
  if (!isNaN(importedDate.getTime())) {
    const now = new Date();
    tokenAge = Math.floor((now.getTime() - importedDate.getTime()) / (1000 * 60 * 60));
    // Only set expired from importedAt if JWT exp was not available
    if (userInfo?.exp === undefined) {
      expired = tokenAge >= TOKEN_EXPIRY_HOURS;
    }
  }

  return {
    authenticated: true,
    credentials,
    tokenAge,
    expired,
  };
}

/**
 * Delete credentials file
 */
export function deleteCredentials(): boolean {
  try {
    fs.unlinkSync(getCredentialsPath());
    return true;
  } catch {
    return false;
  }
}
