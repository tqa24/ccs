import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import browserRoutes from '../../../src/web-server/routes/browser-routes';
import { loadOrCreateUnifiedConfig } from '../../../src/config/unified-config-loader';

describe('browser routes', () => {
  let server: Server;
  let baseUrl = '';
  let tempHome = '';
  let originalCcsHome: string | undefined;
  let originalDashboardAuthEnabled: string | undefined;
  let originalBrowserUserDataDir: string | undefined;
  let originalBrowserProfileDir: string | undefined;
  let originalBrowserDevtoolsPort: string | undefined;
  let originalBrowserDevtoolsHost: string | undefined;
  let originalBrowserDevtoolsHttpUrl: string | undefined;
  let originalBrowserDevtoolsWsUrl: string | undefined;
  let originalBrowserEvalMode: string | undefined;
  let forcedRemoteAddress = '127.0.0.1';

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', {
        value: forcedRemoteAddress,
        configurable: true,
      });
      next();
    });
    app.use('/api/browser', browserRoutes);

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1');
      const onError = (error: Error) => reject(error);

      server.once('error', onError);
      server.once('listening', () => {
        server.off('error', onError);
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
    tempHome = mkdtempSync(join(tmpdir(), 'ccs-browser-routes-'));
    originalCcsHome = process.env.CCS_HOME;
    originalDashboardAuthEnabled = process.env.CCS_DASHBOARD_AUTH_ENABLED;
    originalBrowserUserDataDir = process.env.CCS_BROWSER_USER_DATA_DIR;
    originalBrowserProfileDir = process.env.CCS_BROWSER_PROFILE_DIR;
    originalBrowserDevtoolsPort = process.env.CCS_BROWSER_DEVTOOLS_PORT;
    originalBrowserDevtoolsHost = process.env.CCS_BROWSER_DEVTOOLS_HOST;
    originalBrowserDevtoolsHttpUrl = process.env.CCS_BROWSER_DEVTOOLS_HTTP_URL;
    originalBrowserDevtoolsWsUrl = process.env.CCS_BROWSER_DEVTOOLS_WS_URL;
    originalBrowserEvalMode = process.env.CCS_BROWSER_EVAL_MODE;
    process.env.CCS_HOME = tempHome;
    process.env.CCS_DASHBOARD_AUTH_ENABLED = 'false';
    delete process.env.CCS_BROWSER_USER_DATA_DIR;
    delete process.env.CCS_BROWSER_PROFILE_DIR;
    delete process.env.CCS_BROWSER_DEVTOOLS_PORT;
    delete process.env.CCS_BROWSER_DEVTOOLS_HOST;
    delete process.env.CCS_BROWSER_DEVTOOLS_HTTP_URL;
    delete process.env.CCS_BROWSER_DEVTOOLS_WS_URL;
    delete process.env.CCS_BROWSER_EVAL_MODE;
    forcedRemoteAddress = '127.0.0.1';
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }

    if (originalDashboardAuthEnabled !== undefined) {
      process.env.CCS_DASHBOARD_AUTH_ENABLED = originalDashboardAuthEnabled;
    } else {
      delete process.env.CCS_DASHBOARD_AUTH_ENABLED;
    }

    if (originalBrowserUserDataDir !== undefined) {
      process.env.CCS_BROWSER_USER_DATA_DIR = originalBrowserUserDataDir;
    } else {
      delete process.env.CCS_BROWSER_USER_DATA_DIR;
    }

    if (originalBrowserProfileDir !== undefined) {
      process.env.CCS_BROWSER_PROFILE_DIR = originalBrowserProfileDir;
    } else {
      delete process.env.CCS_BROWSER_PROFILE_DIR;
    }

    if (originalBrowserDevtoolsPort !== undefined) {
      process.env.CCS_BROWSER_DEVTOOLS_PORT = originalBrowserDevtoolsPort;
    } else {
      delete process.env.CCS_BROWSER_DEVTOOLS_PORT;
    }

    if (originalBrowserDevtoolsHost !== undefined) {
      process.env.CCS_BROWSER_DEVTOOLS_HOST = originalBrowserDevtoolsHost;
    } else {
      delete process.env.CCS_BROWSER_DEVTOOLS_HOST;
    }

    if (originalBrowserDevtoolsHttpUrl !== undefined) {
      process.env.CCS_BROWSER_DEVTOOLS_HTTP_URL = originalBrowserDevtoolsHttpUrl;
    } else {
      delete process.env.CCS_BROWSER_DEVTOOLS_HTTP_URL;
    }

    if (originalBrowserDevtoolsWsUrl !== undefined) {
      process.env.CCS_BROWSER_DEVTOOLS_WS_URL = originalBrowserDevtoolsWsUrl;
    } else {
      delete process.env.CCS_BROWSER_DEVTOOLS_WS_URL;
    }

    if (originalBrowserEvalMode !== undefined) {
      process.env.CCS_BROWSER_EVAL_MODE = originalBrowserEvalMode;
    } else {
      delete process.env.CCS_BROWSER_EVAL_MODE;
    }

    rmSync(tempHome, { recursive: true, force: true });
  });

  it('blocks remote access when dashboard auth is disabled', async () => {
    forcedRemoteAddress = '10.10.0.24';

    const response = await fetch(`${baseUrl}/api/browser`);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Browser endpoints require localhost access when dashboard auth is disabled.',
    });
  });

  it('returns the default browser config and status payload', async () => {
    const response = await fetch(`${baseUrl}/api/browser`);
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.config).toMatchObject({
      claude: {
        enabled: false,
        userDataDir: join(tempHome, '.ccs', 'browser', 'chrome-user-data'),
        devtoolsPort: 9222,
        evalMode: 'readonly',
      },
      codex: {
        enabled: true,
        evalMode: 'readonly',
      },
    });
    expect(payload.status.claude).toMatchObject({
      state: 'disabled',
      managedMcpServerName: 'ccs-browser',
    });
    expect(payload.status.codex).toMatchObject({
      enabled: true,
      serverName: 'ccs_browser',
    });
  });

  it('updates the saved browser config through the dashboard route', async () => {
    const response = await fetch(`${baseUrl}/api/browser`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude: {
          enabled: true,
          userDataDir: '/tmp/ccs-browser',
          devtoolsPort: 9333,
          evalMode: 'readwrite',
        },
        codex: {
          enabled: false,
          evalMode: 'disabled',
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.browser.config).toMatchObject({
      claude: {
        enabled: true,
        userDataDir: '/tmp/ccs-browser',
        devtoolsPort: 9333,
        evalMode: 'readwrite',
      },
      codex: {
        enabled: false,
        evalMode: 'disabled',
      },
    });

    const config = loadOrCreateUnifiedConfig();
    expect(config.browser).toMatchObject({
      claude: {
        enabled: true,
        user_data_dir: '/tmp/ccs-browser',
        devtools_port: 9333,
        eval_mode: 'readwrite',
      },
      codex: {
        enabled: false,
        eval_mode: 'disabled',
      },
    });
  });

  it('treats a blank user-data directory as a reset to the recommended path', async () => {
    const firstResponse = await fetch(`${baseUrl}/api/browser`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude: {
          enabled: true,
          userDataDir: '/tmp/ccs-browser-custom',
          devtoolsPort: 9333,
        },
      }),
    });

    expect(firstResponse.status).toBe(200);

    const resetResponse = await fetch(`${baseUrl}/api/browser`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude: {
          userDataDir: '   ',
        },
      }),
    });

    expect(resetResponse.status).toBe(200);
    const payload = await resetResponse.json();
    expect(payload.browser.config.claude).toMatchObject({
      enabled: true,
      userDataDir: join(tempHome, '.ccs', 'browser', 'chrome-user-data'),
      devtoolsPort: 9333,
      evalMode: 'readonly',
    });

    const config = loadOrCreateUnifiedConfig();
    expect(config.browser).toMatchObject({
      claude: {
        enabled: true,
        user_data_dir: join(tempHome, '.ccs', 'browser', 'chrome-user-data'),
        devtools_port: 9333,
        eval_mode: 'readonly',
      },
    });
  });

  it('rejects invalid DevTools ports at the route boundary', async () => {
    const response = await fetch(`${baseUrl}/api/browser`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude: {
          devtoolsPort: 0,
        },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid value for claude.devtoolsPort. Must be an integer between 1 and 65535.',
    });
  });

  it('rejects invalid eval modes at the route boundary', async () => {
    const claudeResponse = await fetch(`${baseUrl}/api/browser`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude: {
          evalMode: 'dangerous',
        },
      }),
    });

    expect(claudeResponse.status).toBe(400);
    expect(await claudeResponse.json()).toEqual({
      error: 'Invalid value for claude.evalMode. Must be one of: disabled, readonly, readwrite.',
    });

    const codexResponse = await fetch(`${baseUrl}/api/browser`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codex: {
          evalMode: 'dangerous',
        },
      }),
    });

    expect(codexResponse.status).toBe(400);
    expect(await codexResponse.json()).toEqual({
      error: 'Invalid value for codex.evalMode. Must be one of: disabled, readonly, readwrite.',
    });
  });
});
