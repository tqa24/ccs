import { describe, expect, it } from 'bun:test';

import { extractOption, hasAnyFlag } from '../../../src/commands/arg-extractor';

describe('arg-extractor', () => {
  describe('extractOption', () => {
    it('extracts --flag value and removes both tokens from remaining args', () => {
      const result = extractOption(['--profile', 'gemini', '--yes'], ['--profile']);

      expect(result).toEqual({
        found: true,
        value: 'gemini',
        missingValue: false,
        remainingArgs: ['--yes'],
      });
    });

    it('extracts --flag=value and removes inline token from remaining args', () => {
      const result = extractOption(['--yes', '--profile=codex', 'prompt'], ['--profile']);

      expect(result).toEqual({
        found: true,
        value: 'codex',
        missingValue: false,
        remainingArgs: ['--yes', 'prompt'],
      });
    });

    it('marks missing value when flag is last token', () => {
      const result = extractOption(['prompt', '--profile'], ['--profile']);

      expect(result).toEqual({
        found: true,
        missingValue: true,
        remainingArgs: ['prompt'],
      });
    });

    it('marks missing value for empty inline value', () => {
      const result = extractOption(['--profile=', '--yes'], ['--profile']);

      expect(result).toEqual({
        found: true,
        missingValue: true,
        remainingArgs: ['--yes'],
      });
    });

    it('marks missing value when next token is another flag and keeps that flag', () => {
      const result = extractOption(['--profile', '--yes', 'prompt'], ['--profile']);

      expect(result).toEqual({
        found: true,
        missingValue: true,
        remainingArgs: ['--yes', 'prompt'],
      });
    });

    it('returns non-match state without altering args content', () => {
      const args = ['--yes', 'prompt'];
      const result = extractOption(args, ['--profile', '-p']);

      expect(result).toEqual({
        found: false,
        missingValue: false,
        remainingArgs: ['--yes', 'prompt'],
      });
      expect(args).toEqual(['--yes', 'prompt']);
    });
  });

  describe('hasAnyFlag', () => {
    it('returns true when any exact flag is present', () => {
      expect(hasAnyFlag(['prompt', '--yes'], ['--yes', '-y'])).toBe(true);
      expect(hasAnyFlag(['prompt', '-y'], ['--yes', '-y'])).toBe(true);
    });

    it('returns false when only non-matching or inline tokens exist', () => {
      expect(hasAnyFlag(['prompt', '--yes=true'], ['--yes', '-y'])).toBe(false);
      expect(hasAnyFlag(['prompt', '--profile=gemini'], ['--yes', '-y'])).toBe(false);
    });
  });
});
