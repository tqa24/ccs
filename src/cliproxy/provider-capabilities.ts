import type { CLIProxyProvider } from './types';

export type OAuthFlowType = 'authorization_code' | 'device_code';
export type TokenRefreshOwnership = 'ccs' | 'cliproxy' | 'unsupported';

export interface ProviderCapabilities {
  displayName: string;
  description: string;
  oauthFlow: OAuthFlowType;
  callbackPort: number | null;
  /** Provider name expected by CLIProxyAPI callback endpoint payload. */
  callbackProviderName: string;
  /** Provider name prefix used by CLIProxyAPI auth URL endpoint. */
  authUrlProviderName: string;
  /** Who owns token refresh logic for this provider. */
  refreshOwnership: TokenRefreshOwnership;
  /** Filename prefixes used to identify auth tokens for this provider. */
  authFilePrefixes: readonly string[];
  /** Token JSON "type" values accepted for this provider. */
  tokenTypeValues: readonly string[];
  /**
   * Alternative provider names used by CLIProxyAPI or stats endpoints.
   * These aliases normalize external names to canonical CCS provider IDs.
   */
  aliases: readonly string[];
}

export const PROVIDER_CAPABILITIES: Record<CLIProxyProvider, ProviderCapabilities> = {
  gemini: {
    displayName: 'Google Gemini',
    description: 'Gemini Pro/Flash models',
    oauthFlow: 'authorization_code',
    callbackPort: 8085,
    callbackProviderName: 'gemini',
    authUrlProviderName: 'gemini-cli',
    refreshOwnership: 'ccs',
    authFilePrefixes: ['gemini-', 'google-'],
    tokenTypeValues: ['gemini'],
    aliases: ['gemini-cli'],
  },
  codex: {
    displayName: 'OpenAI Codex',
    description: 'GPT-4 and codex models',
    oauthFlow: 'authorization_code',
    callbackPort: 1455,
    callbackProviderName: 'codex',
    authUrlProviderName: 'codex',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['codex-', 'openai-'],
    tokenTypeValues: ['codex'],
    aliases: [],
  },
  agy: {
    displayName: 'Antigravity',
    description: 'Antigravity AI models',
    oauthFlow: 'authorization_code',
    callbackPort: 51121,
    callbackProviderName: 'antigravity',
    authUrlProviderName: 'antigravity',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['antigravity-', 'agy-'],
    tokenTypeValues: ['antigravity'],
    aliases: ['antigravity'],
  },
  qwen: {
    displayName: 'Alibaba Qwen',
    description: 'Qwen Code models',
    oauthFlow: 'device_code',
    callbackPort: null,
    callbackProviderName: 'qwen',
    authUrlProviderName: 'qwen',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['qwen-'],
    tokenTypeValues: ['qwen'],
    aliases: [],
  },
  iflow: {
    displayName: 'iFlow',
    description: 'iFlow AI models',
    oauthFlow: 'authorization_code',
    callbackPort: 11451,
    callbackProviderName: 'iflow',
    authUrlProviderName: 'iflow',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['iflow-'],
    tokenTypeValues: ['iflow'],
    aliases: [],
  },
  kiro: {
    displayName: 'Kiro (AWS)',
    description: 'AWS CodeWhisperer models',
    oauthFlow: 'device_code',
    callbackPort: null,
    callbackProviderName: 'kiro',
    authUrlProviderName: 'kiro',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['kiro-', 'aws-', 'codewhisperer-'],
    tokenTypeValues: ['kiro', 'codewhisperer'],
    aliases: ['codewhisperer'],
  },
  ghcp: {
    displayName: 'GitHub Copilot (OAuth)',
    description: 'GitHub Copilot via OAuth',
    oauthFlow: 'device_code',
    callbackPort: null,
    callbackProviderName: 'copilot',
    authUrlProviderName: 'github',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['github-copilot-', 'copilot-', 'gh-'],
    tokenTypeValues: ['github-copilot', 'copilot'],
    aliases: ['github-copilot', 'copilot'],
  },
  claude: {
    displayName: 'Claude (Anthropic)',
    description: 'Claude Opus/Sonnet models',
    oauthFlow: 'authorization_code',
    callbackPort: 54545,
    callbackProviderName: 'anthropic',
    authUrlProviderName: 'anthropic',
    refreshOwnership: 'unsupported',
    authFilePrefixes: ['claude-', 'anthropic-'],
    tokenTypeValues: ['claude', 'anthropic'],
    aliases: ['anthropic'],
  },
  kimi: {
    displayName: 'Kimi (Moonshot)',
    description: 'Moonshot AI K2/K2.5 models',
    oauthFlow: 'device_code',
    callbackPort: null,
    callbackProviderName: 'kimi',
    authUrlProviderName: 'kimi',
    refreshOwnership: 'cliproxy',
    authFilePrefixes: ['kimi-'],
    tokenTypeValues: ['kimi'],
    aliases: ['moonshot'],
  },
};

