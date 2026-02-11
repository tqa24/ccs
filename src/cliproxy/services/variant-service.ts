/**
 * CLIProxy Variant Service
 *
 * Handles CRUD operations for CLIProxy variant profiles.
 * Supports both unified config (config.yaml) and legacy JSON format.
 */

import * as os from 'os';
import * as path from 'path';
import { CLIProxyProfileName } from '../../auth/profile-detector';
import { CLIProxyProvider, CLIProxyBackend, PLUS_ONLY_PROVIDERS } from '../types';
import { CompositeTierConfig, CompositeVariantConfig } from '../../config/unified-config-types';
import { isReservedName, isWindowsReservedName } from '../../config/reserved-names';
import { loadOrCreateUnifiedConfig } from '../../config/unified-config-loader';
import { DEFAULT_BACKEND } from '../platform-detector';
import { isUnifiedMode } from '../../config/unified-config-loader';
import { deleteConfigForPort } from '../config-generator';
import { deleteSessionLockForPort } from '../session-tracker';
import { warn } from '../../utils/ui';
import {
  createSettingsFile,
  createSettingsFileUnified,
  createCompositeSettingsFile,
  deleteSettingsFile,
  getRelativeSettingsPath,
  getCompositeRelativeSettingsPath,
  updateSettingsModel,
} from './variant-settings';
import {
  VariantConfig,
  variantExistsInConfig,
  listVariantsFromConfig,
  saveVariantUnified,
  saveVariantLegacy,
  saveCompositeVariantUnified,
  removeVariantFromUnifiedConfig,
  removeVariantFromLegacyConfig,
  getNextAvailablePort,
} from './variant-config-adapter';

// Re-export VariantConfig from adapter
export type { VariantConfig } from './variant-config-adapter';

/** Result of variant operations */
export interface VariantOperationResult {
  success: boolean;
  error?: string;
  variant?: VariantConfig;
  settingsPath?: string;
}

/**
 * Validate CLIProxy profile name
 */
export function validateProfileName(name: string): string | null {
  if (!name) {
    return 'Profile name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
    return 'Name must start with letter, contain only letters, numbers, dot, dash, underscore';
  }
  if (name.length > 32) {
    return 'Name must be 32 characters or less';
  }
  if (isReservedName(name)) {
    return `'${name}' is a reserved name`;
  }
  if (isWindowsReservedName(name)) {
    return `'${name}' is a Windows reserved device name and cannot be used`;
  }
  return null;
}

/**
 * Validate provider/backend compatibility
 * Returns error message if provider requires Plus backend but original is configured
 */
export function validateProviderBackend(provider: CLIProxyProfileName): string | null {
  const config = loadOrCreateUnifiedConfig();
  const backend: CLIProxyBackend = config.cliproxy?.backend ?? DEFAULT_BACKEND;

  // Normalize provider to lowercase for case-insensitive comparison
  const normalizedProvider = provider.toLowerCase() as CLIProxyProvider;
  if (backend === 'original' && PLUS_ONLY_PROVIDERS.includes(normalizedProvider)) {
    return `${provider} requires CLIProxyAPIPlus. Set \`cliproxy.backend: plus\` in config.yaml or use --backend=plus`;
  }
  return null;
}

/**
 * Check if CLIProxy variant profile exists
 */
export function variantExists(name: string): boolean {
  return variantExistsInConfig(name);
}

/**
 * List all CLIProxy variants
 */
export function listVariants(): Record<string, VariantConfig> {
  return listVariantsFromConfig();
}

/**
 * Create a new CLIProxy variant
 */
