/**
 * Proxy Target Resolver
 *
 * Determines whether CLIProxyAPI requests should go to local or remote
 * based on unified config. Used by stats-fetcher, auth-routes, and UI.
 */

import { loadOrCreateUnifiedConfig } from '../config/unified-config-loader';
import type { CliproxyServerConfig } from '../config/unified-config-types';

/** Default CLIProxyAPI port */
const DEFAULT_CLIPROXY_PORT = 8317;

/** Resolved proxy target for making requests */
export interface ProxyTarget {
  /** Target hostname or IP */
  host: string;
  /** Target port */
  port: number;
  /** Protocol (http/https) */
  protocol: 'http' | 'https';
  /** Optional auth token - only send header if defined and non-empty */
  authToken?: string;
  /** True if targeting remote server, false if local */
  isRemote: boolean;
}

/**
 * Load cliproxy_server configuration from unified config.
 * Returns undefined if not configured.
 */
function loadCliproxyServerConfig(): CliproxyServerConfig | undefined {
  const config = loadOrCreateUnifiedConfig();
  return config.cliproxy_server;
}

/**
 * Get the current CLIProxyAPI target based on unified config.
 * Returns remote server config if enabled, otherwise localhost.
 */
export function getProxyTarget(): ProxyTarget {
  const config = loadCliproxyServerConfig();

  if (config?.remote?.enabled && config.remote?.host) {
    return {
      host: config.remote.host,
      port: config.remote.port ?? DEFAULT_CLIPROXY_PORT,
      protocol: config.remote.protocol ?? 'http',
      authToken: config.remote.auth_token || undefined, // Empty string -> undefined
      isRemote: true,
    };
  }

  return {
    host: '127.0.0.1',
    port: config?.local?.port ?? DEFAULT_CLIPROXY_PORT,
    protocol: 'http',
    isRemote: false,
  };
}

/**
 * Build URL for proxy endpoint
 * @param target Resolved proxy target
 * @param path Endpoint path (e.g., '/v0/management/usage')
 */
export function buildProxyUrl(target: ProxyTarget, path: string): string {
  return `${target.protocol}://${target.host}:${target.port}${path}`;
}

/**
 * Build request headers for proxy requests
 * Handles optional auth token - only adds Authorization header if token is set.
 *
 * @param target Resolved proxy target
 * @param additionalHeaders Extra headers to merge
 */
export function buildProxyHeaders(
  target: ProxyTarget,
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...additionalHeaders,
  };

  // Only add auth header if token is configured
  if (target.authToken) {
    headers['Authorization'] = `Bearer ${target.authToken}`;
  }

  return headers;
}
