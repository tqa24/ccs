import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveLifecyclePort } from '../../../src/commands/cliproxy/proxy-lifecycle-subcommand';
import { CLIPROXY_DEFAULT_PORT } from '../../../src/cliproxy/config/port-manager';

let tempDir: string;
let originalCcsDir: string | undefined;

function writeUnifiedConfig(localPort: number): void {
  const configPath = path.join(tempDir, 'config.yaml');
  const yaml = `version: 2
accounts: {}
profiles: {}
preferences:
  theme: system
  telemetry: false
  auto_update: true
cliproxy:
  oauth_accounts: {}
  providers:
    - gemini
    - codex
    - agy
  variants: {}
cliproxy_server:
  local:
    port: ${localPort}
`;
  fs.writeFileSync(configPath, yaml, 'utf8');
}

describe('resolveLifecyclePort', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-proxy-lifecycle-'));
    originalCcsDir = process.env.CCS_DIR;
    process.env.CCS_DIR = tempDir;
  });

  afterEach(() => {
    if (originalCcsDir !== undefined) {
      process.env.CCS_DIR = originalCcsDir;
    } else {
      delete process.env.CCS_DIR;
    }

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses configured cliproxy_server.local.port', () => {
    writeUnifiedConfig(9456);
    expect(resolveLifecyclePort()).toBe(9456);
  });

  it('falls back to default port when configured local port is invalid', () => {
    writeUnifiedConfig(70000);
    expect(resolveLifecyclePort()).toBe(CLIPROXY_DEFAULT_PORT);
  });

  it('falls back to default port when config file is missing', () => {
    expect(resolveLifecyclePort()).toBe(CLIPROXY_DEFAULT_PORT);
  });
});
