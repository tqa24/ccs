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

import { execSync } from 'child_process';
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
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT value FROM itemTable WHERE key='${key}'" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Auto-detect tokens from Cursor's SQLite database
 */
export function autoDetectTokens(): AutoDetectResult {
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

  // Machine ID format validation (should be UUID-like)
  const uuidRegex = /^[a-f0-9-]{32,}$/i;
  if (!uuidRegex.test(machineId.replace(/-/g, ''))) {
    return false;
  }

  return true;
}

/**
 * Extract user info from token if possible
 * Cursor tokens may contain encoded user info as JWT
 */
export function extractUserInfo(accessToken: string): { email?: string; userId?: string } | null {
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
      );
      return {
        email: decoded.email || decoded.sub,
        userId: decoded.sub || decoded.user_id,
      };
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

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write credentials
  fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), 'utf8');
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

  // Calculate token age in hours
  let tokenAge: number | undefined;
  try {
    const importedDate = new Date(credentials.importedAt);
    const now = new Date();
    tokenAge = Math.floor((now.getTime() - importedDate.getTime()) / (1000 * 60 * 60));
  } catch {
    // Invalid date format
  }

  return {
    authenticated: true,
    credentials,
    tokenAge,
  };
}
