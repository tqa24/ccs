/**
 * Auto-recovery for missing or corrupted configuration
 * Lazy initialization: Creates ~/.ccs/ structure on first CLI run
 * Mirrors postinstall.js behavior for package managers that skip lifecycle scripts (e.g., bun)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { info } from '../utils/ui';

/**
 * Get CCS home directory (respects CCS_HOME env for test isolation)
 */
function getCcsHome(): string {
  return process.env.CCS_HOME || os.homedir();
}

/**
 * Recovery Manager Class
 */
class RecoveryManager {
  private readonly homedir: string;
  private readonly ccsDir: string;
  private readonly claudeDir: string;
  private readonly sharedDir: string;
  private readonly completionsDir: string;
  private recovered: string[];

  constructor() {
    this.homedir = getCcsHome();
    this.ccsDir = path.join(this.homedir, '.ccs');
    this.claudeDir = path.join(this.homedir, '.claude');
    this.sharedDir = path.join(this.ccsDir, 'shared');
    this.completionsDir = path.join(this.ccsDir, 'completions');
    this.recovered = [];
  }

  /**
   * Ensure ~/.ccs/ directory exists
   */
  ensureCcsDirectory(): boolean {
    if (!fs.existsSync(this.ccsDir)) {
      fs.mkdirSync(this.ccsDir, { recursive: true, mode: 0o755 });
      this.recovered.push('Created ~/.ccs/ directory');
      return true;
    }
    return false;
  }

