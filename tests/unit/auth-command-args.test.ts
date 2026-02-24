import { describe, expect, it } from 'bun:test';
import { parseArgs } from '../../src/auth/commands/types';

describe('auth command args parsing', () => {
  it('parses create with explicit shared context', () => {
    const parsed = parseArgs(['work', '--share-context']);

    expect(parsed.profileName).toBe('work');
    expect(parsed.shareContext).toBe(true);
    expect(parsed.contextGroup).toBeUndefined();
  });

  it('parses context group with separate value', () => {
    const parsed = parseArgs(['work', '--context-group', 'sprint-a']);

    expect(parsed.profileName).toBe('work');
    expect(parsed.shareContext).toBe(false);
    expect(parsed.contextGroup).toBe('sprint-a');
  });

  it('parses context group with equals form', () => {
    const parsed = parseArgs(['--context-group=sprint-a', 'work']);

    expect(parsed.profileName).toBe('work');
    expect(parsed.contextGroup).toBe('sprint-a');
  });

  it('flags missing context group value as empty string', () => {
    const parsed = parseArgs(['work', '--context-group']);

    expect(parsed.profileName).toBe('work');
    expect(parsed.contextGroup).toBe('');
  });
});
