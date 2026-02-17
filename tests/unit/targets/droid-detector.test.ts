/**
 * Unit tests for Droid detector edge cases
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectDroidCli, checkDroidVersion } from '../../../src/targets/droid-detector';

describe('droid-detector', () => {
  let tmpDir: string;
  let originalPath: string | undefined;
  let originalDroidPath: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-droid-detector-test-'));
    originalPath = process.env.PATH;
    originalDroidPath = process.env.CCS_DROID_PATH;
    process.env.PATH = '';
  });

  afterEach(() => {
    if (originalPath !== undefined) process.env.PATH = originalPath;
    else delete process.env.PATH;

    if (originalDroidPath !== undefined) process.env.CCS_DROID_PATH = originalDroidPath;
    else delete process.env.CCS_DROID_PATH;

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should prefer CCS_DROID_PATH when it points to a file', () => {
    const fakeDroid = path.join(tmpDir, 'droid');
    fs.writeFileSync(fakeDroid, '#!/bin/sh\necho droid\n');
    process.env.CCS_DROID_PATH = fakeDroid;

    expect(detectDroidCli()).toBe(fakeDroid);
  });

  it('should fall back (null) when CCS_DROID_PATH points to directory', () => {
    process.env.CCS_DROID_PATH = tmpDir;
    expect(detectDroidCli()).toBeNull();
  });

  it('should fall back (null) when CCS_DROID_PATH does not exist', () => {
    process.env.CCS_DROID_PATH = path.join(tmpDir, 'missing-droid');
    expect(detectDroidCli()).toBeNull();
  });

  it('checkDroidVersion should be non-throwing for invalid binaries', () => {
    expect(() => checkDroidVersion(path.join(tmpDir, 'missing-droid'))).not.toThrow();
  });
});
