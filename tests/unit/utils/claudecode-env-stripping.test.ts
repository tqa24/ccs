import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'events';

type SpawnCall = {
  command: string;
  args: string[];
  options: Record<string, unknown> | undefined;
};

const spawnCalls: SpawnCall[] = [];
const originalPlatform = process.platform;
let baselineSigintListeners: Array<(...args: unknown[]) => void> = [];
let baselineSigtermListeners: Array<(...args: unknown[]) => void> = [];
let baselineSighupListeners: Array<(...args: unknown[]) => void> = [];

function createMockChild(): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  exitCode: number | null;
  killed: boolean;
  kill: () => boolean;
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    exitCode: number | null;
    killed: boolean;
    kill: () => boolean;
  };

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 1;
    return true;
  };

  return child;
}

mock.module('child_process', () => ({
  spawn: (...spawnArgs: unknown[]) => {
    const command = String(spawnArgs[0] ?? '');
    const maybeArgs = spawnArgs[1];
    const args = Array.isArray(maybeArgs) ? (maybeArgs as string[]) : [];
    const options = (Array.isArray(maybeArgs) ? spawnArgs[2] : spawnArgs[1]) as
      | Record<string, unknown>
      | undefined;

    spawnCalls.push({ command, args, options });

    const child = createMockChild();
    setTimeout(() => child.emit('close', 0), 0);
    return child;
  },
  spawnSync: () => ({ status: 0 }),
  execSync: () => '',
}));

let execClaude: typeof import('../../../src/utils/shell-executor').execClaude;
let stripClaudeCodeEnv: typeof import('../../../src/utils/shell-executor').stripClaudeCodeEnv;
let HeadlessExecutor: typeof import('../../../src/delegation/headless-executor').HeadlessExecutor;

beforeAll(async () => {
  const shellExecutor = await import('../../../src/utils/shell-executor');
  execClaude = shellExecutor.execClaude;
  stripClaudeCodeEnv = shellExecutor.stripClaudeCodeEnv;

  const headless = await import('../../../src/delegation/headless-executor');
  HeadlessExecutor = headless.HeadlessExecutor;
});

afterAll(() => {
  mock.restore();
});

describe('CLAUDECODE environment stripping', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    process.env.CCS_QUIET = '1';
    baselineSigintListeners = process.listeners('SIGINT');
    baselineSigtermListeners = process.listeners('SIGTERM');
    baselineSighupListeners = process.listeners('SIGHUP');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    delete process.env.CLAUDECODE;
    delete process.env.claudecode;
    delete process.env.CCS_QUIET;

    for (const listener of process.listeners('SIGINT')) {
      if (!baselineSigintListeners.includes(listener)) {
        process.removeListener('SIGINT', listener as (...args: unknown[]) => void);
      }
    }
    for (const listener of process.listeners('SIGTERM')) {
      if (!baselineSigtermListeners.includes(listener)) {
        process.removeListener('SIGTERM', listener as (...args: unknown[]) => void);
      }
    }
    for (const listener of process.listeners('SIGHUP')) {
      if (!baselineSighupListeners.includes(listener)) {
        process.removeListener('SIGHUP', listener as (...args: unknown[]) => void);
      }
    }
  });

  it('stripClaudeCodeEnv removes CLAUDECODE case-insensitively', () => {
    const input: NodeJS.ProcessEnv = {
      CLAUDECODE: 'upper',
      claudecode: 'lower',
      ClAuDeCoDe: 'mixed',
      PATH: '/usr/bin',
    };

    const result = stripClaudeCodeEnv(input);
    expect(Object.keys(result).map((k) => k.toUpperCase())).not.toContain('CLAUDECODE');
    expect(result.PATH).toBe('/usr/bin');
  });

  it('execClaude strips CLAUDECODE from merged env (including overrides)', () => {
    process.env.CLAUDECODE = 'from-parent';
    process.env.claudecode = 'from-parent-lower';

    execClaude('claude', ['--version'], {
      CCS_PROFILE_TYPE: 'default',
      CLAUDECODE: 'from-override',
      CCS_WEBSEARCH_SKIP: '1',
    });

    expect(spawnCalls.length).toBeGreaterThan(0);
    const env = spawnCalls[0].options?.env as NodeJS.ProcessEnv;
    expect(env).toBeDefined();
    expect(Object.keys(env).map((k) => k.toUpperCase())).not.toContain('CLAUDECODE');
    expect(env.CCS_WEBSEARCH_SKIP).toBe('1');
  });

  it('execClaude keeps behavior when CLAUDECODE is absent', () => {
    execClaude('claude', ['--help'], { CCS_PROFILE_TYPE: 'default' });

    expect(spawnCalls.length).toBeGreaterThan(0);
    const env = spawnCalls[0].options?.env as NodeJS.ProcessEnv;
    expect(env).toBeDefined();
    expect(Object.keys(env).map((k) => k.toUpperCase())).not.toContain('CLAUDECODE');
    expect(env.CCS_PROFILE_TYPE).toBe('default');
  });

  it('execClaude strips CLAUDECODE on Windows shell launch path', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.CLAUDECODE = 'set';

    execClaude('claude.cmd', ['--version'], { CCS_PROFILE_TYPE: 'default' });

    expect(spawnCalls.length).toBeGreaterThan(0);
    const env = spawnCalls[0].options?.env as NodeJS.ProcessEnv;
    expect(Object.keys(env).map((k) => k.toUpperCase())).not.toContain('CLAUDECODE');
  });

  it('headless executor spawn path strips CLAUDECODE before spawn', async () => {
    process.env.CLAUDECODE = 'nested';
    process.env.claudecode = 'nested-lower';

    const result = await (
      HeadlessExecutor as unknown as {
        _spawnAndExecute: (
          claudeCli: string,
          args: string[],
          ctx: {
            cwd: string;
            profile: string;
            timeout: number;
            resumeSession: boolean;
            sessionId: string | null;
            sessionMgr: {
              updateSession: (...args: unknown[]) => void;
              storeSession: (...args: unknown[]) => void;
              cleanupExpired: () => void;
            };
          }
        ) => Promise<unknown>;
      }
    )._spawnAndExecute('claude', ['-p', 'test'], {
      cwd: process.cwd(),
      profile: 'glm',
      timeout: 1000,
      resumeSession: false,
      sessionId: null,
      sessionMgr: {
        updateSession: () => {},
        storeSession: () => {},
        cleanupExpired: () => {},
      },
    });

    expect(result).toBeDefined();
    expect(spawnCalls.length).toBeGreaterThan(0);
    const env = spawnCalls[0].options?.env as NodeJS.ProcessEnv;
    expect(Object.keys(env).map((k) => k.toUpperCase())).not.toContain('CLAUDECODE');
  });
});
