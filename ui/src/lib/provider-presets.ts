/**
 * Provider Presets Configuration
 * Shared catalog from backend source-of-truth with UI-only presentation overrides.
 */

import {
  OPENROUTER_BASE_URL,
  createProviderPresetDefinitions,
  normalizeProviderPresetId,
  type PresetCategory,
  type ProviderPresetDefinition,
  type ProviderPresetId,
} from '../../../src/shared/provider-preset-catalog';

export { OPENROUTER_BASE_URL };
export type { PresetCategory };

export type ProviderPreset = ProviderPresetDefinition;

/**
 * UI-only overrides for presentation details that differ from CLI semantics.
 * Keep this tiny; provider data itself belongs in shared catalog.
 */
type UiPresetOverride = Pick<ProviderPreset, 'apiKeyPlaceholder'>;

const UI_PRESET_OVERRIDES = Object.freeze({
  ollama: {
    apiKeyPlaceholder: '',
  },
}) satisfies Readonly<Partial<Record<ProviderPresetId, UiPresetOverride>>>;

function withUiOverrides(preset: ProviderPresetDefinition): ProviderPreset {
  const overrides = UI_PRESET_OVERRIDES[preset.id];
  return overrides ? { ...preset, ...overrides } : { ...preset };
}

const BASE_PROVIDER_PRESETS = createProviderPresetDefinitions();

export const PROVIDER_PRESETS: readonly ProviderPreset[] = Object.freeze(
  BASE_PROVIDER_PRESETS.map(withUiOverrides)
);

/** Get presets by category */
export function getPresetsByCategory(category: PresetCategory): ProviderPreset[] {
  return PROVIDER_PRESETS.filter((preset) => preset.category === category);
}

/** Get preset by ID (supports legacy aliases via shared alias map). */
export function getPresetById(id: string): ProviderPreset | undefined {
  const canonical = normalizeProviderPresetId(id);
  return PROVIDER_PRESETS.find((preset) => preset.id === canonical);
}

/** Check if a URL matches a known preset */
export function detectPresetFromUrl(baseUrl: string): ProviderPreset | undefined {
  const normalizedInput = baseUrl.trim().toLowerCase().replace(/\/+$/, '');
  if (!normalizedInput) {
    return undefined;
  }

  return PROVIDER_PRESETS.find((preset) => {
    const normalizedPresetUrl = preset.baseUrl.trim().toLowerCase().replace(/\/+$/, '');
    if (!normalizedPresetUrl) {
      return false;
    }
    return (
      normalizedInput === normalizedPresetUrl ||
      normalizedInput.startsWith(`${normalizedPresetUrl}/`)
    );
  });
}
