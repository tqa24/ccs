import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ProfileRegistry from '../../src/auth/profile-registry';
import InstanceManager from '../../src/management/instance-manager';
import { handleList } from '../../src/auth/commands/list-command';

describe('auth list context metadata', () => {
  let tempRoot = '';
  let originalCcsHome: string | undefined;
  let originalCcsUnified: string | undefined;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-auth-list-context-'));
    originalCcsHome = process.env.CCS_HOME;
    originalCcsUnified = process.env.CCS_UNIFIED_CONFIG;

    process.env.CCS_HOME = tempRoot;
    process.env.CCS_UNIFIED_CONFIG = '1';
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) process.env.CCS_HOME = originalCcsHome;
    else delete process.env.CCS_HOME;

    if (originalCcsUnified !== undefined) process.env.CCS_UNIFIED_CONFIG = originalCcsUnified;
    else delete process.env.CCS_UNIFIED_CONFIG;

    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps unified account context metadata in JSON list output', async () => {
    const ccsDir = path.join(tempRoot, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(
      path.join(ccsDir, 'config.yaml'),
      [
        'version: 8',
        'accounts:',
        '  work:',
        '    created: "2026-02-01T00:00:00.000Z"',
        '    last_used: null',
        '    context_mode: shared',
        '    context_group: sprint-a',
        'profiles: {}',
        'cliproxy:',
        '  oauth_accounts: {}',
        '  providers: {}',
        '  variants: {}',
      ].join('\n'),
      'utf8'
    );

    const registry = new ProfileRegistry();

    const instanceMgr = new InstanceManager();
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };

    try {
      await handleList(
        {
          registry,
          instanceMgr,
          version: 'test',
        },
        ['--json']
      );
    } finally {
      console.log = originalLog;
    }

    const payload = JSON.parse(lines.join('\n')) as {
      profiles: Array<{ name: string; context_mode?: string; context_group?: string | null }>;
    };
    const work = payload.profiles.find((profile) => profile.name === 'work');

    expect(work).toBeTruthy();
    expect(work?.context_mode).toBe('shared');
    expect(work?.context_group).toBe('sprint-a');
  });

  it('prefers unified context metadata over legacy when profile names overlap', async () => {
    const ccsDir = path.join(tempRoot, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'profiles.json'),
      JSON.stringify(
        {
          version: '2.0.0',
          profiles: {
            work: {
              type: 'account',
              created: '2026-01-01T00:00:00.000Z',
              last_used: null,
              context_mode: 'isolated',
            },
          },
          default: null,
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      path.join(ccsDir, 'config.yaml'),
      [
        'version: 8',
        'accounts:',
        '  work:',
        '    created: "2026-02-01T00:00:00.000Z"',
        '    last_used: null',
        '    context_mode: shared',
        '    context_group: sprint-a',
        'profiles: {}',
        'cliproxy:',
        '  oauth_accounts: {}',
        '  providers: {}',
        '  variants: {}',
      ].join('\n'),
      'utf8'
    );

    const registry = new ProfileRegistry();
    const instanceMgr = new InstanceManager();
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };

    try {
      await handleList(
        {
          registry,
          instanceMgr,
          version: 'test',
        },
        ['--json']
      );
    } finally {
      console.log = originalLog;
    }

    const payload = JSON.parse(lines.join('\n')) as {
      profiles: Array<{ name: string; context_mode?: string; context_group?: string | null }>;
    };
    const work = payload.profiles.find((profile) => profile.name === 'work');

    expect(work).toBeTruthy();
    expect(work?.context_mode).toBe('shared');
    expect(work?.context_group).toBe('sprint-a');
  });
});
