/**
 * Cursor Page
 * Dedicated dashboard surface for Cursor integration.
 */

import { useMemo, useState, type ElementType } from 'react';
import { toast } from 'sonner';
import {
  Bot,
  CheckCircle2,
  FileCode,
  Key,
  Loader2,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCursor } from '@/hooks/use-cursor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeEditor } from '@/components/shared/code-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CursorConfigDraft {
  port: string;
  auto_start: boolean;
  ghost_mode: boolean;
}

function buildConfigDraft(config?: {
  port?: number;
  auto_start?: boolean;
  ghost_mode?: boolean;
}): CursorConfigDraft {
  return {
    port: String(config?.port ?? 20129),
    auto_start: config?.auto_start ?? false,
    ghost_mode: config?.ghost_mode ?? true,
  };
}

function StatusItem({
  icon: Icon,
  label,
  ok,
  detail,
}: {
  icon: ElementType;
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span
          className={cn('text-xs', ok ? 'text-green-500' : 'text-muted-foreground')}
          title={detail}
        >
          {detail}
        </span>
      </div>
    </div>
  );
}

export function CursorPage() {
  const {
    status,
    statusLoading,
    refetchStatus,
    config,
    updateConfigAsync,
    isUpdatingConfig,
    models,
    modelsLoading,
    currentModel,
    rawSettings,
    rawSettingsLoading,
    refetchRawSettings,
    saveRawSettingsAsync,
    isSavingRawSettings,
    autoDetectAuthAsync,
    isAutoDetectingAuth,
    importManualAuthAsync,
    isImportingManualAuth,
    startDaemonAsync,
    isStartingDaemon,
    stopDaemonAsync,
    isStoppingDaemon,
  } = useCursor();

  const [configDraft, setConfigDraft] = useState<CursorConfigDraft>(() => buildConfigDraft());
  const [configDirty, setConfigDirty] = useState(false);
  const [rawConfigText, setRawConfigText] = useState<string>('{}');
  const [rawConfigDirty, setRawConfigDirty] = useState(false);
  const [manualAuthOpen, setManualAuthOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualMachineId, setManualMachineId] = useState('');

  const pristineConfigDraft = buildConfigDraft(config);

  const effectivePort = configDirty ? configDraft.port : pristineConfigDraft.port;
  const effectiveAutoStart = configDirty ? configDraft.auto_start : pristineConfigDraft.auto_start;
  const effectiveGhostMode = configDirty ? configDraft.ghost_mode : pristineConfigDraft.ghost_mode;
  const effectiveRawConfigText = rawConfigDirty
    ? rawConfigText
    : JSON.stringify(rawSettings?.settings ?? {}, null, 2);
  const rawSettingsReady = Boolean(rawSettings);
  const disableRawSave = isSavingRawSettings || rawSettingsLoading || !rawSettingsReady;

  const updateConfigDraft = (updater: (draft: CursorConfigDraft) => CursorConfigDraft) => {
    setConfigDraft((previousDraft) => {
      const baseDraft = configDirty ? previousDraft : pristineConfigDraft;
      return updater(baseDraft);
    });
    setConfigDirty(true);
  };

  const canStart = Boolean(status?.enabled && status?.authenticated && !status?.token_expired);
  const integrationBadge = useMemo(
    () => (status?.enabled ? <Badge>Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>),
    [status?.enabled]
  );

  const handleSaveConfig = async () => {
    const parsedPort = Number(effectivePort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      toast.error('Port must be an integer between 1 and 65535');
      return;
    }

    try {
      await updateConfigAsync({
        port: parsedPort,
        auto_start: effectiveAutoStart,
        ghost_mode: effectiveGhostMode,
      });
      setConfigDirty(false);
      setConfigDraft(
        buildConfigDraft({
          port: parsedPort,
          auto_start: effectiveAutoStart,
          ghost_mode: effectiveGhostMode,
        })
      );
      toast.success('Cursor config saved');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save config');
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      await updateConfigAsync({ enabled });
      toast.success(enabled ? 'Cursor integration enabled' : 'Cursor integration disabled');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update integration state');
    }
  };

  const handleAutoDetectAuth = async () => {
    try {
      await autoDetectAuthAsync();
      toast.success('Cursor credentials imported');
    } catch (error) {
      toast.error((error as Error).message || 'Auto-detect failed');
    }
  };

  const handleManualAuthImport = async () => {
    if (!manualToken.trim() || !manualMachineId.trim()) {
      toast.error('Token and machine ID are required');
      return;
    }

    try {
      await importManualAuthAsync({
        accessToken: manualToken.trim(),
        machineId: manualMachineId.trim(),
      });
      toast.success('Cursor credentials imported');
      setManualAuthOpen(false);
      setManualToken('');
      setManualMachineId('');
    } catch (error) {
      toast.error((error as Error).message || 'Manual import failed');
    }
  };

  const handleStartDaemon = async () => {
    try {
      const result = await startDaemonAsync();
      if (!result.success) {
        toast.error(result.error || 'Failed to start daemon');
        return;
      }
      toast.success(`Daemon started${result.pid ? ` (PID: ${result.pid})` : ''}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to start daemon');
    }
  };

  const handleStopDaemon = async () => {
    try {
      const result = await stopDaemonAsync();
      if (!result.success) {
        toast.error(result.error || 'Failed to stop daemon');
        return;
      }
      toast.success('Daemon stopped');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to stop daemon');
    }
  };

  const handleSaveRawSettings = async () => {
    if (!rawSettingsReady) {
      toast.error('Raw settings are still loading. Please wait and try again.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(effectiveRawConfigText || '{}');
    } catch (error) {
      toast.error((error as Error).message || 'Invalid JSON');
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast.error('Raw settings must be a JSON object');
      return;
    }

    try {
      await saveRawSettingsAsync({
        settings: parsed as { env?: Record<string, string> },
        expectedMtime: rawSettings?.mtime,
      });
      setRawConfigDirty(false);
      toast.success('Raw settings saved');
    } catch (error) {
      const message = (error as Error).message || 'Failed to save raw settings';
      if (message === 'CONFLICT') {
        toast.error('Raw settings changed externally. Refresh and retry.');
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <>
      <div className="h-[calc(100vh-100px)] flex">
        <div className="w-80 border-r flex flex-col bg-muted/30 shrink-0">
          <div className="p-4 border-b bg-background">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <h1 className="font-semibold">Cursor</h1>
                {integrationBadge}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetchStatus()}
                disabled={statusLoading}
              >
                <RefreshCw className={cn('w-4 h-4', statusLoading && 'animate-spin')} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Dedicated Cursor integration controls</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              <div className="space-y-2">
                <StatusItem
                  icon={ShieldCheck}
                  label="Integration"
                  ok={Boolean(status?.enabled)}
                  detail={status?.enabled ? 'Enabled' : 'Disabled'}
                />
                <StatusItem
                  icon={Key}
                  label="Authentication"
                  ok={Boolean(status?.authenticated && !status?.token_expired)}
                  detail={
                    status?.authenticated
                      ? status?.token_expired
                        ? 'Expired'
                        : (status.auth_method ?? 'Connected')
                      : 'Not connected'
                  }
                />
                <StatusItem
                  icon={Server}
                  label="Daemon"
                  ok={Boolean(status?.daemon_running)}
                  detail={status?.daemon_running ? 'Running' : 'Stopped'}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Actions
                </p>

                {status?.enabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleToggleEnabled(false)}
                    disabled={isUpdatingConfig}
                  >
                    <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                    Disable Integration
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleToggleEnabled(true)}
                    disabled={isUpdatingConfig}
                  >
                    <Power className="w-3.5 h-3.5 mr-1.5" />
                    Enable Integration
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAutoDetectAuth}
                  disabled={isAutoDetectingAuth}
                >
                  {isAutoDetectingAuth ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Auto-detect Auth
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setManualAuthOpen(true)}
                >
                  <Key className="w-3.5 h-3.5 mr-1.5" />
                  Manual Auth Import
                </Button>

                {status?.daemon_running ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleStopDaemon}
                    disabled={isStoppingDaemon}
                  >
                    {isStoppingDaemon ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Stop Daemon
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleStartDaemon}
                    disabled={!canStart}
                  >
                    {isStartingDaemon ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Start Daemon
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="p-3 border-t bg-background text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Port</span>
              <span>{status?.port ?? config?.port ?? 20129}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 bg-background overflow-hidden">
          <div className="h-full overflow-auto p-4 md:p-6">
            <Tabs defaultValue="config" className="space-y-4">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="config">Config</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
                <TabsTrigger value="raw">Raw Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cursor Runtime Config</CardTitle>
                    <CardDescription>
                      Controls daemon behavior for local Cursor OpenAI-compatible endpoint.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="cursor-port">Port</Label>
                      <Input
                        id="cursor-port"
                        type="number"
                        min={1}
                        max={65535}
                        value={effectivePort}
                        onChange={(e) => {
                          updateConfigDraft((draft) => ({ ...draft, port: e.target.value }));
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label htmlFor="cursor-auto-start">Auto-start</Label>
                        <p className="text-xs text-muted-foreground">
                          Start cursor daemon automatically when integration is used.
                        </p>
                      </div>
                      <Switch
                        id="cursor-auto-start"
                        checked={effectiveAutoStart}
                        onCheckedChange={(value) => {
                          updateConfigDraft((draft) => ({ ...draft, auto_start: value }));
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label htmlFor="cursor-ghost-mode">Ghost Mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Requests `x-ghost-mode` to reduce telemetry.
                        </p>
                      </div>
                      <Switch
                        id="cursor-ghost-mode"
                        checked={effectiveGhostMode}
                        onCheckedChange={(value) => {
                          updateConfigDraft((draft) => ({ ...draft, ghost_mode: value }));
                        }}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSaveConfig} disabled={isUpdatingConfig}>
                        {isUpdatingConfig ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Config
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="models" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Available Models</CardTitle>
                    <CardDescription>
                      Cursor forwards the requested model from each client request.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {modelsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading models...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {models.map((model) => (
                          <div
                            key={model.id}
                            className="rounded-lg border px-3 py-2 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium">{model.id}</p>
                              <p className="text-xs text-muted-foreground">
                                {model.name} • {model.provider}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {model.id === currentModel && <Badge>Default</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="raw" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-primary" />
                      cursor.settings.json
                    </CardTitle>
                    <CardDescription>
                      {rawSettings?.path ?? '~/.ccs/cursor.settings.json'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeEditor
                      value={effectiveRawConfigText}
                      onChange={(value) => {
                        setRawConfigDirty(true);
                        setRawConfigText(value);
                      }}
                      language="json"
                    />

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRawConfigDirty(false);
                          refetchRawSettings();
                        }}
                        disabled={rawSettingsLoading}
                      >
                        <RefreshCw
                          className={cn('w-4 h-4 mr-2', rawSettingsLoading && 'animate-spin')}
                        />
                        Refresh
                      </Button>
                      <Button onClick={handleSaveRawSettings} disabled={disableRawSave}>
                        {isSavingRawSettings ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Raw Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={manualAuthOpen} onOpenChange={setManualAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Cursor Auth Import</DialogTitle>
            <DialogDescription>
              Provide Cursor access token and machine ID if auto-detect is unavailable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cursor-manual-token">Access Token</Label>
              <Input
                id="cursor-manual-token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste Cursor access token"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cursor-manual-machine-id">Machine ID</Label>
              <Input
                id="cursor-manual-machine-id"
                value={manualMachineId}
                onChange={(e) => setManualMachineId(e.target.value)}
                placeholder="32-char hex (UUID without hyphens)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualAuthOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualAuthImport} disabled={isImportingManualAuth}>
              {isImportingManualAuth ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