export const CLIPROXY_PROVIDER_IDS = Object.freeze(
  Object.keys(PROVIDER_CAPABILITIES) as CLIProxyProvider[]
);

export function buildProviderMap<T>(
  valueFor: (provider: CLIProxyProvider) => T
): Record<CLIProxyProvider, T> {
  return CLIPROXY_PROVIDER_IDS.reduce(
    (acc, provider) => {
      acc[provider] = valueFor(provider);
      return acc;
    },
    {} as Record<CLIProxyProvider, T>
  );
}

const PROVIDER_ID_SET = new Set(CLIPROXY_PROVIDER_IDS);

const PROVIDER_ALIAS_MAP: ReadonlyMap<string, CLIProxyProvider> = (() => {
  const entries: Array<[string, CLIProxyProvider]> = [];
  for (const provider of CLIPROXY_PROVIDER_IDS) {
    entries.push([provider, provider]);
    for (const alias of PROVIDER_CAPABILITIES[provider].aliases) {
      entries.push([alias.toLowerCase(), provider]);
    }
  }
  return new Map(entries);
})();

export function isCLIProxyProvider(provider: string): provider is CLIProxyProvider {
  return PROVIDER_ID_SET.has(provider as CLIProxyProvider);
}

export function getProviderCapabilities(provider: CLIProxyProvider): ProviderCapabilities {
  return PROVIDER_CAPABILITIES[provider];
}

export function getProviderDisplayName(provider: CLIProxyProvider): string {
  return PROVIDER_CAPABILITIES[provider].displayName;
}

export function getProviderDescription(provider: CLIProxyProvider): string {
  return PROVIDER_CAPABILITIES[provider].description;
}

export function getProvidersByOAuthFlow(flowType: OAuthFlowType): CLIProxyProvider[] {
  return CLIPROXY_PROVIDER_IDS.filter(
    (provider) => PROVIDER_CAPABILITIES[provider].oauthFlow === flowType
  );
}

export function getOAuthFlowType(provider: CLIProxyProvider): OAuthFlowType {
  return PROVIDER_CAPABILITIES[provider].oauthFlow;
}

export function getOAuthCallbackPort(provider: CLIProxyProvider): number | null {
  return PROVIDER_CAPABILITIES[provider].callbackPort;
}

export function getCLIProxyCallbackProviderName(provider: CLIProxyProvider): string {
  return PROVIDER_CAPABILITIES[provider].callbackProviderName;
}

export function getCLIProxyAuthUrlProviderName(provider: CLIProxyProvider): string {
  return PROVIDER_CAPABILITIES[provider].authUrlProviderName;
}

export function getTokenRefreshOwnership(provider: CLIProxyProvider): TokenRefreshOwnership {
  return PROVIDER_CAPABILITIES[provider].refreshOwnership;
}

export function isRefreshDelegatedToCLIProxy(provider: CLIProxyProvider): boolean {
  return PROVIDER_CAPABILITIES[provider].refreshOwnership === 'cliproxy';
}

export function getProviderAuthFilePrefixes(provider: CLIProxyProvider): readonly string[] {
  return PROVIDER_CAPABILITIES[provider].authFilePrefixes;
}

export function getProviderTokenTypeValues(provider: CLIProxyProvider): readonly string[] {
  return PROVIDER_CAPABILITIES[provider].tokenTypeValues;
}

export function mapExternalProviderName(providerName: string): CLIProxyProvider | null {
  const normalized = providerName.toLowerCase();
  return PROVIDER_ALIAS_MAP.get(normalized) ?? null;
}
