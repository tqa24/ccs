import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';
import configRoutes from '../../../src/web-server/routes/config-routes';
import { createEmptyUnifiedConfig } from '../../../src/config/unified-config-types';
import { loadUnifiedConfig } from '../../../src/config/unified-config-loader';

async function putJson(baseUrl: string, routePath: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${routePath}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function postJson(baseUrl: string, routePath: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${routePath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('web-server config-routes account context validation', () => {
  let server: Server;
  let baseUrl = '';
  let tempHome = '';
  let originalCcsHome: string | undefined;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/config', configRoutes);

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1');
      const handleError = (error: Error) => reject(error);
      server.once('error', handleError);
      server.once('listening', () => {
        server.off('error', handleError);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve test server port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-config-routes-context-'));
    originalCcsHome = process.env.CCS_HOME;
    process.env.CCS_HOME = tempHome;
    fs.mkdirSync(path.join(tempHome, '.ccs'), { recursive: true });
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) process.env.CCS_HOME = originalCcsHome;
    else delete process.env.CCS_HOME;

    if (tempHome && fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('rejects invalid account context_mode values', async () => {
    const response = await putJson(baseUrl, '/api/config', {
      version: 8,
      accounts: {
        work: {
          created: '2026-01-01T00:00:00.000Z',
          last_used: null,
          context_mode: 'weird',
        },
      },
      profiles: {},
      cliproxy: { oauth_accounts: {}, providers: [], variants: {} },
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('context_mode');
  });

  it('rejects context_group when mode is not shared', async () => {
    const response = await putJson(baseUrl, '/api/config', {
      version: 8,
      accounts: {
        work: {
          created: '2026-01-01T00:00:00.000Z',
          last_used: null,
          context_mode: 'isolated',
          context_group: 'sprint-a',
        },
      },
      profiles: {},
      cliproxy: { oauth_accounts: {}, providers: [], variants: {} },
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('context_group requires context_mode=shared');
  });

  it('rejects invalid shared context_group names', async () => {
    const response = await putJson(baseUrl, '/api/config', {
      version: 8,
      accounts: {
        work: {
          created: '2026-01-01T00:00:00.000Z',
          last_used: null,
          context_mode: 'shared',
          context_group: '###',
        },
      },
      profiles: {},
      cliproxy: { oauth_accounts: {}, providers: [], variants: {} },
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('context_group');
  });

  it('rejects whitespace-only shared context_group values', async () => {
    const response = await putJson(baseUrl, '/api/config', {
      version: 8,
      accounts: {
        work: {
          created: '2026-01-01T00:00:00.000Z',
          last_used: null,
          context_mode: 'shared',
          context_group: '   ',
        },
      },
      profiles: {},
      cliproxy: { oauth_accounts: {}, providers: [], variants: {} },
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('requires a non-empty value');
  });

  it('accepts valid shared context metadata', async () => {
    const config = createEmptyUnifiedConfig();
    config.accounts.work = {
      created: '2026-01-01T00:00:00.000Z',
      last_used: null,
      context_mode: 'shared',
      context_group: 'Sprint-A',
    };
    const response = await putJson(baseUrl, '/api/config', config);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean };
    expect(payload.success).toBe(true);

    const savedConfig = loadUnifiedConfig();
    expect(savedConfig?.accounts.work.context_group).toBe('sprint-a');
  });

  it('returns alreadyMigrated when migration is not needed', async () => {
    const response = await postJson(baseUrl, '/api/config/migrate');

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      migratedFiles: string[];
      warnings: string[];
      alreadyMigrated?: boolean;
    };
    expect(payload.success).toBe(true);
    expect(payload.migratedFiles).toEqual([]);
    expect(payload.warnings).toEqual([]);
    expect(payload.alreadyMigrated).toBe(true);
  });
});