export function createVariant(
  name: string,
  provider: CLIProxyProfileName,
  model: string,
  account?: string
): VariantOperationResult {
  try {
    // Validate provider/backend compatibility (block kiro/ghcp on original backend)
    const backendError = validateProviderBackend(provider);
    if (backendError) {
      return { success: false, error: backendError };
    }

    // Allocate unique port for this variant
    const port = getNextAvailablePort();

    let settingsPath: string;

    if (isUnifiedMode()) {
      settingsPath = createSettingsFileUnified(name, provider, model, port);
      saveVariantUnified(
        name,
        provider as CLIProxyProvider,
        getRelativeSettingsPath(provider, name),
        account,
        port
      );
    } else {
      settingsPath = createSettingsFile(name, provider, model, port);
      saveVariantLegacy(name, provider, `~/.ccs/${path.basename(settingsPath)}`, account, port);
    }

    return {
      success: true,
      settingsPath,
      variant: { provider, model, account, port },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Remove a CLIProxy variant
 */
export function removeVariant(name: string): VariantOperationResult {
  try {
    let variant: VariantConfig | null;

    if (isUnifiedMode()) {
      const unifiedVariant = removeVariantFromUnifiedConfig(name);
      if (unifiedVariant?.settings) {
        deleteSettingsFile(unifiedVariant.settings);
      }
      // Clean up port-specific config and session files
      if (unifiedVariant?.port) {
        deleteConfigForPort(unifiedVariant.port);
        deleteSessionLockForPort(unifiedVariant.port);
      }
      variant = unifiedVariant;
    } else {
      variant = removeVariantFromLegacyConfig(name);
      if (variant?.settings) {
        deleteSettingsFile(variant.settings);
      }
      // Clean up port-specific config and session files
      if (variant?.port) {
        deleteConfigForPort(variant.port);
        deleteSessionLockForPort(variant.port);
      }
    }

    if (!variant) {
      return { success: false, error: `Variant '${name}' not found` };
    }

    return { success: true, variant };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Update options for variant */
export interface UpdateVariantOptions {
  provider?: CLIProxyProfileName;
  account?: string;
  model?: string;
}

/**
 * Update an existing CLIProxy variant
 */
export function updateVariant(name: string, updates: UpdateVariantOptions): VariantOperationResult {
  try {
    const variants = listVariantsFromConfig();
    const existing = variants[name];

    if (!existing) {
      return { success: false, error: `Variant '${name}' not found` };
    }

    if (existing.type === 'composite') {
      console.log(
        warn(
          'Cannot update composite variant properties directly. Remove and recreate, or edit config.yaml.'
        )
      );
      return { success: false, error: 'Composite variant update not supported' };
    }

    // Update model in settings file if provided
    if (updates.model !== undefined && existing.settings) {
      const settingsPath = existing.settings.replace(/^~/, os.homedir());
      updateSettingsModel(settingsPath, updates.model);
    }

    // Update config entry if provider or account changed
    if (updates.provider !== undefined || updates.account !== undefined) {
      const newProvider = updates.provider ?? existing.provider;

      // Validate provider/backend compatibility on provider change
      if (updates.provider !== undefined) {
        const backendError = validateProviderBackend(updates.provider);
        if (backendError) {
          return { success: false, error: backendError };
        }
      }
      const newAccount = updates.account !== undefined ? updates.account : existing.account;

      if (isUnifiedMode()) {
        saveVariantUnified(
          name,
          newProvider as CLIProxyProvider,
          existing.settings || '',
          newAccount || undefined,
          existing.port
        );
      } else {
        saveVariantLegacy(
          name,
          newProvider,
          existing.settings || '',
          newAccount || undefined,
          existing.port
        );
      }
    }

    return {
      success: true,
      variant: {
        provider: updates.provider ?? existing.provider,
        model: updates.model ?? existing.model,
        account: updates.account !== undefined ? updates.account : existing.account,
        port: existing.port,
        settings: existing.settings,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Composite variant creation options */
export interface CreateCompositeVariantOptions {
  name: string;
  defaultTier: 'opus' | 'sonnet' | 'haiku';
  tiers: {
    opus: CompositeTierConfig;
    sonnet: CompositeTierConfig;
    haiku: CompositeTierConfig;
  };
}

/**
 * Create a new composite CLIProxy variant.
 * Mixes different providers per tier using CLIProxyAPI root endpoints.
 */
export function createCompositeVariant(
  options: CreateCompositeVariantOptions
): VariantOperationResult {
  if (!isUnifiedMode()) {
    throw new Error(
      'Composite variants require unified config (config.yaml). Run "ccs migrate" first.'
    );
  }

  try {
    const { name, defaultTier, tiers } = options;

    // Validate all tier providers against backend compatibility
    const tierNames: Array<'opus' | 'sonnet' | 'haiku'> = ['opus', 'sonnet', 'haiku'];
    for (const tier of tierNames) {
      const backendError = validateProviderBackend(tiers[tier].provider);
      if (backendError) {
        return { success: false, error: `${tier} tier: ${backendError}` };
      }
    }

    // Allocate unique port for this composite variant
    const port = getNextAvailablePort();

    // Create settings file with root URL + per-tier models
    const settingsPath = createCompositeSettingsFile(name, tiers, defaultTier, port);

    // Save composite config to unified config
    const compositeConfig: CompositeVariantConfig = {
      type: 'composite',
      default_tier: defaultTier,
      tiers,
      settings: getCompositeRelativeSettingsPath(name),
      port,
    };
    saveCompositeVariantUnified(name, compositeConfig);

    return {
      success: true,
      settingsPath,
      variant: {
        provider: tiers[defaultTier].provider,
        type: 'composite',
        default_tier: defaultTier,
        tiers,
        port,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Update options for composite variant */
export interface UpdateCompositeVariantOptions {
  defaultTier?: 'opus' | 'sonnet' | 'haiku';
  tiers?: Partial<Record<'opus' | 'sonnet' | 'haiku', CompositeTierConfig>>;
}

/**
 * Update an existing composite CLIProxy variant.
 * Merges changes with existing config and regenerates settings file.
 */
export function updateCompositeVariant(
  name: string,
  updates: UpdateCompositeVariantOptions
): VariantOperationResult {
  if (!isUnifiedMode()) {
    throw new Error('Composite variants require unified config (config.yaml).');
  }

  try {
    const variants = listVariantsFromConfig();
    const existing = variants[name];

    if (!existing) {
      return { success: false, error: `Variant '${name}' not found` };
    }

    if (existing.type !== 'composite' || !existing.tiers) {
      return { success: false, error: `Variant '${name}' is not a composite variant` };
    }

    // Merge tiers (keep unchanged tiers from existing)
    const mergedTiers = {
      opus: updates.tiers?.opus ?? existing.tiers.opus,
      sonnet: updates.tiers?.sonnet ?? existing.tiers.sonnet,
      haiku: updates.tiers?.haiku ?? existing.tiers.haiku,
    };

    // Validate all tier providers against backend compatibility
    const tierNames: Array<'opus' | 'sonnet' | 'haiku'> = ['opus', 'sonnet', 'haiku'];
    for (const tier of tierNames) {
      const backendError = validateProviderBackend(mergedTiers[tier].provider);
      if (backendError) {
        return { success: false, error: `${tier} tier: ${backendError}` };
      }
    }

    const newDefaultTier = updates.defaultTier ?? existing.default_tier ?? 'sonnet';

    // Delete old settings file
    if (existing.settings) {
      deleteSettingsFile(existing.settings);
    }

    // Create new settings file with updated config
    const settingsPath = createCompositeSettingsFile(
      name,
      mergedTiers,
      newDefaultTier,
      existing.port
    );

    // Save updated composite config to unified config
    const compositeConfig: CompositeVariantConfig = {
      type: 'composite',
      default_tier: newDefaultTier,
      tiers: mergedTiers,
      settings: getCompositeRelativeSettingsPath(name),
      port: existing.port,
    };
    saveCompositeVariantUnified(name, compositeConfig);

    return {
      success: true,
      settingsPath,
      variant: {
        provider: mergedTiers[newDefaultTier].provider,
        type: 'composite',
        default_tier: newDefaultTier,
        tiers: mergedTiers,
        port: existing.port,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
