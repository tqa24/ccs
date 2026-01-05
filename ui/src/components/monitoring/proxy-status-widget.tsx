/**
 * Proxy Status Widget
 *
 * Displays CLIProxy process status with start/stop/restart controls.
 * Shows: running state, port, session count, uptime, update availability.
 * In remote mode: shows remote server info instead of local controls.
 */

import { useState } from 'react';
import {
  Activity,
  Power,
  RefreshCw,
  Clock,
  Users,
  Square,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Globe,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery } from '@tanstack/react-query';
import { api, type CliproxyServerConfig } from '@/lib/api-client';
import {
  useProxyStatus,
  useStartProxy,
  useStopProxy,
  useCliproxyUpdateCheck,
  useCliproxyVersions,
  useInstallVersion,
  useRestartProxy,
} from '@/hooks/use-cliproxy';
import { cn } from '@/lib/utils';

/** Client-side semver comparison (true if a > b) */
function isNewerVersionClient(a: string, b: string): boolean {
  const aParts = a.replace(/-\d+$/, '').split('.').map(Number);
  const bParts = b.replace(/-\d+$/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((aParts[i] || 0) > (bParts[i] || 0)) return true;
    if ((aParts[i] || 0) < (bParts[i] || 0)) return false;
  }
  return false;
}

