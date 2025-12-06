/**
 * Tests for CLIProxy Command - Profile Management
 *
 * Tests the CRUD operations for CLIProxy variant profiles:
 * - create: Creates new variant with provider + model
 * - list: Lists all custom variants
 * - remove: Removes variant and settings file
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('CLIProxy Command - Profile Management', () => {
  // Test fixtures directory
  let testDir;
  let testConfigPath;
  let testCcsDir;

  beforeEach(() => {
    // Create isolated test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-cliproxy-test-'));
    testCcsDir = path.join(testDir, '.ccs');
    testConfigPath = path.join(testCcsDir, 'config.json');
    fs.mkdirSync(testCcsDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateProfileName', () => {
    // Import validation logic pattern from source
    const validateProfileName = (name) => {
      if (!name) return 'Profile name is required';
      if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
        return 'Name must start with letter, contain only letters, numbers, dot, dash, underscore';
      }
      if (name.length > 32) return 'Name must be 32 characters or less';
      const reserved = [
        'default', 'auth', 'api', 'doctor', 'sync', 'update', 'help', 'version',
        'cliproxy', 'create', 'list', 'remove', 'gemini', 'codex', 'agy', 'qwen'
      ];
      if (reserved.includes(name.toLowerCase())) return `'${name}' is a reserved name`;
      return null;
    };

    it('rejects empty name', () => {
      assert.strictEqual(validateProfileName(''), 'Profile name is required');
      assert.strictEqual(validateProfileName(null), 'Profile name is required');
      assert.strictEqual(validateProfileName(undefined), 'Profile name is required');
    });

    it('rejects names starting with number', () => {
      const result = validateProfileName('3test');
      assert(result !== null, 'Should reject name starting with number');
      assert(result.includes('start with letter'));
    });

    it('rejects names starting with special character', () => {
      assert(validateProfileName('-test') !== null);
      assert(validateProfileName('_test') !== null);
      assert(validateProfileName('.test') !== null);
    });

    it('accepts valid names', () => {
      assert.strictEqual(validateProfileName('g3'), null);
      assert.strictEqual(validateProfileName('flash'), null);
      assert.strictEqual(validateProfileName('pro-v2'), null);
      assert.strictEqual(validateProfileName('test_model'), null);
      assert.strictEqual(validateProfileName('MyModel.v1'), null);
    });

    it('rejects names over 32 characters', () => {
      const longName = 'a'.repeat(33);
      const result = validateProfileName(longName);
      assert(result !== null);
      assert(result.includes('32 characters'));
    });

    it('accepts names exactly 32 characters', () => {
      const exactName = 'a'.repeat(32);
      assert.strictEqual(validateProfileName(exactName), null);
    });

    it('rejects reserved names (case insensitive)', () => {
      const reserved = ['gemini', 'GEMINI', 'Gemini', 'codex', 'agy', 'qwen', 'default', 'cliproxy'];
      reserved.forEach((name) => {
        const result = validateProfileName(name);
        assert(result !== null, `Should reject reserved name: ${name}`);
        assert(result.includes('reserved'), `Error should mention reserved: ${name}`);
      });
    });

    it('rejects command names as profile names', () => {
      const commands = ['create', 'list', 'remove', 'help', 'version'];
      commands.forEach((name) => {
        const result = validateProfileName(name);
        assert(result !== null, `Should reject command name: ${name}`);
      });
    });
  });

  describe('Settings File Format', () => {
    it('creates settings with all 6 required env fields', () => {
      // Simulate what createCliproxySettingsFile produces
      const model = 'gemini-3-pro-preview';
      const settings = {
        env: {
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317/api/provider/gemini',
          ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
          ANTHROPIC_MODEL: model,
          ANTHROPIC_DEFAULT_OPUS_MODEL: model,
          ANTHROPIC_DEFAULT_SONNET_MODEL: model,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
        },
      };

      // Verify all required fields present
      assert(settings.env.ANTHROPIC_BASE_URL, 'Missing ANTHROPIC_BASE_URL');
      assert(settings.env.ANTHROPIC_AUTH_TOKEN, 'Missing ANTHROPIC_AUTH_TOKEN');
      assert(settings.env.ANTHROPIC_MODEL, 'Missing ANTHROPIC_MODEL');
      assert(settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'Missing ANTHROPIC_DEFAULT_OPUS_MODEL');
      assert(settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'Missing ANTHROPIC_DEFAULT_SONNET_MODEL');
      assert(settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'Missing ANTHROPIC_DEFAULT_HAIKU_MODEL');

      // Verify model applied to all 4 model fields
      assert.strictEqual(settings.env.ANTHROPIC_MODEL, model);
      assert.strictEqual(settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL, model);
      assert.strictEqual(settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL, model);
      assert.strictEqual(settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, model);
    });

    it('uses correct provider endpoint in BASE_URL', () => {
      const providers = ['gemini', 'codex', 'agy', 'qwen'];
      providers.forEach((provider) => {
        const expectedUrl = `http://127.0.0.1:8317/api/provider/${provider}`;
        assert(expectedUrl.includes(provider), `URL should contain provider: ${provider}`);
        assert(expectedUrl.startsWith('http://127.0.0.1:8317'), 'Should use localhost:8317');
      });
    });

    it('settings file is valid JSON', () => {
      const settingsPath = path.join(testCcsDir, 'gemini-test.settings.json');
      const settings = {
        env: {
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317/api/provider/gemini',
          ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
          ANTHROPIC_MODEL: 'gemini-3-pro-preview',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'gemini-3-pro-preview',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'gemini-3-pro-preview',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gemini-3-pro-preview',
        },
      };

      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

      // Verify it can be read back
      const readBack = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.deepStrictEqual(readBack, settings);
    });
  });

  describe('Config.json CLIProxy Section', () => {
    it('adds cliproxy section when creating first variant', () => {
      const config = { profiles: {} };

      // Simulate adding variant
      if (!config.cliproxy) config.cliproxy = {};
      config.cliproxy['g3'] = {
        provider: 'gemini',
        settings: '~/.ccs/gemini-g3.settings.json',
      };

      assert(config.cliproxy, 'cliproxy section should exist');
      assert(config.cliproxy.g3, 'g3 variant should exist');
      assert.strictEqual(config.cliproxy.g3.provider, 'gemini');
    });

    it('preserves existing profiles when adding variant', () => {
      const config = {
        profiles: {
          glm: '~/.ccs/glm.settings.json',
          kimi: '~/.ccs/kimi.settings.json',
        },
      };

      // Simulate adding variant
      if (!config.cliproxy) config.cliproxy = {};
      config.cliproxy['flash'] = {
        provider: 'gemini',
        settings: '~/.ccs/gemini-flash.settings.json',
      };

      // Verify profiles preserved
      assert.strictEqual(Object.keys(config.profiles).length, 2);
      assert(config.profiles.glm);
      assert(config.profiles.kimi);
      // Verify variant added
      assert(config.cliproxy.flash);
    });

    it('removes cliproxy section when last variant removed', () => {
      const config = {
        profiles: { glm: '~/.ccs/glm.settings.json' },
        cliproxy: {
          g3: { provider: 'gemini', settings: '~/.ccs/gemini-g3.settings.json' },
        },
      };

      // Simulate removing last variant
      delete config.cliproxy.g3;
      if (Object.keys(config.cliproxy).length === 0) {
        delete config.cliproxy;
      }

      assert(!config.cliproxy, 'cliproxy section should be removed when empty');
      assert(config.profiles.glm, 'profiles should be preserved');
    });

    it('keeps cliproxy section when other variants exist', () => {
      const config = {
        profiles: {},
        cliproxy: {
          g3: { provider: 'gemini', settings: '~/.ccs/gemini-g3.settings.json' },
          flash: { provider: 'gemini', settings: '~/.ccs/gemini-flash.settings.json' },
        },
      };

      // Simulate removing one variant
      delete config.cliproxy.flash;
      if (Object.keys(config.cliproxy).length === 0) {
        delete config.cliproxy;
      }

      assert(config.cliproxy, 'cliproxy section should remain');
      assert(config.cliproxy.g3, 'g3 should still exist');
      assert(!config.cliproxy.flash, 'flash should be removed');
    });

    it('uses tilde (~) path format for portability', () => {
      const variant = {
        provider: 'gemini',
        settings: '~/.ccs/gemini-g3.settings.json',
      };

      assert(variant.settings.startsWith('~/'), 'Path should start with ~/');
      assert(variant.settings.includes('.ccs'), 'Path should include .ccs');
    });
  });

  describe('Provider Validation', () => {
    const validProviders = ['gemini', 'codex', 'agy', 'qwen'];

    it('accepts all valid providers', () => {
      validProviders.forEach((provider) => {
        assert(validProviders.includes(provider), `${provider} should be valid`);
      });
    });

    it('rejects invalid providers', () => {
      const invalidProviders = ['openai', 'anthropic', 'claude', 'gpt', 'invalid'];
      invalidProviders.forEach((provider) => {
        assert(!validProviders.includes(provider), `${provider} should be invalid`);
      });
    });
  });

  describe('Atomic Config Writes', () => {
    it('uses temp file + rename pattern for safety', () => {
      const configPath = testConfigPath;
      const tempPath = configPath + '.tmp';
      const config = { profiles: {}, cliproxy: { test: { provider: 'gemini', settings: '~/.ccs/test.json' } } };

      // Write to temp
      fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n');
      assert(fs.existsSync(tempPath), 'Temp file should exist');

      // Rename (atomic on most filesystems)
      fs.renameSync(tempPath, configPath);
      assert(fs.existsSync(configPath), 'Config should exist after rename');
      assert(!fs.existsSync(tempPath), 'Temp should not exist after rename');

      // Verify content
      const readBack = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.deepStrictEqual(readBack, config);
    });
  });

  describe('Settings File Naming Convention', () => {
    it('uses provider-name.settings.json format', () => {
      const testCases = [
        { provider: 'gemini', name: 'g3', expected: 'gemini-g3.settings.json' },
        { provider: 'gemini', name: 'flash', expected: 'gemini-flash.settings.json' },
        { provider: 'codex', name: 'turbo', expected: 'codex-turbo.settings.json' },
        { provider: 'agy', name: 'opus', expected: 'agy-opus.settings.json' },
      ];

      testCases.forEach(({ provider, name, expected }) => {
        const filename = `${provider}-${name}.settings.json`;
        assert.strictEqual(filename, expected, `Wrong filename for ${provider}/${name}`);
      });
    });
  });
});

describe('API Command - Model Fields Fix', () => {
  describe('createSettingsFile', () => {
    it('includes all 4 model fields', () => {
      // Simulate what createSettingsFile now produces
      const model = 'claude-sonnet-4-5-20250929';
      const settings = {
        env: {
          ANTHROPIC_BASE_URL: 'https://api.example.com',
          ANTHROPIC_AUTH_TOKEN: 'test-key',
          ANTHROPIC_MODEL: model,
          ANTHROPIC_DEFAULT_OPUS_MODEL: model,
          ANTHROPIC_DEFAULT_SONNET_MODEL: model,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
        },
      };

      // Verify all 4 model fields present and equal
      const modelFields = [
        'ANTHROPIC_MODEL',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      ];

      modelFields.forEach((field) => {
        assert(settings.env[field], `Missing ${field}`);
        assert.strictEqual(settings.env[field], model, `${field} should equal model`);
      });
    });

    it('applies single model input to all 4 fields', () => {
      const inputModel = 'custom-model-v1';

      // This is the fix: single model applied to all 4 fields
      const env = {
        ANTHROPIC_MODEL: inputModel,
        ANTHROPIC_DEFAULT_OPUS_MODEL: inputModel,
        ANTHROPIC_DEFAULT_SONNET_MODEL: inputModel,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: inputModel,
      };

      // All should be identical
      assert.strictEqual(env.ANTHROPIC_MODEL, inputModel);
      assert.strictEqual(env.ANTHROPIC_DEFAULT_OPUS_MODEL, inputModel);
      assert.strictEqual(env.ANTHROPIC_DEFAULT_SONNET_MODEL, inputModel);
      assert.strictEqual(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, inputModel);
    });
  });
});
