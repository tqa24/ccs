import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import SharedManager from '../../src/management/shared-manager';

function getTestCcsDir(): string {
  if (!process.env.CCS_HOME) {
    throw new Error('CCS_HOME must be set in tests');
  }
  return path.join(path.resolve(process.env.CCS_HOME), '.ccs');
}

describe('SharedManager project memory sync', () => {
  let tempRoot = '';
  let originalHome: string | undefined;
  let originalCcsHome: string | undefined;
  let originalCcsDir: string | undefined;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-shared-memory-test-'));
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

  it('migrates existing project memory and replaces it with a shared symlink', async () => {
    const ccsDir = getTestCcsDir();
    const instancePath = path.join(ccsDir, 'instances', 'work');
    const projectName = '-tmp-my-project';
    const projectMemoryPath = path.join(instancePath, 'projects', projectName, 'memory');
    fs.mkdirSync(projectMemoryPath, { recursive: true });
    fs.writeFileSync(path.join(projectMemoryPath, 'MEMORY.md'), 'instance knowledge', 'utf8');

    const manager = new SharedManager();
    await manager.syncProjectMemories(instancePath);

    const sharedMemoryFile = path.join(ccsDir, 'shared', 'memory', projectName, 'MEMORY.md');
    expect(fs.existsSync(sharedMemoryFile)).toBe(true);
    expect(fs.readFileSync(sharedMemoryFile, 'utf8')).toBe('instance knowledge');

    const linkStats = fs.lstatSync(projectMemoryPath);
    expect(linkStats.isSymbolicLink()).toBe(true);

    const resolvedTarget = path.resolve(path.dirname(projectMemoryPath), fs.readlinkSync(projectMemoryPath));
    expect(resolvedTarget).toBe(path.join(ccsDir, 'shared', 'memory', projectName));
  });

  it('preserves canonical memory and writes conflict copy when contents differ', async () => {
    const ccsDir = getTestCcsDir();
    const instancePath = path.join(ccsDir, 'instances', 'work');
    const projectName = '-tmp-shared-project';
    const projectMemoryPath = path.join(instancePath, 'projects', projectName, 'memory');
    const sharedProjectMemoryPath = path.join(ccsDir, 'shared', 'memory', projectName);
    fs.mkdirSync(projectMemoryPath, { recursive: true });
    fs.mkdirSync(sharedProjectMemoryPath, { recursive: true });

    fs.writeFileSync(path.join(projectMemoryPath, 'MEMORY.md'), 'instance memory', 'utf8');
    fs.writeFileSync(path.join(sharedProjectMemoryPath, 'MEMORY.md'), 'shared memory', 'utf8');

    const manager = new SharedManager();
    await manager.syncProjectMemories(instancePath);

    const canonicalFile = path.join(sharedProjectMemoryPath, 'MEMORY.md');
    expect(fs.readFileSync(canonicalFile, 'utf8')).toBe('shared memory');

    const conflictFile = path.join(sharedProjectMemoryPath, 'MEMORY.md.migrated-from-work');
    expect(fs.existsSync(conflictFile)).toBe(true);
    expect(fs.readFileSync(conflictFile, 'utf8')).toBe('instance memory');

    const linkStats = fs.lstatSync(projectMemoryPath);
    expect(linkStats.isSymbolicLink()).toBe(true);
  });

  it('creates shared memory link for projects that do not have memory directory yet', async () => {
    const ccsDir = getTestCcsDir();
    const instancePath = path.join(ccsDir, 'instances', 'work');
    const projectName = '-tmp-new-project';
    const projectPath = path.join(instancePath, 'projects', projectName);
    const projectMemoryPath = path.join(projectPath, 'memory');
    fs.mkdirSync(projectPath, { recursive: true });

    const manager = new SharedManager();
    await manager.syncProjectMemories(instancePath);

    const linkStats = fs.lstatSync(projectMemoryPath);
    expect(linkStats.isSymbolicLink()).toBe(true);

    const sharedProjectMemoryPath = path.join(ccsDir, 'shared', 'memory', projectName);
    expect(fs.existsSync(sharedProjectMemoryPath)).toBe(true);
  });
});
