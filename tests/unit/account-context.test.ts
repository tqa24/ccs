import { describe, expect, it } from 'bun:test';
import {
  MAX_CONTEXT_GROUP_LENGTH,
  isValidAccountProfileName,
  resolveAccountContextPolicy,
  resolveCreateAccountContext,
} from '../../src/auth/account-context';

describe('account context helpers', () => {
  it('rejects context groups that exceed the max length', () => {
    const group = `a${'x'.repeat(MAX_CONTEXT_GROUP_LENGTH)}`;
    const result = resolveCreateAccountContext({ shareContext: false, contextGroup: group });

    expect(result.error).toContain('Invalid context group');
  });

  it('rejects profile names with unsupported characters', () => {
    expect(isValidAccountProfileName('work')).toBe(true);
    expect(isValidAccountProfileName('gemini:default')).toBe(false);
  });

  it('falls back to default shared group for invalid persisted metadata', () => {
    const resolved = resolveAccountContextPolicy({
      context_mode: 'shared',
      context_group: '###',
    });

    expect(resolved.mode).toBe('shared');
    expect(resolved.group).toBe('default');
  });
});
