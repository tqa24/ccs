import { describe, expect, it } from 'vitest';
import { getCodexEffortDisplay, parseCodexEffort } from '@/lib/codex-effort';

describe('parseCodexEffort', () => {
  it('parses lowercase suffixes', () => {
    expect(parseCodexEffort('gpt-5.3-codex-high')).toBe('high');
    expect(parseCodexEffort('gpt-5.3-codex-xhigh')).toBe('xhigh');
    expect(parseCodexEffort('gpt-5-mini-medium')).toBe('medium');
  });

  it('parses mixed-case suffixes', () => {
    expect(parseCodexEffort('gpt-5.3-codex-XHIGH')).toBe('xhigh');
  });

  it('returns undefined for unsuffixed or unsupported values', () => {
    expect(parseCodexEffort('gpt-5.3-codex')).toBeUndefined();
    expect(parseCodexEffort('gpt-5.3-codex-low')).toBeUndefined();
    expect(parseCodexEffort(undefined)).toBeUndefined();
  });
});

describe('getCodexEffortDisplay', () => {
  it('returns pinned label for suffixed models', () => {
    expect(getCodexEffortDisplay('gpt-5.3-codex-high')).toEqual({
      label: 'Pinned high',
      explicit: true,
    });
  });

  it('returns auto label for unsuffixed models', () => {
    expect(getCodexEffortDisplay('gpt-5.3-codex')).toEqual({
      label: 'Auto effort',
      explicit: false,
    });
  });

  it('returns null for empty input', () => {
    expect(getCodexEffortDisplay(undefined)).toBeNull();
  });
});
