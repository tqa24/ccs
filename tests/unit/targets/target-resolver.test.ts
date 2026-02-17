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

  it('should strip .ps1 extension on Windows argv[0]', () => {
    process.argv = ['node', 'ccsd.ps1'];
    expect(resolveTargetType([])).toBe('droid');
  });

  it('should strip .exe extension on Windows argv[0]', () => {
    process.argv = ['node', 'ccsd.exe'];
    expect(resolveTargetType([])).toBe('droid');
  });

  it('should handle full path argv[0]', () => {
    process.argv = ['node', '/usr/local/bin/ccsd'];
    expect(resolveTargetType([])).toBe('droid');
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

  it('should support --target=<value> form', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType(['--target=droid'])).toBe('droid');
  });

  it('should throw when --target is missing value', () => {
    process.argv = ['node', 'ccs'];
    expect(() => resolveTargetType(['--target'])).toThrow(/--target requires a value/);
  });

  it('should throw when --target value is another flag', () => {
    process.argv = ['node', 'ccs'];
    expect(() => resolveTargetType(['--target', '--help'])).toThrow(/--target requires a value/);
  });

  it('should use last --target flag when repeated', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType(['--target', 'droid', '--target=claude'])).toBe('claude');
  });

  it('should ignore --target after option terminator', () => {
    process.argv = ['node', 'ccs'];
    expect(resolveTargetType(['--', '--target', 'droid'])).toBe('claude');
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

  it('should remove --target=<value> form', () => {
    expect(stripTargetFlag(['gemini', '--target=droid', '--verbose'])).toEqual([
      'gemini',
      '--verbose',
    ]);
  });

  it('should remove repeated --target flags', () => {
    expect(
      stripTargetFlag(['--target', 'droid', 'gemini', '--target=claude', '--verbose'])
    ).toEqual(['gemini', '--verbose']);
  });

  it('should throw when --target has no value', () => {
    expect(() => stripTargetFlag(['gemini', '--target'])).toThrow(/--target requires a value/);
  });

  it('should throw when --target value is another flag', () => {
    expect(() => stripTargetFlag(['gemini', '--target', '--help'])).toThrow(
      /--target requires a value/
    );
  });

  it('should not modify the original array', () => {
    const args = ['--target', 'droid', 'gemini'];
    stripTargetFlag(args);
    expect(args).toEqual(['--target', 'droid', 'gemini']);
  });

  it('should preserve args after option terminator', () => {
    expect(stripTargetFlag(['glm', '--', '--target', 'droid', '-p'])).toEqual([
      'glm',
      '--',
      '--target',
      'droid',
      '-p',
    ]);
  });
});
