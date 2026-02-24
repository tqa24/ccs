/**
 * Proxy Section
 * Settings section for CLIProxyAPI configuration (local/remote)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Cloud,
  Bug,
  Box,
  AlertTriangle,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { useProxyConfig, useRawConfig } from '../../hooks';
import { useUpdateBackend, useProxyStatus } from '@/hooks/use-cliproxy';
import { LocalProxyCard } from './local-proxy-card';
import { RemoteProxyCard } from './remote-proxy-card';
import { ProxyStatusWidget } from '@/components/monitoring/proxy-status-widget';
import { api } from '@/lib/api-client';
import { CLIPROXY_DEFAULT_PORT } from '@/lib/preset-utils';
import { RISK_ACK_PHRASE } from '@/components/account/antigravity-responsibility-constants';
import { toast } from 'sonner';

/** LocalStorage key for debug mode preference */
const DEBUG_MODE_KEY = 'ccs_debug_mode';

/** Providers only available on CLIProxyAPIPlus */
const PLUS_ONLY_PROVIDERS = ['kiro', 'ghcp'];

function normalizeRiskAckPhrase(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export default function ProxySection() {
  const {
    config,
    loading,
    saving,
    error,
    success,
    testResult,
    testing,
    editedHost,
    setEditedHost,
    editedPort,
    setEditedPort,
    editedAuthToken,
    setEditedAuthToken,
    editedManagementKey,
    setEditedManagementKey,
    editedLocalPort,
    setEditedLocalPort,
    fetchConfig,
    saveConfig,
    testConnection,
  } = useProxyConfig();

  const { fetchRawConfig } = useRawConfig();

  // Debug mode state (persisted in localStorage)
  const [debugMode, setDebugMode] = useState(() => {
    try {
      return localStorage.getItem(DEBUG_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [agyAckBypass, setAgyAckBypass] = useState(false);
  const [agyAckBypassLoading, setAgyAckBypassLoading] = useState(true);
  const [agyAckBypassSaving, setAgyAckBypassSaving] = useState(false);
  const [showAgyEnableConfirm, setShowAgyEnableConfirm] = useState(false);
  const [agyEnableConfirmPhrase, setAgyEnableConfirmPhrase] = useState('');
  const agyAckBypassSavingRef = useRef(false);
  const isAgyConfirmPhraseValid =
    normalizeRiskAckPhrase(agyEnableConfirmPhrase) === RISK_ACK_PHRASE;

  const handleDebugModeChange = (enabled: boolean) => {
    setDebugMode(enabled);
    try {
      localStorage.setItem(DEBUG_MODE_KEY, String(enabled));
    } catch {
      // Ignore storage errors
    }
  };

  const fetchAgyAckBypass = useCallback(async () => {
    try {
      setAgyAckBypassLoading(true);
      const response = await fetch('/api/settings/auth/antigravity-risk');
      if (!response.ok) {
        throw new Error('Failed to load AGY power user mode');
      }
      const data = (await response.json()) as { antigravityAckBypass?: boolean };
      setAgyAckBypass(data.antigravityAckBypass === true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load AGY power user mode');
      setAgyAckBypass(false);
    } finally {
      setAgyAckBypassLoading(false);
    }
  }, []);

  const persistAgyAckBypass = useCallback(
    async (nextValue: boolean) => {
      if (agyAckBypassSavingRef.current || agyAckBypassSaving || saving) return;

      try {
        agyAckBypassSavingRef.current = true;
        setAgyAckBypassSaving(true);

        const response = await fetch('/api/settings/auth/antigravity-risk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ antigravityAckBypass: nextValue }),
        });

        const payload = (await response.json()) as {
          antigravityAckBypass?: boolean;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to update AGY power user mode');
        }

        const persistedValue = payload.antigravityAckBypass === true;

        const verifyResponse = await fetch('/api/settings/auth/antigravity-risk', {
          cache: 'no-store',
        });
        if (!verifyResponse.ok) {
          throw new Error('Failed to verify AGY power user mode persistence');
        }
        const verifyData = (await verifyResponse.json()) as { antigravityAckBypass?: boolean };
        const verifiedValue = verifyData.antigravityAckBypass === true;
        if (verifiedValue !== nextValue) {
          throw new Error(
            'AGY power user mode was not persisted. Config may have been modified by another process.'
          );
        }

        setAgyAckBypass(verifiedValue && persistedValue);
        setShowAgyEnableConfirm(false);
        setAgyEnableConfirmPhrase('');
        toast.success(nextValue ? 'AGY power user mode enabled.' : 'AGY power user mode disabled.');
        await fetchRawConfig();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update AGY power user mode');
      } finally {
        agyAckBypassSavingRef.current = false;
        setAgyAckBypassSaving(false);
      }
    },
    [agyAckBypassSaving, fetchRawConfig, saving]
  );

  const handleAgyAckBypassChange = useCallback(
    (nextValue: boolean) => {
      if (agyAckBypassSavingRef.current || agyAckBypassSaving || saving) return;

      if (nextValue) {
        setShowAgyEnableConfirm(true);
        return;
      }

      setShowAgyEnableConfirm(false);
      setAgyEnableConfirmPhrase('');
      void persistAgyAckBypass(false);
    },
    [agyAckBypassSaving, persistAgyAckBypass, saving]
  );

  const confirmAgyEnable = useCallback(() => {
    if (!isAgyConfirmPhraseValid) {
      toast.error(`Type "${RISK_ACK_PHRASE}" to continue.`);
      return;
    }
    void persistAgyAckBypass(true);
  }, [isAgyConfirmPhraseValid, persistAgyAckBypass]);

  // Backend state (loaded from API) + mutation hook for proper query invalidation
  const [backend, setBackend] = useState<'original' | 'plus'>('plus');
  const [hasKiroGhcpVariants, setHasKiroGhcpVariants] = useState(false);
  const updateBackendMutation = useUpdateBackend();
  const { data: proxyStatus } = useProxyStatus();
  const isProxyRunning = proxyStatus?.running ?? false;

  // Fetch backend setting
  const fetchBackend = useCallback(async () => {
    try {
      const result = await api.cliproxyServer.getBackend();
      setBackend(result.backend);
    } catch (err) {
      console.error('[Proxy] Failed to fetch backend:', err);
    }
  }, []);

  // Check for Kiro/ghcp variants
  const checkPlusOnlyVariants = useCallback(async () => {
    try {
      const result = await api.cliproxy.list();
      const hasIncompatible = result.variants.some((v) => PLUS_ONLY_PROVIDERS.includes(v.provider));
      setHasKiroGhcpVariants(hasIncompatible);
    } catch (err) {
      console.error('[Proxy] Failed to check variants:', err);
    }
  }, []);

  // Save backend setting using mutation hook (invalidates all related queries)
  const handleBackendChange = (value: 'original' | 'plus') => {
    const previousValue = backend;
    setBackend(value); // Optimistic update
    updateBackendMutation.mutate(
      { backend: value },
      {
        onError: () => {
          setBackend(previousValue); // Rollback on error
        },
      }
    );
  };

  // Log when debug mode changes (sanitize sensitive fields)
  useEffect(() => {
    if (debugMode && config) {
      // Sanitize config before logging to prevent credential exposure
      const sanitizedConfig = {
        ...config,
        remote: {
          ...config.remote,
          auth_token: config.remote.auth_token ? '[REDACTED]' : undefined,
          management_key: config.remote.management_key ? '[REDACTED]' : undefined,
        },
      };
      console.log('[CCS Debug] Debug mode enabled - proxy config:', sanitizedConfig);
    }
  }, [debugMode, config]);

  // Load data on mount
  useEffect(() => {
    fetchConfig();
    void fetchAgyAckBypass();
    fetchRawConfig();

    void fetchBackend();

    void checkPlusOnlyVariants();
  }, [fetchConfig, fetchAgyAckBypass, fetchRawConfig, fetchBackend, checkPlusOnlyVariants]);

  if (loading || !config) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const isRemoteMode = config.remote.enabled ?? false;
  // Only block backend switching in local mode when proxy is running
  const isBackendSwitchBlocked = !isRemoteMode && isProxyRunning;
  const remoteConfig = config.remote;
  const fallbackConfig = config.fallback;

  // Get display values (edited or from config)
  const hostInput = config.remote.host ?? '';
  const portInput = config.remote.port !== undefined ? config.remote.port.toString() : '';
  const authTokenInput = config.remote.auth_token ?? '';
  const managementKeyInput = config.remote.management_key ?? '';
  const localPortInput = (config.local.port ?? CLIPROXY_DEFAULT_PORT).toString();

  const displayHost = editedHost ?? hostInput;
  const displayPort = editedPort ?? portInput;
  const displayAuthToken = editedAuthToken ?? authTokenInput;
  const displayManagementKey = editedManagementKey ?? managementKeyInput;
  const displayLocalPort = editedLocalPort ?? localPortInput;

  // Save functions for blur events
  const saveHost = () => {
    const value = editedHost ?? displayHost;
    if (value !== config.remote.host) {
      saveConfig({ remote: { ...remoteConfig, host: value } });
    }
    setEditedHost(null);
  };

  const savePort = () => {
    const portStr = (editedPort ?? displayPort).trim();
    if (portStr === '') {
      if (config.remote.port !== undefined) {
        saveConfig({ remote: { ...remoteConfig, port: undefined } });
      }
      setEditedPort(null);
      return;
    }

    const parsedPort = Number(portStr);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      toast.error('Port must be an integer between 1 and 65535, or empty for default');
      setEditedPort(null);
      return;
    }

    if (parsedPort !== config.remote.port) {
      saveConfig({ remote: { ...remoteConfig, port: parsedPort } });
    }
    setEditedPort(null);
  };

  const saveAuthToken = () => {
    const value = editedAuthToken ?? displayAuthToken;
    if (value !== config.remote.auth_token) {
      saveConfig({ remote: { ...remoteConfig, auth_token: value } });
    }
    setEditedAuthToken(null);
  };

  const saveManagementKey = () => {
    const value = editedManagementKey ?? displayManagementKey;
    if (value !== config.remote.management_key) {
      saveConfig({ remote: { ...remoteConfig, management_key: value || undefined } });
    }
    setEditedManagementKey(null);
  };

  const saveLocalPort = () => {
    const localPortStr = (editedLocalPort ?? displayLocalPort).trim();
    const parsedPort = localPortStr === '' ? CLIPROXY_DEFAULT_PORT : Number(localPortStr);

    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      toast.error('Local port must be an integer between 1 and 65535');
      setEditedLocalPort(null);
      return;
    }

    if (parsedPort !== config.local.port) {
      saveConfig({ local: { ...config.local, port: parsedPort } });
    }
    setEditedLocalPort(null);
  };

  const handleTestConnection = () => {
    testConnection({
      host: displayHost,
      port: displayPort,
      protocol: config.remote.protocol || 'http',
      authToken: displayAuthToken,
    });
  };

  return (
    <>
      {/* Toast-style alerts */}
      <div
        className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
          error || success
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {error && (
          <Alert variant="destructive" className="py-2 shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure local or remote {backend === 'plus' ? 'CLIProxy Plus' : 'CLIProxy'} connection
            for proxy-based profiles
          </p>

          {/* Proxy Status Widget - Quick access to start/stop controls */}
          {!isRemoteMode && (
            <div className="space-y-3">
              <h3 className="text-base font-medium">Instance Status</h3>
              <ProxyStatusWidget />
            </div>
          )}

          {/* Mode Toggle - Card based selection */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Connection Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Local Mode Card */}
              <button
                onClick={() => saveConfig({ remote: { ...remoteConfig, enabled: false } })}
                disabled={saving}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  !isRemoteMode
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Laptop
                    className={`w-5 h-5 ${!isRemoteMode ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="font-medium">Local</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Run {backend === 'plus' ? 'CLIProxy Plus' : 'CLIProxy'} binary on this machine
                </p>
              </button>

              {/* Remote Mode Card */}
              <button
                onClick={() => saveConfig({ remote: { ...remoteConfig, enabled: true } })}
                disabled={saving}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isRemoteMode
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Cloud
                    className={`w-5 h-5 ${isRemoteMode ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="font-medium">Remote</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect to a remote {backend === 'plus' ? 'CLIProxy Plus' : 'CLIProxy'} server
                </p>
              </button>
            </div>
          </div>

          {/* Backend Selection - Card based selection */}
          <div className="space-y-3">
            <h3 className="text-base font-medium flex items-center gap-2">
              <Box className="w-4 h-4" />
              Backend Binary
            </h3>
            {/* Warning when local proxy is running - must stop to change backend (not applicable in remote mode) */}
            {!isRemoteMode && isProxyRunning && (
              <Alert className="py-2 border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 [&>svg]:top-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  Stop the running proxy in Instance Status to switch backend.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              {/* Plus Backend Card */}
              <button
                onClick={() => handleBackendChange('plus')}
                disabled={updateBackendMutation.isPending || isBackendSwitchBlocked}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  backend === 'plus'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                } ${isBackendSwitchBlocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium">CLIProxyAPIPlus</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                    Default
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full provider support including Kiro and GitHub Copilot
                </p>
              </button>

              {/* Original Backend Card */}
              <button
                onClick={() => handleBackendChange('original')}
                disabled={updateBackendMutation.isPending || isBackendSwitchBlocked}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  backend === 'original'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                } ${isBackendSwitchBlocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium">CLIProxyAPI</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Original binary (Gemini, Codex, Antigravity only)
                </p>
              </button>
            </div>
            {/* Warning when original backend selected with Kiro/ghcp variants */}
            {backend === 'original' && hasKiroGhcpVariants && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Existing Kiro/Copilot variants will not work with CLIProxyAPI. Switch to
                  CLIProxyAPIPlus or remove those variants.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Safety */}
          <div className="space-y-3">
            <h3 className="text-base font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-300" />
              Safety
            </h3>
            <div className="space-y-3 rounded-lg border border-amber-400/35 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/25">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">Antigravity Power User Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Skip AGY responsibility checklist in Add Account and `ccs agy` flows.
                  </p>
                </div>
                <Switch
                  aria-labelledby="agy-power-user-mode-label"
                  aria-describedby="agy-power-user-mode-description"
                  checked={agyAckBypass}
                  disabled={agyAckBypassLoading || agyAckBypassSaving || saving}
                  onCheckedChange={handleAgyAckBypassChange}
                />
              </div>
              <p
                id="agy-power-user-mode-description"
                className="text-xs text-amber-800/90 dark:text-amber-200/90"
              >
                Use only if you fully understand the OAuth suspension/ban risk pattern (#509). CCS
                cannot assume responsibility for account loss.
              </p>
              {showAgyEnableConfirm && (
                <div className="space-y-3 rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3.5">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-wide text-rose-900 dark:text-rose-200">
                      Final confirmation required
                    </p>
                    <p className="text-xs leading-relaxed text-rose-800/95 dark:text-rose-200/90">
                      Enabling this will skip AGY safety checkpoints in both dashboard and CLI.
                      Review issue #509 and type the exact phrase to proceed.
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">
                        Step 1
                      </p>
                      <a
                        href="https://github.com/kaitranntt/ccs/issues/509"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-rose-800 underline decoration-rose-500/60 underline-offset-2 transition-colors hover:text-rose-700 dark:text-rose-200"
                      >
                        Read issue #509
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">
                        Step 2
                      </p>
                      <p className="mt-1 text-xs text-rose-800/95 dark:text-rose-200/90">
                        Type{' '}
                        <code className="rounded bg-background/80 px-1 py-0.5 font-mono">
                          {RISK_ACK_PHRASE}
                        </code>{' '}
                        to enable.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={agyEnableConfirmPhrase}
                      onChange={(e) => setAgyEnableConfirmPhrase(e.target.value)}
                      placeholder={RISK_ACK_PHRASE}
                      disabled={agyAckBypassSaving || saving}
                      className="font-mono text-xs"
                      aria-label="Type I ACCEPT RISK to enable Antigravity power user mode"
                    />
                    <p className="text-[11px] text-rose-800/90 dark:text-rose-200/80">
                      Exact phrase required.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAgyEnableConfirm(false);
                        setAgyEnableConfirmPhrase('');
                      }}
                      disabled={agyAckBypassSaving || saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={confirmAgyEnable}
                      disabled={!isAgyConfirmPhraseValid || agyAckBypassSaving || saving}
                    >
                      Enable Power User Mode
                    </Button>
                  </div>
                </div>
              )}
              <span id="agy-power-user-mode-label" className="sr-only">
                Toggle AGY power user mode
              </span>
            </div>
          </div>

          {/* Remote Settings - Show when remote mode is enabled */}
          {isRemoteMode && (
            <RemoteProxyCard
              config={config}
              saving={saving}
              testing={testing}
              testResult={testResult}
              displayHost={displayHost}
              displayPort={displayPort}
              displayAuthToken={displayAuthToken}
              displayManagementKey={displayManagementKey}
              setEditedHost={setEditedHost}
              setEditedPort={setEditedPort}
              setEditedAuthToken={setEditedAuthToken}
              setEditedManagementKey={setEditedManagementKey}
              onSaveHost={saveHost}
              onSavePort={savePort}
              onSaveAuthToken={saveAuthToken}
              onSaveManagementKey={saveManagementKey}
              onSaveConfig={saveConfig}
              onTestConnection={handleTestConnection}
            />
          )}

          {/* Fallback Settings */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Fallback Settings</h3>
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              {/* Enable Fallback */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Enable fallback to local</p>
                  <p className="text-xs text-muted-foreground">
                    Use local proxy if remote is unreachable
                  </p>
                </div>
                <Switch
                  checked={fallbackConfig.enabled ?? true}
                  onCheckedChange={(checked) =>
                    saveConfig({ fallback: { ...fallbackConfig, enabled: checked } })
                  }
                  disabled={saving || !isRemoteMode}
                />
              </div>

              {/* Auto-start on fallback */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Auto-start local proxy</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically start local proxy on fallback
                  </p>
                </div>
                <Switch
                  checked={fallbackConfig.auto_start ?? false}
                  onCheckedChange={(checked) =>
                    saveConfig({ fallback: { ...fallbackConfig, auto_start: checked } })
                  }
                  disabled={saving || !isRemoteMode || !fallbackConfig.enabled}
                />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3">
            <h3 className="text-base font-medium flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Advanced
            </h3>
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              {/* Debug Mode Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Debug Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Enable developer diagnostics in browser console
                  </p>
                </div>
                <Switch
                  checked={debugMode}
                  onCheckedChange={handleDebugModeChange}
                  disabled={saving}
                />
              </div>
              {debugMode && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pl-0.5">
                  Debug mode enabled. Check browser console for detailed logs.
                </p>
              )}
            </div>
          </div>

          {/* Local Proxy Settings - Only show in Local mode */}
          {!isRemoteMode && (
            <LocalProxyCard
              config={config}
              saving={saving}
              displayLocalPort={displayLocalPort}
              setEditedLocalPort={setEditedLocalPort}
              onSaveLocalPort={saveLocalPort}
              onSaveConfig={saveConfig}
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchConfig();
            fetchAgyAckBypass();
            fetchRawConfig();
            fetchBackend();
            checkPlusOnlyVariants();
          }}
          disabled={loading || saving || agyAckBypassSaving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </>
  );
}
