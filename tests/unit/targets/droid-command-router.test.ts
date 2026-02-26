import { describe, expect, it } from 'bun:test';
import { routeDroidCommandArgs } from '../../../src/targets/droid-command-router';

describe('droid-command-router', () => {
  it('keeps interactive mode for plain profile launches', () => {
    const route = routeDroidCommandArgs([]);

    expect(route.mode).toBe('interactive');
    expect(route.argsForDroid).toEqual([]);
    expect(route.autoPrependedExec).toBe(false);
  });

  it('keeps explicit droid subcommands untouched', () => {
    const route = routeDroidCommandArgs(['mcp', '--help']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('mcp');
    expect(route.argsForDroid).toEqual(['mcp', '--help']);
    expect(route.autoPrependedExec).toBe(false);
  });

  it('auto-prepends exec for exec-only flags provided after profile', () => {
    const route = routeDroidCommandArgs(['--skip-permissions-unsafe']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual(['exec', '--skip-permissions-unsafe']);
    expect(route.autoPrependedExec).toBe(true);
  });

  it('does not auto-prepend exec for root help flag', () => {
    const route = routeDroidCommandArgs(['--help']);

    expect(route.mode).toBe('interactive');
    expect(route.argsForDroid).toEqual(['--help']);
    expect(route.autoPrependedExec).toBe(false);
  });

  it('normalizes --effort alias to --reasoning-effort for explicit exec', () => {
    const route = routeDroidCommandArgs(['exec', '--effort', 'xhigh', 'fix test flake']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual([
      'exec',
      '--reasoning-effort',
      'xhigh',
      'fix test flake',
    ]);
  });

  it('normalizes --thinking alias when exec is auto-prepended', () => {
    const route = routeDroidCommandArgs(['--auto', 'high', '--thinking=medium', 'summarize logs']);

    expect(route.mode).toBe('command');
    expect(route.command).toBe('exec');
    expect(route.argsForDroid).toEqual([
      'exec',
      '--auto',
      'high',
      '--reasoning-effort=medium',
      'summarize logs',
    ]);
    expect(route.autoPrependedExec).toBe(true);
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
  });
});
