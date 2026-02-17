/**
 * Cursor Routes Tests
 * Endpoint contract tests without module-level mocks.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';
import { execFileSync, spawnSync } from 'child_process';

let server: Server;
let baseUrl = '';
let tempDir = '';
let originalCcsHome: string | undefined;

let setGlobalConfigDir: (dir: string | undefined) => void;
let getCcsDir: () => string;
let loadOrCreateUnifiedConfig: () => {
  cursor?: {
    enabled?: boolean;
    port?: number;
    auto_start?: boolean;
    ghost_mode?: boolean;
    model?: string;
  };
};
let saveUnifiedConfig: (config: {
  cursor?: {
    enabled?: boolean;
    port?: number;
    auto_start?: boolean;
    ghost_mode?: boolean;
    model?: string;
  };
}) => void;
let saveCredentials: (credentials: {
  accessToken: string;
  machineId: string;
  authMethod: 'manual' | 'auto-detect';
  importedAt: string;
}) => void;
let deleteCredentials: () => boolean;
let checkAuthStatus: () => {
  authenticated: boolean;
  expired?: boolean;
  credentials?: {
    authMethod?: 'manual' | 'auto-detect';
    machineId?: string;
  };
};
let getTokenStoragePath: () => string;
let getDaemonStartPreconditionError: (
  input: { enabled: boolean; authenticated: boolean; tokenExpired?: boolean }
) => { status: number; error: string } | null;

function seedCursorConfig(overrides: {
  enabled?: boolean;
  port?: number;
  auto_start?: boolean;
  ghost_mode?: boolean;
  model?: string;
} = {}): void {
  const config = loadOrCreateUnifiedConfig();
  config.cursor = {
    enabled: overrides.enabled ?? true,
    port: overrides.port ?? 20129,
    auto_start: overrides.auto_start ?? false,
    ghost_mode: overrides.ghost_mode ?? true,
    model: overrides.model ?? 'gpt-5.3-codex',
  };
  saveUnifiedConfig(config);
}

function seedCredentials(expired: boolean): void {
  saveCredentials({
    accessToken: 'a'.repeat(60),
    machineId: '1234567890abcdef1234567890abcdef',
    authMethod: 'manual',
    importedAt: expired
      ? new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString(),
  });
}

beforeAll(async () => {
  originalCcsHome = process.env.CCS_HOME;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-cursor-routes-test-'));
  process.env.CCS_HOME = tempDir;

  const configManager = await import('../../../src/utils/config-manager');
  setGlobalConfigDir = configManager.setGlobalConfigDir;
  getCcsDir = configManager.getCcsDir;
  setGlobalConfigDir(undefined);

  const unifiedConfig = await import('../../../src/config/unified-config-loader');
  loadOrCreateUnifiedConfig = unifiedConfig.loadOrCreateUnifiedConfig;
  saveUnifiedConfig = unifiedConfig.saveUnifiedConfig;

  const cursorAuth = await import('../../../src/cursor/cursor-auth');
  saveCredentials = cursorAuth.saveCredentials;
  deleteCredentials = cursorAuth.deleteCredentials;
  checkAuthStatus = cursorAuth.checkAuthStatus;
  getTokenStoragePath = cursorAuth.getTokenStoragePath;

  const cursorRoutesModule = await import('../../../src/web-server/routes/cursor-routes');
  getDaemonStartPreconditionError = cursorRoutesModule.getDaemonStartPreconditionError;

  const app = express();
  app.use(express.json());
  app.use('/api/cursor', cursorRoutesModule.default);

  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve test server port');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  setGlobalConfigDir(undefined);
  const ccsDir = getCcsDir();
  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  seedCursorConfig();

  // Ensure clean auth state for each test.
  deleteCredentials();
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  if (originalCcsHome !== undefined) {
    process.env.CCS_HOME = originalCcsHome;
  } else {
    delete process.env.CCS_HOME;
  }
  setGlobalConfigDir(undefined);

  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

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

  describe('HTTP contracts', () => {
    it('GET /api/cursor/status returns current state', async () => {
      const res = await fetch(`${baseUrl}/api/cursor/status`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        enabled: boolean;
        authenticated: boolean;
        token_expired: boolean;
        daemon_running: boolean;
        port: number;
      };

      expect(json.enabled).toBe(true);
      expect(json.authenticated).toBe(false);
      expect(json.token_expired).toBe(false);
      expect(json.daemon_running).toBe(false);
      expect(json.port).toBe(20129);
    });

    it('POST /api/cursor/auth/import validates required fields', async () => {
      const res = await fetch(`${baseUrl}/api/cursor/auth/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'only-token' }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toContain('Missing accessToken or machineId');
    });

    it('POST /api/cursor/auth/import rejects invalid token format', async () => {
      const res = await fetch(`${baseUrl}/api/cursor/auth/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: 'short',
          machineId: 'bad',
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toContain('Invalid token or machine ID format');
      expect(checkAuthStatus().authenticated).toBe(false);
    });

    it('POST /api/cursor/auth/import persists valid credentials', async () => {
      const res = await fetch(`${baseUrl}/api/cursor/auth/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: 'a'.repeat(60),
          machineId: '1234567890abcdef1234567890abcdef',
        }),
      });

      expect(res.status).toBe(200);
      expect(checkAuthStatus().authenticated).toBe(true);
    });

    it('POST /api/cursor/auth/auto-detect returns 404 when no token source found', async () => {
      const originalHome = process.env.HOME;
      const isolatedHome = path.join(tempDir, 'auto-detect-empty-home');
      process.env.HOME = isolatedHome;
      fs.mkdirSync(isolatedHome, { recursive: true });

      try {
        const res = await fetch(`${baseUrl}/api/cursor/auth/auto-detect`, {
          method: 'POST',
        });

        expect(res.status).toBe(404);
        const json = (await res.json()) as { error?: string };
        expect(typeof json.error).toBe('string');
        expect(json.error?.length).toBeGreaterThan(0);
      } finally {
        if (originalHome !== undefined) {
          process.env.HOME = originalHome;
        } else {
          delete process.env.HOME;
        }
      }
    });

    it('POST /api/cursor/auth/auto-detect persists credentials on success', async () => {
      if (process.platform === 'win32') {
        return;
      }

      const sqliteCheck = spawnSync('sqlite3', ['--version'], { stdio: 'ignore' });
      if (sqliteCheck.status !== 0) {
        return;
      }

      const originalHome = process.env.HOME;
      const fakeHome = path.join(tempDir, 'fake-home');
      process.env.HOME = fakeHome;
      fs.mkdirSync(fakeHome, { recursive: true });

      const token = 'a'.repeat(60);
      const machineId = '1234567890abcdef1234567890abcdef';

      try {
        const dbPath = getTokenStoragePath();
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        execFileSync('sqlite3', [dbPath, 'CREATE TABLE IF NOT EXISTS itemTable (key TEXT PRIMARY KEY, value TEXT);']);
        execFileSync('sqlite3', [
          dbPath,
          `INSERT OR REPLACE INTO itemTable (key, value) VALUES ('cursorAuth/accessToken', '${token}');`,
        ]);
        execFileSync('sqlite3', [
          dbPath,
          `INSERT OR REPLACE INTO itemTable (key, value) VALUES ('storage.serviceMachineId', '${machineId}');`,
        ]);

        const res = await fetch(`${baseUrl}/api/cursor/auth/auto-detect`, {
          method: 'POST',
        });

        expect(res.status).toBe(200);
        const json = (await res.json()) as { success?: boolean };
        expect(json.success).toBe(true);

        const auth = checkAuthStatus();
        expect(auth.authenticated).toBe(true);
        expect(auth.credentials?.authMethod).toBe('auto-detect');
        expect(auth.credentials?.machineId).toBe(machineId);
      } finally {
        if (originalHome !== undefined) {
          process.env.HOME = originalHome;
        } else {
          delete process.env.HOME;
        }
      }
    });

    it('POST /api/cursor/daemon/start returns 400 when integration is disabled', async () => {
      seedCursorConfig({ enabled: false });
      seedCredentials(false);

      const res = await fetch(`${baseUrl}/api/cursor/daemon/start`, { method: 'POST' });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success?: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toContain('disabled');
    });

    it('POST /api/cursor/daemon/start returns 401 when unauthenticated', async () => {
      seedCursorConfig({ enabled: true });

      const res = await fetch(`${baseUrl}/api/cursor/daemon/start`, { method: 'POST' });
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toContain('authentication required');
    });

    it('POST /api/cursor/daemon/start returns 401 when token is expired', async () => {
      seedCursorConfig({ enabled: true });
      seedCredentials(true);

      const res = await fetch(`${baseUrl}/api/cursor/daemon/start`, { method: 'POST' });
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toContain('expired');
    });

    it(
      'POST /api/cursor/daemon/start starts daemon and /daemon/stop stops it',
      async () => {
        const port = 15000 + Math.floor(Math.random() * 20000);
        seedCursorConfig({ enabled: true, port });
        seedCredentials(false);

        const startRes = await fetch(`${baseUrl}/api/cursor/daemon/start`, { method: 'POST' });
        expect(startRes.status).toBe(200);

        const startJson = (await startRes.json()) as { success?: boolean; pid?: number };
        expect(startJson.success).toBe(true);
        expect(typeof startJson.pid).toBe('number');

        const stopRes = await fetch(`${baseUrl}/api/cursor/daemon/stop`, { method: 'POST' });
        expect(stopRes.status).toBe(200);
        const stopJson = (await stopRes.json()) as { success?: boolean };
        expect(stopJson.success).toBe(true);
      },
      35000
    );

    it('POST /api/cursor/daemon/stop returns success when daemon is not running', async () => {
      const res = await fetch(`${baseUrl}/api/cursor/daemon/stop`, { method: 'POST' });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success?: boolean };
      expect(json.success).toBe(true);
    });

    it('GET /api/cursor/models returns current model and list payload', async () => {
      const res = await fetch(`${baseUrl}/api/cursor/models`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { models: Array<{ id: string }>; current: string };
      expect(Array.isArray(json.models)).toBe(true);
      expect(json.models.length).toBeGreaterThan(0);
      expect(json.current).toBe('gpt-5.3-codex');
    });
  });
});
