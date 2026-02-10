/**
 * Unit tests for env-command.ts
 *
 * Tests pure utility functions: detectShell, formatExportLine, transformToOpenAI
 */
import { describe, it, expect, afterEach } from 'bun:test';
import { detectShell, formatExportLine, transformToOpenAI } from '../../../src/commands/env-command';

describe('env-command', () => {
  describe('detectShell', () => {
    const originalShell = process.env['SHELL'];

    afterEach(() => {
      if (originalShell !== undefined) {
        process.env['SHELL'] = originalShell;
      } else {
        delete process.env['SHELL'];
      }
    });

    it('returns explicit bash flag', () => {
      expect(detectShell('bash')).toBe('bash');
    });

    it('returns explicit fish flag', () => {
      expect(detectShell('fish')).toBe('fish');
    });

    it('returns explicit powershell flag', () => {
      expect(detectShell('powershell')).toBe('powershell');
    });

    it('auto-detects bash from SHELL=/bin/zsh', () => {
      process.env['SHELL'] = '/bin/zsh';
      expect(detectShell('auto')).toBe('bash');
    });

    it('auto-detects bash from SHELL=/bin/bash', () => {
      process.env['SHELL'] = '/bin/bash';
      expect(detectShell()).toBe('bash');
    });

    it('auto-detects fish from SHELL=/usr/bin/fish', () => {
      process.env['SHELL'] = '/usr/bin/fish';
      expect(detectShell('auto')).toBe('fish');
    });

    it('defaults to bash when SHELL is empty', () => {
      process.env['SHELL'] = '';
      expect(detectShell()).toBe('bash');
    });

    it('ignores invalid flag and auto-detects', () => {
      process.env['SHELL'] = '/bin/bash';
      expect(detectShell('invalid')).toBe('bash');
    });
  });

  describe('formatExportLine', () => {
    it('formats bash export', () => {
      expect(formatExportLine('bash', 'API_KEY', 'sk-123')).toBe("export API_KEY='sk-123'");
    });

    it('formats fish export', () => {
      expect(formatExportLine('fish', 'API_KEY', 'sk-123')).toBe("set -gx API_KEY 'sk-123'");
    });

    it('formats powershell export', () => {
      expect(formatExportLine('powershell', 'API_KEY', 'sk-123')).toBe(
        "$env:API_KEY = 'sk-123'"
      );
    });

    it('escapes single quotes in values', () => {
      expect(formatExportLine('bash', 'VAL', "it's here")).toBe(
        "export VAL='it'\\''s here'"
      );
    });

    it('handles empty values', () => {
      expect(formatExportLine('bash', 'EMPTY', '')).toBe("export EMPTY=''");
    });

    it('handles URLs with special characters', () => {
      const url = 'http://127.0.0.1:8317/api/provider/gemini';
      expect(formatExportLine('bash', 'BASE_URL', url)).toBe(`export BASE_URL='${url}'`);
    });

    it('prevents shell injection with $() in values', () => {
      expect(formatExportLine('bash', 'TOKEN', 'safe$(whoami)')).toBe(
        "export TOKEN='safe$(whoami)'"
      );
    });
  });

  describe('transformToOpenAI', () => {
    it('maps Anthropic vars to OpenAI format', () => {
      const result = transformToOpenAI({
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317/api/provider/gemini',
        ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
        ANTHROPIC_MODEL: 'gemini-claude-sonnet-4-5',
      });

      expect(result).toEqual({
        OPENAI_API_KEY: 'ccs-internal-managed',
        OPENAI_BASE_URL: 'http://127.0.0.1:8317/api/provider/gemini',
        LOCAL_ENDPOINT: 'http://127.0.0.1:8317/api/provider/gemini',
      });
    });

    it('handles missing source vars gracefully', () => {
      const result = transformToOpenAI({});

      expect(result).toEqual({
        OPENAI_API_KEY: '',
        OPENAI_BASE_URL: '',
        LOCAL_ENDPOINT: '',
      });
    });

    it('only extracts relevant vars', () => {
      const result = transformToOpenAI({
        ANTHROPIC_BASE_URL: 'http://localhost:8317',
        ANTHROPIC_AUTH_TOKEN: 'key',
        ANTHROPIC_MAX_TOKENS: '8096',
        DISABLE_TELEMETRY: '1',
      });

      // Should only have 3 keys
      expect(Object.keys(result)).toHaveLength(3);
      expect(result['ANTHROPIC_MAX_TOKENS']).toBeUndefined();
    });
  });
});