  /**
   * Ensure ~/.ccs/config.json exists with defaults
   */
  ensureConfigJson(): boolean {
    const configPath = path.join(this.ccsDir, 'config.json');

    // Check if exists and valid
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        JSON.parse(content); // Validate JSON
        return false; // No recovery needed
      } catch (_e) {
        // Corrupted - backup and recreate
        const backupPath = `${configPath}.backup.${Date.now()}`;
        fs.renameSync(configPath, backupPath);
        this.recovered.push(`Backed up corrupted config.json to ${path.basename(backupPath)}`);
      }
    }

    // Create default config (matches postinstall.js)
    // NOTE: No 'default' entry - when no profile specified, CCS passes through
    // to Claude's native auth without --settings flag
    const defaultConfig = {
      profiles: {
        glm: '~/.ccs/glm.settings.json',
        glmt: '~/.ccs/glmt.settings.json',
        kimi: '~/.ccs/kimi.settings.json',
      },
    };

    const tmpPath = `${configPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, configPath);

    this.recovered.push('Created ~/.ccs/config.json');
    return true;
  }

  /**
   * Ensure ~/.claude/settings.json exists
   */
  ensureClaudeSettings(): boolean {
    const claudeSettingsPath = path.join(this.claudeDir, 'settings.json');

    // Create ~/.claude/ if missing
    if (!fs.existsSync(this.claudeDir)) {
      fs.mkdirSync(this.claudeDir, { recursive: true, mode: 0o755 });
      this.recovered.push('Created ~/.claude/ directory');
    }

    // Create settings.json if missing
    if (!fs.existsSync(claudeSettingsPath)) {
      const tmpPath = `${claudeSettingsPath}.tmp`;
      fs.writeFileSync(tmpPath, '{}\n', 'utf8');
      fs.renameSync(tmpPath, claudeSettingsPath);

      this.recovered.push('Created ~/.claude/settings.json');
      return true;
    }

    return false;
  }

  /**
   * Ensure ~/.ccs/shared/ directory structure exists
   */
  ensureSharedDirectories(): boolean {
    let created = false;

    // Create shared directory
    if (!fs.existsSync(this.sharedDir)) {
      fs.mkdirSync(this.sharedDir, { recursive: true, mode: 0o755 });
      this.recovered.push('Created ~/.ccs/shared/');
      created = true;
    }

    // Create subdirectories
    const subdirs = ['commands', 'skills', 'agents', 'plugins'];
    for (const subdir of subdirs) {
      const subdirPath = path.join(this.sharedDir, subdir);
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true, mode: 0o755 });
        created = true;
      }
    }

    return created;
  }

  /**
   * Ensure GLM settings file exists
   */
  ensureGlmSettings(): boolean {
    const settingsPath = path.join(this.ccsDir, 'glm.settings.json');
    if (fs.existsSync(settingsPath)) return false;

    const settings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
        ANTHROPIC_AUTH_TOKEN: 'YOUR_GLM_API_KEY_HERE',
        ANTHROPIC_MODEL: 'glm-4.6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-4.6',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.6',
      },
    };

    const tmpPath = `${settingsPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, settingsPath);
    this.recovered.push('Created ~/.ccs/glm.settings.json');
    return true;
  }

  /**
   * Ensure GLMT settings file exists
   */
  ensureGlmtSettings(): boolean {
    const settingsPath = path.join(this.ccsDir, 'glmt.settings.json');
    if (fs.existsSync(settingsPath)) return false;

    const settings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
        ANTHROPIC_AUTH_TOKEN: 'YOUR_GLM_API_KEY_HERE',
        ANTHROPIC_MODEL: 'glm-4.6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-4.6',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.6',
        ANTHROPIC_TEMPERATURE: '0.2',
        ANTHROPIC_MAX_TOKENS: '65536',
        MAX_THINKING_TOKENS: '32768',
        ENABLE_STREAMING: 'true',
        ANTHROPIC_SAFE_MODE: 'false',
        API_TIMEOUT_MS: '3000000',
      },
      alwaysThinkingEnabled: true,
    };

    const tmpPath = `${settingsPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, settingsPath);
    this.recovered.push('Created ~/.ccs/glmt.settings.json');
    return true;
  }

  /**
   * Ensure Kimi settings file exists
   */
  ensureKimiSettings(): boolean {
    const settingsPath = path.join(this.ccsDir, 'kimi.settings.json');
    if (fs.existsSync(settingsPath)) return false;

    const settings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/',
        ANTHROPIC_AUTH_TOKEN: 'YOUR_KIMI_API_KEY_HERE',
        ANTHROPIC_MODEL: 'kimi-k2-thinking-turbo',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2-thinking-turbo',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2-thinking-turbo',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2-thinking-turbo',
      },
      alwaysThinkingEnabled: true,
    };

    const tmpPath = `${settingsPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, settingsPath);
    this.recovered.push('Created ~/.ccs/kimi.settings.json');
    return true;
  }

  /**
   * Install shell completion files
   */
  ensureShellCompletions(): boolean {
    // Find the scripts/completion directory relative to this module
    // In dist: dist/management/recovery-manager.js → scripts/completion
    // In src: src/management/recovery-manager.ts → scripts/completion
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'scripts', 'completion'), // from dist/management/
      path.join(__dirname, '..', '..', '..', 'scripts', 'completion'), // alternative
    ];

    let scriptsCompletionDir: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        scriptsCompletionDir = p;
        break;
      }
    }

    if (!scriptsCompletionDir) {
      // Completion scripts not found - skip silently (may be installed differently)
      return false;
    }

    // Create completions directory
    if (!fs.existsSync(this.completionsDir)) {
      fs.mkdirSync(this.completionsDir, { recursive: true, mode: 0o755 });
    }

    const files = ['ccs.bash', 'ccs.zsh', 'ccs.fish', 'ccs.ps1'];
    let installed = false;

    for (const file of files) {
      const src = path.join(scriptsCompletionDir, file);
      const dest = path.join(this.completionsDir, file);

      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        installed = true;
      }
    }

    if (installed) {
      this.recovered.push('Installed shell completions to ~/.ccs/completions/');
    }

    return installed;
  }

  /**
   * Run all recovery operations (lazy initialization)
   * Mirrors postinstall.js behavior
   */
  recoverAll(): boolean {
    this.recovered = [];

    // Core directories
    this.ensureCcsDirectory();
    this.ensureSharedDirectories();
    this.ensureClaudeSettings();

    // Config files
    this.ensureConfigJson();
    this.ensureGlmSettings();
    this.ensureGlmtSettings();
    this.ensureKimiSettings();

    // Shell completions
    this.ensureShellCompletions();

    return this.recovered.length > 0;
  }

  /**
   * Get recovery summary
   */
  getRecoverySummary(): string[] {
    return this.recovered;
  }

  /**
   * Show recovery hints
   */
  showRecoveryHints(): void {
    if (this.recovered.length === 0) return;

    console.log('');
    console.log(info('Auto-recovery completed:'));
    this.recovered.forEach((msg) => console.log(`    - ${msg}`));

    // Show API key hints if created profile settings
    const createdGlm = this.recovered.some((msg) => msg.includes('glm.settings.json'));
    const createdKimi = this.recovered.some((msg) => msg.includes('kimi.settings.json'));

    if (createdGlm || createdKimi) {
      console.log('');
      console.log(info('Configure API keys:'));
      if (createdGlm) {
        console.log('    GLM: Edit ~/.ccs/glm.settings.json');
        console.log('          Get key from: https://api.z.ai');
      }
      if (createdKimi) {
        console.log('    Kimi: Edit ~/.ccs/kimi.settings.json');
        console.log('          Get key from: https://www.kimi.com/coding');
      }
    }

    // Show login hint if created Claude settings
    if (this.recovered.some((msg) => msg.includes('~/.claude/settings.json'))) {
      console.log('');
      console.log(info('Next step: Login to Claude CLI'));
      console.log('    Run: claude /login');
    }

    console.log('');
  }
}

export default RecoveryManager;
