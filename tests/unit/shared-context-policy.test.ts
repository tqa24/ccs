import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import SharedManager from '../../src/management/shared-manager';
import InstanceManager from '../../src/management/instance-manager';
import type { AccountContextPolicy } from '../../src/auth/account-context';

function getTestCcsDir(): string {
  if (!process.env.CCS_HOME) {
    throw new Error('CCS_HOME must be set in tests');
  }
  return path.join(path.resolve(process.env.CCS_HOME), '.ccs');
}

describe('SharedManager context policy', () => {
  let tempRoot = '';
  let originalHome: string | undefined;
  let originalCcsHome: string | undefined;
  let originalCcsDir: string | undefined;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-context-policy-test-'));
    originalHome = process.env.HOME;
    originalCcsHome = process.env.CCS_HOME;
    originalCcsDir = process.env.CCS_DIR;

    const isolatedHome = path.join(tempRoot, 'home');
    fs.mkdirSync(isolatedHome, { recursive: true });
    process.env.HOME = isolatedHome;
    process.env.CCS_HOME = tempRoot;
    delete process.env.CCS_DIR;
  });

  afterEach(() => {
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;

    if (originalCcsHome !== undefined) process.env.CCS_HOME = originalCcsHome;
    else delete process.env.CCS_HOME;

    if (originalCcsDir !== undefined) process.env.CCS_DIR = originalCcsDir;
    else delete process.env.CCS_DIR;

    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  async function applyPolicy(policy: AccountContextPolicy): Promise<{ instancePath: string; ccsDir: string }> {
    const ccsDir = getTestCcsDir();
    const instancePath = path.join(ccsDir, 'instances', 'work');
    fs.mkdirSync(instancePath, { recursive: true });

    const manager = new SharedManager();
    await manager.syncProjectContext(instancePath, policy);

    return { instancePath, ccsDir };
  }

  it('keeps projects isolated by default', async () => {
    const { instancePath } = await applyPolicy({ mode: 'isolated' });
    const projectsPath = path.join(instancePath, 'projects');

    expect(fs.existsSync(projectsPath)).toBe(true);
    expect(fs.lstatSync(projectsPath).isDirectory()).toBe(true);
  });

  it('migrates local projects into shared context group', async () => {
    const ccsDir = getTestCcsDir();
    const instancePath = path.join(ccsDir, 'instances', 'work');
    const localProjectsPath = path.join(instancePath, 'projects');
    const localFile = path.join(localProjectsPath, '-tmp-project', 'notes.md');

    fs.mkdirSync(path.dirname(localFile), { recursive: true });
    fs.writeFileSync(localFile, 'local context', 'utf8');

    const manager = new SharedManager();
    await manager.syncProjectContext(instancePath, { mode: 'shared', group: 'sprint-a' });

    const linkStats = fs.lstatSync(localProjectsPath);
    expect(linkStats.isSymbolicLink()).toBe(true);

    const sharedFile = path.join(
      ccsDir,
      'shared',
      'context-groups',
      'sprint-a',
      'projects',
      '-tmp-project',
      'notes.md'
    );
    expect(fs.existsSync(sharedFile)).toBe(true);
    expect(fs.readFileSync(sharedFile, 'utf8')).toBe('local context');
  });

  it('switches from shared mode back to isolated without data loss', async () => {
    const { instancePath, ccsDir } = await applyPolicy({ mode: 'shared', group: 'sprint-a' });
    const sharedFile = path.join(
      ccsDir,
      'shared',
      'context-groups',
      'sprint-a',
      'projects',
      '-tmp-project',
      'history.md'
    );

    fs.mkdirSync(path.dirname(sharedFile), { recursive: true });
    fs.writeFileSync(sharedFile, 'shared history', 'utf8');

    const manager = new SharedManager();
    await manager.syncProjectContext(instancePath, { mode: 'isolated' });

    const projectsPath = path.join(instancePath, 'projects');
    const projectFile = path.join(projectsPath, '-tmp-project', 'history.md');

    expect(fs.lstatSync(projectsPath).isDirectory()).toBe(true);
    expect(fs.existsSync(projectFile)).toBe(true);
    expect(fs.readFileSync(projectFile, 'utf8')).toBe('shared history');
  });

  it('serializes concurrent context sync for the same profile', async () => {
    const instanceMgr = new InstanceManager();
    const jobs = Array.from({ length: 6 }, () =>
      instanceMgr.ensureInstance('work', { mode: 'shared', group: 'sprint-a' })
    );

    await Promise.all(jobs);

    const ccsDir = getTestCcsDir();
    const projectsPath = path.join(ccsDir, 'instances', 'work', 'projects');
    const stats = fs.lstatSync(projectsPath);

    expect(stats.isDirectory() || stats.isSymbolicLink()).toBe(true);
  });
});
