/**
 * CLIProxy Variant Config Adapters
 *
 * Handles reading/writing variant config in both unified and legacy formats.
 */

import * as fs from 'fs';
import { getConfigPath, loadConfig } from '../../utils/config-manager';
import { CLIProxyProvider } from '../types';
import {
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
  isUnifiedMode,
} from '../../config/unified-config-loader';

/** Variant configuration structure */
export interface VariantConfig {
  provider: string;
  settings?: string;
  account?: string;
  model?: string;
}

/**
 * Check if variant exists in config
 */
export function variantExistsInConfig(name: string): boolean {
  try {
    if (isUnifiedMode()) {
      const config = loadOrCreateUnifiedConfig();
      return !!(config.cliproxy?.variants && name in config.cliproxy.variants);
    }
    const config = loadConfig();
    return !!(config.cliproxy && name in config.cliproxy);
  } catch {
    return false;
  }
}

/**
 * List variants from config
 */
export function listVariantsFromConfig(): Record<string, VariantConfig> {
  try {
    if (isUnifiedMode()) {
      const unifiedConfig = loadOrCreateUnifiedConfig();
      const variants = unifiedConfig.cliproxy?.variants || {};
      const result: Record<string, VariantConfig> = {};
      for (const name of Object.keys(variants)) {
        const v = variants[name];
        result[name] = { provider: v.provider, settings: v.settings, account: v.account };
      }
      return result;
    }

    const config = loadConfig();
    const variants = config.cliproxy || {};
    const result: Record<string, VariantConfig> = {};
    for (const name of Object.keys(variants)) {
      const v = variants[name] as { provider: string; settings: string; account?: string };
      result[name] = { provider: v.provider, settings: v.settings, account: v.account };
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Save variant to unified config
 */
export function saveVariantUnified(
  name: string,
  provider: CLIProxyProvider,
  settingsPath: string,
  account?: string
): void {
  const config = loadOrCreateUnifiedConfig();

  if (!config.cliproxy) {
    config.cliproxy = {
      oauth_accounts: {},
      providers: ['gemini', 'codex', 'agy', 'qwen', 'iflow', 'kiro', 'ghcp'],
      variants: {},
    };
  }
  if (!config.cliproxy.variants) {
    config.cliproxy.variants = {};
  }

  config.cliproxy.variants[name] = {
    provider,
    account,
    settings: settingsPath,
  };

  saveUnifiedConfig(config);
}

/**
 * Save variant to legacy JSON config
 */
export function saveVariantLegacy(
  name: string,
  provider: string,
  settingsPath: string,
  account?: string
): void {
  const configPath = getConfigPath();

  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = { profiles: {} };
  }

  if (!config.cliproxy) {
    config.cliproxy = {};
  }

  const variantConfig: { provider: string; settings: string; account?: string } = {
    provider,
    settings: settingsPath,
  };
  if (account) {
    variantConfig.account = account;
  }
  config.cliproxy[name] = variantConfig;

  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);
}

/**
 * Remove variant from unified config
 */
export function removeVariantFromUnifiedConfig(name: string): VariantConfig | null {
  const config = loadOrCreateUnifiedConfig();

  if (!config.cliproxy?.variants || !(name in config.cliproxy.variants)) {
    return null;
  }

  const variant = config.cliproxy.variants[name];
  delete config.cliproxy.variants[name];
  saveUnifiedConfig(config);

  return { provider: variant.provider, settings: variant.settings };
}

/**
 * Remove variant from legacy JSON config
 */
export function removeVariantFromLegacyConfig(name: string): VariantConfig | null {
  const configPath = getConfigPath();

  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }

  if (!config.cliproxy || !(name in config.cliproxy)) {
    return null;
  }

  const variant = config.cliproxy[name] as { provider: string; settings: string };
  delete config.cliproxy[name];

  if (Object.keys(config.cliproxy).length === 0) {
    delete config.cliproxy;
  }

  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);

  return variant;
}
