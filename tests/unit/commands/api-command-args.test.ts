import { describe, expect, test } from 'bun:test';

import { parseApiCommandArgs } from '../../../src/commands/api-command';

describe('api-command arg parser', () => {
  test('keeps positional API name when boolean flags precede it', () => {
    const parsed = parseApiCommandArgs(['--yes', 'my-api']);

    expect(parsed.yes).toBe(true);
    expect(parsed.name).toBe('my-api');
  });

  test('uses last value when repeated value flags are provided', () => {
    const parsed = parseApiCommandArgs([
      'profile-a',
      '--model',
      'claude-3-5-sonnet',
      '--model=claude-3-7-sonnet',
    ]);

    expect(parsed.name).toBe('profile-a');
    expect(parsed.model).toBe('claude-3-7-sonnet');
    expect(parsed.errors).toEqual([]);
  });

  test('collects missing-value errors for required option values', () => {
    const parsed = parseApiCommandArgs(['profile-a', '--base-url', '--api-key']);

    expect(parsed.errors).toEqual(['Missing value for --base-url', 'Missing value for --api-key']);
  });

  test('supports option terminator for positional args that look like flags', () => {
    const parsed = parseApiCommandArgs(['--yes', '--', '-my-api']);

    expect(parsed.yes).toBe(true);
    expect(parsed.name).toBe('-my-api');
  });

  test('parses --target for default profile target', () => {
    const parsed = parseApiCommandArgs(['my-api', '--target', 'droid']);

    expect(parsed.name).toBe('my-api');
    expect(parsed.target).toBe('droid');
    expect(parsed.errors).toEqual([]);
  });

  test('validates invalid --target values', () => {
    const parsed = parseApiCommandArgs(['my-api', '--target', 'invalid-target']);

    expect(parsed.target).toBeUndefined();
    expect(parsed.errors).toEqual(['Invalid --target value "invalid-target". Use: claude or droid']);
  });
});
