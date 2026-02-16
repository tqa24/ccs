/**
 * Unit tests for target resolver
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { resolveTargetType, stripTargetFlag } from '../../../src/targets/target-resolver';

describe('resolveTargetType', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should return claude as default', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType([])).toBe('claude');
  });

  it('should detect --target flag', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType(['--target', 'droid'])).toBe('droid');
  });

  it('should detect --target claude', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType(['--target', 'claude'])).toBe('claude');
  });

  it('should use per-profile config when no flag', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType([], { target: 'droid' })).toBe('droid');
  });

  it('should prioritize --target flag over profile config', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType(['--target', 'claude'], { target: 'droid' })).toBe('claude');
  });

  it('should detect ccsd argv[0] (busybox pattern)', () => {
    process.argv = ['node', 'ccsd'];
    expect(resolveTargetType([])).toBe('droid');
  });

  it('should strip .cmd extension on Windows argv[0]', () => {
    process.argv = ['node', 'ccsd.cmd'];
    expect(resolveTargetType([])).toBe('droid');
  });

  it('should strip .bat extension on Windows argv[0]', () => {
    process.argv = ['node', 'ccsd.bat'];
    expect(resolveTargetType([])).toBe('droid');
  });

  it('should not match ccsd with .exe extension', () => {
    // .exe is not stripped — ccsd.exe won't match 'ccsd' in the map
    // This is intentional — npm creates .cmd shims, not .exe
    process.argv = ['node', 'ccsd.exe'];
    expect(resolveTargetType([])).toBe('claude');
  });

  it('should prioritize --target over argv[0]', () => {
    process.argv = ['node', 'ccsd'];
    expect(resolveTargetType(['--target', 'claude'])).toBe('claude');
  });

  it('should prioritize profile config over argv[0]', () => {
    process.argv = ['node', 'ccsd'];
    expect(resolveTargetType([], { target: 'claude' })).toBe('claude');
  });

  it('should throw for invalid --target value', () => {
    process.argv = ['node', 'ccs'];
    expect(() => resolveTargetType(['--target', 'invalid'])).toThrow(/Unknown target "invalid"/);
  });
});

describe('stripTargetFlag', () => {
  it('should remove --target and its value', () => {
    expect(stripTargetFlag(['gemini', '--target', 'droid'])).toEqual(['gemini']);
  });

  it('should handle --target at start', () => {
    expect(stripTargetFlag(['--target', 'droid', 'gemini'])).toEqual(['gemini']);
  });

  it('should return args unchanged if no --target', () => {
    const args = ['gemini', '-p', 'hello'];
    expect(stripTargetFlag(args)).toEqual(['gemini', '-p', 'hello']);
  });

  it('should not modify the original array', () => {
    const args = ['--target', 'droid', 'gemini'];
    stripTargetFlag(args);
    expect(args).toEqual(['--target', 'droid', 'gemini']);
  });
});
