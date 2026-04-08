import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getCurrentLogPath,
  getLogArchiveDir,
  getNativeLogsDir,
  isPathInsideDirectory,
} from '../../../../src/services/logging';

describe('logging path helpers', () => {
  let tempHome = '';
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    originalCcsHome = process.env.CCS_HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-log-paths-'));
    process.env.CCS_HOME = tempHome;
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }

    fs.rmSync(tempHome, { recursive: true, force: true });
    tempHome = '';
  });

  it('resolves native log paths inside the scoped CCS directory', () => {
    expect(getNativeLogsDir()).toBe(path.join(tempHome, '.ccs', 'logs'));
    expect(getCurrentLogPath()).toBe(path.join(tempHome, '.ccs', 'logs', 'current.jsonl'));
    expect(getLogArchiveDir()).toBe(path.join(tempHome, '.ccs', 'logs', 'archive'));
  });

  it('rejects path escapes outside the CCS log root', () => {
    const logsDir = getNativeLogsDir();
    expect(isPathInsideDirectory(path.join(logsDir, 'archive', 'entry.gz'), logsDir)).toBe(true);
    expect(isPathInsideDirectory(path.join(logsDir, '..', '..', 'etc', 'passwd'), logsDir)).toBe(
      false
    );
  });
});
