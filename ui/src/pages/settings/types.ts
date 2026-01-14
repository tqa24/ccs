/**
 * Settings Page Types
 * Type definitions for WebSearch, GlobalEnv, and Proxy configurations
 */

import type { CliproxyServerConfig, RemoteProxyStatus } from '@/lib/api-client';

// === WebSearch Types ===

export interface ProviderConfig {
  enabled?: boolean;
  model?: string;
  timeout?: number;
}

export interface WebSearchProvidersConfig {
  gemini?: ProviderConfig;
  grok?: ProviderConfig;
  opencode?: ProviderConfig;
}

export interface WebSearchConfig {
  enabled: boolean;
  providers?: WebSearchProvidersConfig;
}

export interface CliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface WebSearchStatus {
  geminiCli: CliStatus;
  grokCli: CliStatus;
  opencodeCli: CliStatus;
  readiness: {
    status: 'ready' | 'unavailable';
    message: string;
  };
}

// === GlobalEnv Types ===

export interface GlobalEnvConfig {
  enabled: boolean;
  env: Record<string, string>;
}

// === Tab Types ===

export type SettingsTab = 'websearch' | 'globalenv' | 'proxy' | 'auth' | 'backups';

// === Re-exports from api-client ===

export type { CliproxyServerConfig, RemoteProxyStatus };
