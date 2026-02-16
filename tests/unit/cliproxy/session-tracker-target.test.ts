import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  registerSession,
  unregisterSession,
  getProxyStatus,
} from '../../../src/cliproxy/session-tracker';

describe('session-tracker target metadata', () => {
  let tmpDir: string;
  let originalCcsHome: string | undefined;
  const port = 28317;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-session-target-test-'));
    originalCcsHome = process.env.CCS_HOME;
    process.env.CCS_HOME = tmpDir;
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns single target when all sessions share same target', () => {
    const s1 = registerSession(port, process.pid, undefined, undefined, 'droid');
    const s2 = registerSession(port, process.pid, undefined, undefined, 'droid');

    const status = getProxyStatus(port);
    expect(status.running).toBe(true);
    expect(status.target).toBe('droid');
    expect(status.sessionCount).toBe(2);

    unregisterSession(s1, port);
    unregisterSession(s2, port);
  });

  it('returns mixed when active sessions use different targets', () => {
    const s1 = registerSession(port, process.pid, undefined, undefined, 'claude');
    const s2 = registerSession(port, process.pid, undefined, undefined, 'droid');

    const status = getProxyStatus(port);
    expect(status.running).toBe(true);
    expect(status.target).toBe('mixed');
    expect(status.sessionCount).toBe(2);

    unregisterSession(s1, port);
    unregisterSession(s2, port);
  });
});