function formatUptime(startedAt?: string): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = now - start;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${hours}h ago`;
}

export function ProxyStatusWidget() {
  const { data: status, isLoading } = useProxyStatus();
  const { data: updateCheck } = useCliproxyUpdateCheck();
  const { data: versionsData, isLoading: versionsLoading } = useCliproxyVersions();
  const startProxy = useStartProxy();
  const stopProxy = useStopProxy();
  const restartProxy = useRestartProxy();
  const installVersion = useInstallVersion();

  // Version picker state
  const [showVersionSettings, setShowVersionSettings] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [manualVersion, setManualVersion] = useState('');

  // Confirmation dialog state for unstable versions
  const [showUnstableConfirm, setShowUnstableConfirm] = useState(false);
  const [pendingInstallVersion, setPendingInstallVersion] = useState<string | null>(null);

  // Fetch cliproxy_server config for remote mode detection
  const { data: cliproxyConfig } = useQuery<CliproxyServerConfig>({
    queryKey: ['cliproxy-server-config'],
    queryFn: () => api.cliproxyServer.get(),
    staleTime: 30000, // 30 seconds
  });

  // Determine if remote mode is enabled
  const remoteConfig = cliproxyConfig?.remote;
  const isRemoteMode = remoteConfig?.enabled && remoteConfig?.host;

  const isRunning = status?.running ?? false;
  const isActioning =
    startProxy.isPending ||
    stopProxy.isPending ||
    restartProxy.isPending ||
    installVersion.isPending;
  const hasUpdate = updateCheck?.hasUpdate ?? false;
  const isUnstable = updateCheck?.isStable === false;

  // Handle version install (shows confirmation for unstable)
  const handleInstallVersion = (version: string) => {
    if (!version) return;
    const maxStable = versionsData?.maxStableVersion || '6.6.80';
    const isVersionUnstable = isNewerVersionClient(version, maxStable);

    if (isVersionUnstable) {
      // Show confirmation dialog for unstable versions
      setPendingInstallVersion(version);
      setShowUnstableConfirm(true);
      return;
    }

    // Install directly if stable
    installVersion.mutate({ version });
  };

  // Confirm unstable version install
  const handleConfirmUnstableInstall = () => {
    if (pendingInstallVersion) {
      installVersion.mutate({ version: pendingInstallVersion, force: true });
    }
    setShowUnstableConfirm(false);
    setPendingInstallVersion(null);
  };

  const handleCancelUnstableInstall = () => {
    setShowUnstableConfirm(false);
    setPendingInstallVersion(null);
  };

  // Build remote display info
  const remoteDisplayHost = isRemoteMode
    ? (() => {
        const protocol = remoteConfig.protocol || 'http';
        const port = remoteConfig.port || (protocol === 'https' ? 443 : 80);
        const isDefaultPort =
          (protocol === 'https' && port === 443) || (protocol === 'http' && port === 80);
        return isDefaultPort ? remoteConfig.host : `${remoteConfig.host}:${port}`;
      })()
    : null;

  // Remote mode: show remote server info
  if (isRemoteMode) {
    return (
      <div
        className={cn(
          'rounded-lg border p-3 transition-colors',
          'border-blue-500/30 bg-blue-500/5'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Remote Proxy</span>
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              Active
            </Badge>
          </div>
          <Activity className="w-3 h-3 text-blue-600" />
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-mono">{remoteDisplayHost}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 leading-tight">
            Traffic auto-routed to remote server
          </p>
        </div>
      </div>
    );
  }

  // Local mode: show original controls

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isRunning ? 'border-green-500/30 bg-green-500/5' : 'border-muted bg-muted/30'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
            )}
          />
          <span className="text-sm font-medium">CLIProxy Plus</span>
          {hasUpdate && (
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 gap-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title={`Update: v${updateCheck?.currentVersion} -> v${updateCheck?.latestVersion}`}
            >
              <ArrowUp className="w-2.5 h-2.5" />
              Update
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isLoading ? (
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : isRunning ? (
            <Activity className="w-3 h-3 text-green-600" />
          ) : (
            <Power className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {isRunning && status ? (
        <>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">Port {status.port}</span>
            {status.sessionCount !== undefined && status.sessionCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {status.sessionCount} session{status.sessionCount !== 1 ? 's' : ''}
              </span>
            )}
            {status.startedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatUptime(status.startedAt)}
              </span>
            )}
          </div>
          {/* Control buttons when running: Restart | Update/Downgrade | Stop | Settings */}
          <div className="mt-2 flex items-center gap-2">
            {/* Restart button - pure restart, no version change */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => restartProxy.mutate()}
              disabled={isActioning}
              title="Restart CLIProxy service (no version change)"
            >
              {restartProxy.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCw className="w-3 h-3" />
              )}
              Restart
            </Button>

            {/* Update/Downgrade button - version change */}
            <Button
              variant={hasUpdate || isUnstable ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-7 text-xs gap-1 flex-1',
                isUnstable
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : hasUpdate &&
                      'bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground'
              )}
              onClick={() => {
                const targetVersion = isUnstable
                  ? updateCheck?.maxStableVersion || versionsData?.latestStable
                  : updateCheck?.latestVersion;
                if (targetVersion) handleInstallVersion(targetVersion);
              }}
              disabled={isActioning || (!hasUpdate && !isUnstable)}
              title={
                isUnstable
                  ? `Downgrade to stable v${updateCheck?.maxStableVersion}`
                  : hasUpdate
                    ? `Update to v${updateCheck?.latestVersion}`
                    : 'Already on latest version'
              }
            >
              {isActioning && !restartProxy.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : isUnstable ? (
                <AlertTriangle className="w-3 h-3" />
              ) : hasUpdate ? (
                <ArrowUp className="w-3 h-3" />
              ) : null}
              {isUnstable ? 'Downgrade' : hasUpdate ? 'Update' : 'Latest'}
            </Button>

            {/* Stop button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              onClick={() => stopProxy.mutate()}
              disabled={isActioning}
              title="Stop CLIProxy service"
            >
              {stopProxy.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Square className="w-3 h-3" />
              )}
              Stop
            </Button>

            {/* Settings gear - toggle version picker */}
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7 w-7 p-0', showVersionSettings && 'bg-muted')}
              onClick={() => setShowVersionSettings(!showVersionSettings)}
              title="Version settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Version Settings (collapsible) */}
          <Collapsible open={showVersionSettings} onOpenChange={setShowVersionSettings}>
            <CollapsibleContent className="mt-2 pt-2 border-t border-muted">
              <div className="space-y-2">
                {/* Current version */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current:</span>
                  <span
                    className={cn('font-mono', isUnstable && 'text-amber-600 dark:text-amber-400')}
                  >
                    v{updateCheck?.currentVersion}
                    {isUnstable && ' (unstable)'}
                  </span>
                </div>

                {/* Version picker row */}
                <div className="flex items-center gap-2">
                  {/* Dropdown */}
                  <Select
                    value={selectedVersion}
                    onValueChange={(v) => {
                      setSelectedVersion(v);
                      setManualVersion('');
                    }}
                    disabled={versionsLoading}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Select version..." />
                    </SelectTrigger>
                    <SelectContent>
                      {versionsData?.versions.slice(0, 20).map((v) => (
                        <SelectItem key={v} value={v} className="text-xs">
                          v{v}
                          {v === versionsData.latestStable && ' (stable)'}
                          {v === versionsData.latest &&
                            v !== versionsData.latestStable &&
                            ' (latest)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Manual input */}
                  <Input
                    placeholder="Manual..."
                    value={manualVersion}
                    onChange={(e) => {
                      setManualVersion(e.target.value);
                      setSelectedVersion('');
                    }}
                    className="h-7 text-xs w-24"
                  />

                  {/* Install button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleInstallVersion(manualVersion || selectedVersion)}
                    disabled={installVersion.isPending || (!selectedVersion && !manualVersion)}
                  >
                    {installVersion.isPending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    Install
                  </Button>
                </div>

                {/* Stability warning */}
                {(selectedVersion || manualVersion) &&
                  versionsData &&
                  isNewerVersionClient(
                    manualVersion || selectedVersion,
                    versionsData.maxStableVersion
                  ) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>
                        Versions above {versionsData.maxStableVersion} have known stability issues
                      </span>
                    </div>
                  )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Not running</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => startProxy.mutate()}
            disabled={startProxy.isPending}
          >
            {startProxy.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
            Start
          </Button>
        </div>
      )}

      {/* Version sync indicator */}
      {updateCheck?.currentVersion && (
        <div className="mt-2 pt-2 border-t border-muted flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            {isUnstable && (
              <AlertTriangle
                className="w-3 h-3 text-amber-500"
                title={updateCheck.stabilityMessage}
              />
            )}
            <span className={isUnstable ? 'text-amber-600 dark:text-amber-400' : ''}>
              v{updateCheck.currentVersion}
            </span>
            {isUnstable && (
              <span className="text-amber-600/70 dark:text-amber-400/70">(unstable)</span>
            )}
          </span>
          {updateCheck.checkedAt && (
            <span title={new Date(updateCheck.checkedAt).toLocaleString()}>
              Synced {formatTimeAgo(updateCheck.checkedAt)}
            </span>
          )}
        </div>
      )}

      {/* Unstable Version Confirmation Dialog */}
      <AlertDialog open={showUnstableConfirm} onOpenChange={setShowUnstableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Install Unstable Version?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to install <strong>v{pendingInstallVersion}</strong>, which is above
                the maximum stable version{' '}
                <strong>v{versionsData?.maxStableVersion || '6.6.80'}</strong>.
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                This version has known stability issues and may cause unexpected behavior.
              </p>
              <p>Are you sure you want to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUnstableInstall}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnstableInstall}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Install Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
