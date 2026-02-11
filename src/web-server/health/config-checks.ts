/**
 * Configuration Health Checks
 *
 * Check config.json, config.yaml, settings files, and Claude settings.
 * Supports both legacy (config.json) and unified (config.yaml) modes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getConfigPath, getCcsDir } from '../../utils/config-manager';
import { isUnifiedMode, hasUnifiedConfig } from '../../config/unified-config-loader';
import type { HealthCheck } from './types';

/**
 * Check config file (config.json or config.yaml based on mode)
 */
export function checkConfigFile(): HealthCheck {
  // In unified mode, check config.yaml
  if (isUnifiedMode() || hasUnifiedConfig()) {
    const ccsDir = getCcsDir();
    const yamlPath = path.join(ccsDir, 'config.yaml');

    if (!fs.existsSync(yamlPath)) {
      return {
        id: 'config-file',
        name: 'config.yaml',
        status: 'warning',
        message: 'Not found (unified mode)',
        details: yamlPath,
        fixable: true,
      };
    }

    try {
      fs.readFileSync(yamlPath, 'utf8');
      return {
        id: 'config-file',
        name: 'config.yaml',
        status: 'ok',
        message: 'Valid (unified mode)',
        details: yamlPath,
      };
    } catch {
      return {
        id: 'config-file',
        name: 'config.yaml',
        status: 'error',
        message: 'Cannot read file',
        details: yamlPath,
      };
    }
  }

  // Legacy mode: check config.json
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return {
      id: 'config-file',
      name: 'config.json',
      status: 'warning',
      message: 'Not found',
      details: configPath,
      fixable: true,
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    JSON.parse(content);
    return {
      id: 'config-file',
      name: 'config.json',
      status: 'ok',
      message: 'Valid',
      details: configPath,
    };
  } catch {
    return {
      id: 'config-file',
      name: 'config.json',
      status: 'error',
      message: 'Invalid JSON',
      details: configPath,
    };
  }
}

/**
 * Check settings files (glm, kimi)
 */
export function checkSettingsFiles(ccsDir: string): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const files = [
    { name: 'glm.settings.json', profile: 'glm' },
    { name: 'kimi.settings.json', profile: 'kimi' },
  ];

  const { DelegationValidator } = require('../../utils/delegation-validator');

  for (const file of files) {
    const filePath = path.join(ccsDir, file.name);

    if (!fs.existsSync(filePath)) {
      checks.push({
        id: `settings-${file.profile}`,
        name: file.name,
        status: 'info',
        message: 'Not configured',
        details: filePath,
      });
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);

      const validation = DelegationValidator.validate(file.profile);

      if (validation.valid) {
        checks.push({
          id: `settings-${file.profile}`,
          name: file.name,
          status: 'ok',
          message: 'Key configured',
          details: filePath,
        });
      } else if (validation.error && validation.error.includes('placeholder')) {
        checks.push({
          id: `settings-${file.profile}`,
          name: file.name,
          status: 'warning',
          message: 'Placeholder key',
          details: filePath,
        });
      } else {
        checks.push({
          id: `settings-${file.profile}`,
          name: file.name,
          status: 'ok',
          message: 'Valid JSON',
          details: filePath,
        });
      }
    } catch {
      checks.push({
        id: `settings-${file.profile}`,
        name: file.name,
        status: 'error',
        message: 'Invalid JSON',
        details: filePath,
      });
    }
  }

  return checks;
}

/**
 * Check Claude settings file
 */
export function checkClaudeSettings(claudeDir: string): HealthCheck {
  const settingsPath = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    return {
      id: 'claude-settings',
      name: '~/.claude/settings.json',
      status: 'warning',
      message: 'Not found',
      fix: 'Run: claude /login',
    };
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf8');
    JSON.parse(content);
    return {
      id: 'claude-settings',
      name: '~/.claude/settings.json',
      status: 'ok',
      message: 'Valid',
    };
  } catch {
    return {
      id: 'claude-settings',
      name: '~/.claude/settings.json',
      status: 'warning',
      message: 'Invalid JSON',
      fix: 'Run: claude /login',
    };
  }
}
