/**
 * Provider Configuration
 * Shared constants for CLIProxy providers - SINGLE SOURCE OF TRUTH for UI
 *
 * When adding a new provider, update CLIPROXY_PROVIDERS array and related mappings.
 */

/**
 * Canonical list of CLIProxy provider IDs
 * This is the UI's single source of truth for valid providers.
 * Must stay in sync with backend's CLIPROXY_PROFILES in src/auth/profile-detector.ts
 */
export const CLIPROXY_PROVIDERS = [
  'gemini',
  'codex',
  'agy',
  'qwen',
  'iflow',
  'kiro',
  'ghcp',
  'claude',
  'kimi',
] as const;

/** Union type for CLIProxy provider IDs */
export type CLIProxyProvider = (typeof CLIPROXY_PROVIDERS)[number];

/** Check if a string is a valid CLIProxy provider */
export function isValidProvider(provider: string): provider is CLIProxyProvider {
  return CLIPROXY_PROVIDERS.includes(provider as CLIProxyProvider);
}

interface ProviderMetadata {
  displayName: string;
  description: string;
}

export const PROVIDER_METADATA: Record<CLIProxyProvider, ProviderMetadata> = {
  agy: {
    displayName: 'Antigravity',
    description: 'Antigravity AI models',
  },
  claude: {
    displayName: 'Claude (Anthropic)',
    description: 'Claude Opus/Sonnet models',
  },
  gemini: {
    displayName: 'Google Gemini',
    description: 'Gemini Pro/Flash models',
  },
  codex: {
    displayName: 'OpenAI Codex',
    description: 'GPT-4 and codex models',
  },
  qwen: {
    displayName: 'Alibaba Qwen',
    description: 'Qwen Code models',
  },
  iflow: {
    displayName: 'iFlow',
    description: 'iFlow AI models',
  },
  kiro: {
    displayName: 'Kiro (AWS)',
    description: 'AWS CodeWhisperer models',
  },
  ghcp: {
    displayName: 'GitHub Copilot (OAuth)',
    description: 'GitHub Copilot via OAuth',
  },
  kimi: {
    displayName: 'Kimi (Moonshot)',
    description: 'Moonshot AI K2/K2.5 models',
  },
};

// Map provider names to asset filenames (only providers with actual logos)
export const PROVIDER_ASSETS: Record<string, string> = {
  gemini: '/assets/providers/gemini-color.svg',
  agy: '/assets/providers/agy.png',
  codex: '/assets/providers/openai.svg',
  qwen: '/assets/providers/qwen-color.svg',
  iflow: '/assets/providers/iflow.png',
  kiro: '/assets/providers/kiro.png',
  ghcp: '/assets/providers/copilot.svg',
  claude: '/assets/providers/claude.svg',
  kimi: '/assets/providers/kimi.svg',
};

// Provider brand colors
export const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  agy: '#f3722c',
  codex: '#10a37f',
  vertex: '#4285F4',
  iflow: '#f94144',
  qwen: '#6236FF',
  kiro: '#4d908e', // Dark Cyan (AWS-inspired)
  ghcp: '#43aa8b', // Seaweed (GitHub-inspired)
  claude: '#D97757', // Anthropic brand color (matches SVG)
  kimi: '#FF6B35', // Moonshot AI brand orange
};

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  ...Object.fromEntries(
    CLIPROXY_PROVIDERS.map((provider) => [provider, PROVIDER_METADATA[provider].displayName])
  ),
  vertex: 'Vertex AI',
};

// Map provider to display name
export function getProviderDisplayName(provider: string): string {
  return PROVIDER_NAMES[provider.toLowerCase()] || provider;
}

/** Map provider to user-facing short description */
export function getProviderDescription(provider: string): string {
  const normalized = provider.toLowerCase();
  if (!isValidProvider(normalized)) return '';
  return PROVIDER_METADATA[normalized].description;
}

/**
 * Providers that use Device Code OAuth flow instead of Authorization Code flow.
 * Device Code flow requires displaying a user code for manual entry at provider's website.
 */
export const DEVICE_CODE_PROVIDERS: CLIProxyProvider[] = ['ghcp', 'kiro', 'qwen', 'kimi'];

/** Check if provider uses Device Code flow */
export function isDeviceCodeProvider(provider: string): boolean {
  return DEVICE_CODE_PROVIDERS.includes(provider as CLIProxyProvider);
}

/** Providers that require nickname because token payload may not include email. */
export const NICKNAME_REQUIRED_PROVIDERS: CLIProxyProvider[] = ['ghcp', 'kiro'];

/** Check if provider requires user-supplied nickname in auth flow */
export function isNicknameRequiredProvider(provider: string): boolean {
  return NICKNAME_REQUIRED_PROVIDERS.includes(provider as CLIProxyProvider);
}

/** Kiro auth methods exposed in CCS UI (aligned with CLIProxyAPIPlus support). */
export const KIRO_AUTH_METHODS = ['aws', 'aws-authcode', 'google', 'github'] as const;
export type KiroAuthMethod = (typeof KIRO_AUTH_METHODS)[number];

export type KiroFlowType = 'authorization_code' | 'device_code';
export type KiroStartEndpoint = 'start' | 'start-url';

export interface KiroAuthMethodOption {
  id: KiroAuthMethod;
  label: string;
  description: string;
  flowType: KiroFlowType;
  startEndpoint: KiroStartEndpoint;
}

/** UX-first default for issue #233: AWS Builder ID device flow. */
export const DEFAULT_KIRO_AUTH_METHOD: KiroAuthMethod = 'aws';

export const KIRO_AUTH_METHOD_OPTIONS: readonly KiroAuthMethodOption[] = [
  {
    id: 'aws',
    label: 'AWS Builder ID (Recommended)',
    description: 'Device code flow for AWS organizations and Builder ID accounts.',
    flowType: 'device_code',
    startEndpoint: 'start',
  },
  {
    id: 'aws-authcode',
    label: 'AWS Builder ID (Auth Code)',
    description: 'Authorization code flow via CLI binary.',
    flowType: 'authorization_code',
    startEndpoint: 'start',
  },
  {
    id: 'google',
    label: 'Google OAuth',
    description: 'Social OAuth flow with callback URL support.',
    flowType: 'authorization_code',
    startEndpoint: 'start-url',
  },
  {
    id: 'github',
    label: 'GitHub OAuth',
    description: 'Social OAuth flow via management API callback.',
    flowType: 'authorization_code',
    startEndpoint: 'start-url',
  },
];

export function isKiroAuthMethod(value: string): value is KiroAuthMethod {
  return KIRO_AUTH_METHODS.includes(value as KiroAuthMethod);
}

export function normalizeKiroAuthMethod(value?: string): KiroAuthMethod {
  if (!value) return DEFAULT_KIRO_AUTH_METHOD;
  const normalized = value.trim().toLowerCase();
  return isKiroAuthMethod(normalized) ? normalized : DEFAULT_KIRO_AUTH_METHOD;
}

export function getKiroAuthMethodOption(method: KiroAuthMethod): KiroAuthMethodOption {
  const option = KIRO_AUTH_METHOD_OPTIONS.find((candidate) => candidate.id === method);
  return option || KIRO_AUTH_METHOD_OPTIONS[0];
}
