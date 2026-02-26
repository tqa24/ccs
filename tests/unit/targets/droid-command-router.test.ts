import { describe, expect, it } from 'bun:test';
import {
  DroidCommandRouterError,
  routeDroidCommandArgs,
} from '../../../src/targets/droid-command-router';

describe('droid-command-router', () => {
  it('keeps interactive mode for plain profile launches', () => {
    const route = routeDroidCommandArgs([]);

    expect(route.mode).toBe('interactive');
    expect(route.argsForDroid).toEqual([]);
    expect(route.autoPrependedExec).toBe(false);
    expect(route.duplicateReasoningDisplays).toEqual([]);
  });

  it('keeps explicit droid subcommands untouched', () => {
    const route = routeDroidCommandArgs(['mcp', '--help']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('mcp');
    expect(route.argsForDroid).toEqual(['mcp', '--help']);
    expect(route.autoPrependedExec).toBe(false);
    expect(route.duplicateReasoningDisplays).toEqual([]);
  });

  it('auto-prepends exec for exec-only flags provided after profile', () => {
    const route = routeDroidCommandArgs(['--skip-permissions-unsafe']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual(['exec', '--skip-permissions-unsafe']);
    expect(route.autoPrependedExec).toBe(true);
    expect(route.duplicateReasoningDisplays).toEqual([]);
  });

  it('does not auto-prepend exec for root help flag', () => {
    const route = routeDroidCommandArgs(['--help']);

    expect(route.mode).toBe('interactive');
    expect(route.argsForDroid).toEqual(['--help']);
    expect(route.autoPrependedExec).toBe(false);
    expect(route.duplicateReasoningDisplays).toEqual([]);
  });

  it('normalizes --effort alias to --reasoning-effort for explicit exec', () => {
    const route = routeDroidCommandArgs(['exec', '--effort', 'xhigh', 'fix test flake']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual(['exec', '--reasoning-effort', 'xhigh', 'fix test flake']);
    expect(route.reasoningSourceDisplay).toBe('--effort xhigh');
  });

  it('normalizes --thinking alias when exec is auto-prepended', () => {
    const route = routeDroidCommandArgs(['--auto', 'high', '--thinking=medium', 'summarize logs']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual([
      'exec',
      '--auto',
      'high',
      '--reasoning-effort',
      'medium',
      'summarize logs',
    ]);
    expect(route.autoPrependedExec).toBe(true);
    expect(route.reasoningSourceDisplay).toBe('--thinking=medium');
  });

  it('still auto-prepends exec when --effort appears before exec-only flags', () => {
    const route = routeDroidCommandArgs([
      '--effort',
      'xhigh',
      '--skip-permissions-unsafe',
      'fix flaky test',
    ]);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual([
      'exec',
      '--reasoning-effort',
      'xhigh',
      '--skip-permissions-unsafe',
      'fix flaky test',
    ]);
    expect(route.autoPrependedExec).toBe(true);
    expect(route.reasoningSourceDisplay).toBe('--effort xhigh');
  });

  it('auto-prepends exec for non-ambiguous short exec flags', () => {
    const route = routeDroidCommandArgs(['-m', 'custom:gpt-5.3-codex', 'fix flaky test']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual(['exec', '-m', 'custom:gpt-5.3-codex', 'fix flaky test']);
    expect(route.autoPrependedExec).toBe(true);
  });

  it('routes -r to exec when value matches reasoning effort level', () => {
    const route = routeDroidCommandArgs(['-r', 'high', 'summarize logs']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual(['exec', '--reasoning-effort', 'high', 'summarize logs']);
    expect(route.autoPrependedExec).toBe(true);
  });

  it('keeps interactive mode for ambiguous -r resume-style usage', () => {
    const route = routeDroidCommandArgs(['-r', 'session-1234']);

    expect(route.mode).toBe('interactive');
    expect(route.argsForDroid).toEqual(['-r', 'session-1234']);
    expect(route.autoPrependedExec).toBe(false);
  });

  it('dedupes mixed reasoning flags with first occurrence precedence', () => {
    const route = routeDroidCommandArgs([
      'exec',
      '--reasoning-effort',
      'high',
      '--thinking',
      'low',
      '--effort=xhigh',
      'summarize logs',
    ]);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual(['exec', '--reasoning-effort', 'high', 'summarize logs']);
    expect(route.reasoningSourceDisplay).toBe('--reasoning-effort high');
    expect(route.duplicateReasoningDisplays).toEqual(['--thinking low', '--effort=xhigh']);
  });

  it('throws for missing reasoning value in command mode (alias)', () => {
    expect(() => routeDroidCommandArgs(['exec', '--effort'])).toThrow(DroidCommandRouterError);
  });

  it('throws for missing reasoning value in command mode (native)', () => {
    expect(() => routeDroidCommandArgs(['exec', '--reasoning-effort'])).toThrow(
      DroidCommandRouterError
    );
  });

  it('records malformed duplicate reasoning flags when first value is already selected', () => {
    const route = routeDroidCommandArgs([
      'exec',
      '--thinking',
      'medium',
      '--reasoning-effort',
      '--skip-permissions-unsafe',
      'summarize logs',
    ]);

    expect(route.argsForDroid).toEqual([
      'exec',
      '--reasoning-effort',
      'medium',
      '--skip-permissions-unsafe',
      'summarize logs',
    ]);
    expect(route.duplicateReasoningDisplays).toEqual(['--reasoning-effort <missing-value>']);
  });
});
