/**
 * Provider Configuration
 * Shared constants for provider branding and assets
 */

// Map provider names to asset filenames (only providers with actual logos)
export const PROVIDER_ASSETS: Record<string, string> = {
  gemini: '/assets/providers/gemini-color.svg',
  agy: '/assets/providers/agy.png',
  codex: '/assets/providers/openai.svg',
  qwen: '/assets/providers/qwen-color.svg',
};

// Provider brand colors
export const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  agy: '#f3722c',
  codex: '#10a37f',
  vertex: '#4285F4',
  iflow: '#f94144',
  qwen: '#6236FF',
};

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Gemini',
  agy: 'Antigravity',
  codex: 'Codex',
  vertex: 'Vertex AI',
  iflow: 'iFlow',
  qwen: 'Qwen',
};

// Map provider to display name
export function getProviderDisplayName(provider: string): string {
  return PROVIDER_NAMES[provider.toLowerCase()] || provider;
}
