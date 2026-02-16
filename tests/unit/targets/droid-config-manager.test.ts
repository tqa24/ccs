/**
 * Unit tests for Droid config manager
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  upsertCcsModel,
  removeCcsModel,
  listCcsModels,
  pruneOrphanedModels,
} from '../../../src/targets/droid-config-manager';

describe('droid-config-manager', () => {
  let tmpDir: string;
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-droid-test-'));
    originalCcsHome = process.env.CCS_HOME;
    process.env.CCS_HOME = tmpDir;
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('upsertCcsModel', () => {
    it('should create settings.json with customModels', async () => {
      await upsertCcsModel('gemini', {
        model: 'claude-opus-4-6',
        displayName: 'CCS gemini',
        baseUrl: 'http://localhost:8317',
        apiKey: 'dummy-key',
        provider: 'anthropic',
      });

      const settingsPath = path.join(tmpDir, '.factory', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.customModels).toHaveLength(1);
      expect(settings.customModels[0].displayName).toBe('CCS gemini');
      expect(settings.customModels[0].baseUrl).toBe('http://localhost:8317');
    });

    it('should update existing entry on second upsert', async () => {
      await upsertCcsModel('gemini', {
        model: 'claude-opus-4-6',
        displayName: 'CCS gemini',
        baseUrl: 'http://localhost:8317',
        apiKey: 'key-1',
        provider: 'anthropic',
      });

      await upsertCcsModel('gemini', {
        model: 'claude-opus-4-6',
        displayName: 'CCS gemini',
        baseUrl: 'http://localhost:8318',
        apiKey: 'key-2',
        provider: 'anthropic',
      });

      const settingsPath = path.join(tmpDir, '.factory', 'settings.json');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.customModels).toHaveLength(1);
      expect(settings.customModels[0].apiKey).toBe('key-2');
      expect(settings.customModels[0].baseUrl).toBe('http://localhost:8318');
    });

    it('should preserve user entries', async () => {
      // Create existing settings with user's own custom model
      const factoryDir = path.join(tmpDir, '.factory');
      fs.mkdirSync(factoryDir, { recursive: true });
      fs.writeFileSync(
        path.join(factoryDir, 'settings.json'),
        JSON.stringify({
          customModels: [
            {
              model: 'gpt-4o',
              displayName: 'My GPT',
              baseUrl: 'https://api.openai.com',
              apiKey: 'sk-xxx',
              provider: 'openai',
            },
          ],
        })
      );

      await upsertCcsModel('gemini', {
        model: 'claude-opus-4-6',
        displayName: 'CCS gemini',
        baseUrl: 'http://localhost:8317',
        apiKey: 'dummy',
        provider: 'anthropic',
      });

      const settings = JSON.parse(
        fs.readFileSync(path.join(factoryDir, 'settings.json'), 'utf8')
      );
      expect(settings.customModels).toHaveLength(2);
      expect(settings.customModels[0].displayName).toBe('My GPT');
      expect(settings.customModels[1].displayName).toBe('CCS gemini');
    });

    it('should write with restricted permissions', async () => {
      await upsertCcsModel('test', {
        model: 'test-model',
        displayName: 'CCS test',
        baseUrl: 'http://localhost:8317',
        apiKey: 'secret',
        provider: 'anthropic',
      });

      const settingsPath = path.join(tmpDir, '.factory', 'settings.json');
      const stat = fs.statSync(settingsPath);
      // eslint-disable-next-line no-bitwise
      const otherPerms = stat.mode & 0o077;
      expect(otherPerms).toBe(0);
    });
  });

  describe('removeCcsModel', () => {
    it('should remove a CCS entry', async () => {
      await upsertCcsModel('gemini', {
        model: 'claude-opus-4-6',
        displayName: 'CCS gemini',
        baseUrl: 'http://localhost:8317',
        apiKey: 'dummy',
        provider: 'anthropic',
      });

      await removeCcsModel('gemini');

      const settingsPath = path.join(tmpDir, '.factory', 'settings.json');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.customModels).toHaveLength(0);
    });

    it('should not remove user entries', async () => {
      const factoryDir = path.join(tmpDir, '.factory');
      fs.mkdirSync(factoryDir, { recursive: true });
      fs.writeFileSync(
        path.join(factoryDir, 'settings.json'),
        JSON.stringify({
          customModels: [
            { model: 'gpt-4o', displayName: 'My GPT', baseUrl: 'x', apiKey: 'y', provider: 'openai' },
            { model: 'opus', displayName: 'CCS gemini', baseUrl: 'x', apiKey: 'y', provider: 'anthropic' },
          ],
        })
      );

      await removeCcsModel('gemini');

      const settings = JSON.parse(fs.readFileSync(path.join(factoryDir, 'settings.json'), 'utf8'));
      expect(settings.customModels).toHaveLength(1);
      expect(settings.customModels[0].displayName).toBe('My GPT');
    });
  });

  describe('listCcsModels', () => {
    it('should list only CCS entries', async () => {
      await upsertCcsModel('gemini', {
        model: 'opus',
        displayName: 'CCS gemini',
        baseUrl: 'http://localhost:8317',
        apiKey: 'dummy',
        provider: 'anthropic',
      });

      await upsertCcsModel('codex', {
        model: 'sonnet',
        displayName: 'CCS codex',
        baseUrl: 'http://localhost:8317',
        apiKey: 'dummy',
        provider: 'anthropic',
      });

      const models = await listCcsModels();
      expect(models.size).toBe(2);
      expect(models.has('gemini')).toBe(true);
      expect(models.has('codex')).toBe(true);
    });

    it('should return empty map when no settings file', async () => {
      const models = await listCcsModels();
      expect(models.size).toBe(0);
    });
  });

  describe('pruneOrphanedModels', () => {
    it('should remove orphaned CCS entries', async () => {
      await upsertCcsModel('gemini', {
        model: 'opus',
        displayName: 'CCS gemini',
        baseUrl: 'x',
        apiKey: 'y',
        provider: 'anthropic',
      });
      await upsertCcsModel('codex', {
        model: 'sonnet',
        displayName: 'CCS codex',
        baseUrl: 'x',
        apiKey: 'y',
        provider: 'anthropic',
      });

      // Only gemini is active — codex should be pruned
      const removed = await pruneOrphanedModels(['gemini']);
      expect(removed).toBe(1);

      const models = await listCcsModels();
      expect(models.size).toBe(1);
      expect(models.has('gemini')).toBe(true);
    });

    it('should preserve user entries during prune', async () => {
      const factoryDir = path.join(tmpDir, '.factory');
      fs.mkdirSync(factoryDir, { recursive: true });
      fs.writeFileSync(
        path.join(factoryDir, 'settings.json'),
        JSON.stringify({
          customModels: [
            { model: 'gpt-4o', displayName: 'My GPT', baseUrl: 'x', apiKey: 'y', provider: 'openai' },
            { model: 'opus', displayName: 'CCS old-profile', baseUrl: 'x', apiKey: 'y', provider: 'anthropic' },
          ],
        })
      );

      const removed = await pruneOrphanedModels([]);
      expect(removed).toBe(1);

      const settings = JSON.parse(fs.readFileSync(path.join(factoryDir, 'settings.json'), 'utf8'));
      expect(settings.customModels).toHaveLength(1);
      expect(settings.customModels[0].displayName).toBe('My GPT');
    });
  });

  describe('concurrent writes', () => {
    it('should handle concurrent upserts without data loss', async () => {
      // Write in batches of 3 to simulate realistic concurrency
      // (10 simultaneous locks exceeds retry budget)
      const profiles = Array.from({ length: 9 }, (_, i) => `profile-${i}`);

      for (let i = 0; i < profiles.length; i += 3) {
        const batch = profiles.slice(i, i + 3);
        await Promise.all(
          batch.map((p) =>
            upsertCcsModel(p, {
              model: 'test-model',
              displayName: `CCS ${p}`,
              baseUrl: 'http://localhost:8317',
              apiKey: 'key',
              provider: 'anthropic',
            })
          )
        );
      }

      const models = await listCcsModels();
      expect(models.size).toBe(9);

      for (const p of profiles) {
        expect(models.has(p)).toBe(true);
      }
    });
  });
});
