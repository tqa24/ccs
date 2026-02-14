/**
 * Cursor Page
 * Dedicated dashboard surface for Cursor integration.
 */

import { useMemo, useState, type ElementType } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Key,
  Loader2,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCursor } from '@/hooks/use-cursor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RawEditorSection } from '@/components/copilot/config-form/raw-editor-section';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  model: string;
  opus_model: string;
  sonnet_model: string;
  haiku_model: string;
}

interface RawSettingsParseResult {
  isValid: boolean;
  settings?: { env?: Record<string, string> };
  error?: string;
}

function buildConfigDraft(config?: {
  port?: number;
  auto_start?: boolean;
  ghost_mode?: boolean;
  model?: string;
  opus_model?: string;
  sonnet_model?: string;
  haiku_model?: string;
}): CursorConfigDraft {
  return {
    port: String(config?.port ?? 20129),
    auto_start: config?.auto_start ?? false,
    ghost_mode: config?.ghost_mode ?? true,
    model: config?.model?.trim() || 'gpt-5.3-codex',
    opus_model: config?.opus_model?.trim() || '',
    sonnet_model: config?.sonnet_model?.trim() || '',
    haiku_model: config?.haiku_model?.trim() || '',
  };
}

function pickModelByPatterns(
  models: Array<{ id: string }>,
  patterns: RegExp[],
  fallback: string
): string {
  const matched = models.find((model) => patterns.some((pattern) => pattern.test(model.id)));
  return matched?.id ?? fallback;
}

function normalizeModelKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickModelByAliases(
  models: Array<{ id: string; name: string }>,
  aliases: string[],
  fallback: string
): string {
  const normalizedAliasSet = new Set(aliases.map(normalizeModelKey));
  const direct = models.find((model) => normalizedAliasSet.has(normalizeModelKey(model.id)));
  if (direct) return direct.id;

  const byName = models.find((model) => normalizedAliasSet.has(normalizeModelKey(model.name)));
  if (byName) return byName.id;

  return fallback;
}

function parseRawSettings(value: string): RawSettingsParseResult {
  try {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        isValid: false,
        error: 'Raw settings must be a JSON object',
      };
    }

    return {
      isValid: true,
      settings: parsed as { env?: Record<string, string> },
    };
  } catch (error) {
    return {
      isValid: false,
      error: (error as Error).message || 'Invalid JSON',
    };
  }
}

function CursorModelSelector({
  label,
  description,
  value,
  models,
  disabled,
  allowDefaultFallback = false,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  models: Array<{ id: string; name: string; provider: string }>;
  disabled?: boolean;
  allowDefaultFallback?: boolean;
  onChange: (value: string) => void;
}) {
  const selectorValue = value || (allowDefaultFallback ? '__default' : '');
  const selected = models.find((model) => model.id === value);

  return (
    <div className="space-y-1.5">
      <div>
        <Label className="text-xs font-medium">{label}</Label>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Select
        value={selectorValue}
        onValueChange={(nextValue) => {
          if (allowDefaultFallback && nextValue === '__default') {
            onChange('');
            return;
          }
          onChange(nextValue);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select model">
            {selectorValue && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-mono text-xs">
                  {allowDefaultFallback && selectorValue === '__default'
                    ? 'Use Default Model'
                    : selected?.name || selectorValue}
                </span>
                {selected?.provider && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                    {selected.provider}
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectGroup>
            <SelectLabel className="text-xs text-muted-foreground">
              Available Models ({models.length})
            </SelectLabel>
            {allowDefaultFallback && <SelectItem value="__default">Use Default Model</SelectItem>}
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-xs font-mono">{model.name || model.id}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                    {model.provider}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
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
  const effectiveModel = configDirty ? configDraft.model : pristineConfigDraft.model;
  const effectiveOpusModel = configDirty ? configDraft.opus_model : pristineConfigDraft.opus_model;
  const effectiveSonnetModel = configDirty
    ? configDraft.sonnet_model
    : pristineConfigDraft.sonnet_model;
  const effectiveHaikuModel = configDirty
    ? configDraft.haiku_model
    : pristineConfigDraft.haiku_model;
  const effectiveRawConfigText = rawConfigDirty
    ? rawConfigText
    : JSON.stringify(rawSettings?.settings ?? {}, null, 2);
  const rawSettingsReady = Boolean(rawSettings);
  const rawParseResult = useMemo(
    () => parseRawSettings(effectiveRawConfigText),
    [effectiveRawConfigText]
  );
  const isRawJsonValid = rawParseResult.isValid;
  const hasChanges = configDirty || rawConfigDirty;
  const canSave = !rawConfigDirty || (rawSettingsReady && isRawJsonValid);
  const orderedModels = useMemo(() => {
    const seen = new Set<string>();
    const sorted = [...models].sort((a, b) => a.name.localeCompare(b.name));
    const deduped = sorted.filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });

    if (effectiveModel && !sorted.some((model) => model.id === effectiveModel)) {
      return [
        {
          id: effectiveModel,
          name: effectiveModel,
          provider: 'custom',
        },
        ...deduped,
      ];
    }

    return deduped;
  }, [models, effectiveModel]);

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

  const handleSaveConfig = async ({
    suppressSuccessToast = false,
  }: { suppressSuccessToast?: boolean } = {}) => {
    const parsedPort = Number(effectivePort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      toast.error('Port must be an integer between 1 and 65535');
      return false;
    }
    if (!effectiveModel.trim()) {
      toast.error('Default model is required');
      return false;
    }

    try {
      await updateConfigAsync({
        port: parsedPort,
        auto_start: effectiveAutoStart,
        ghost_mode: effectiveGhostMode,
        model: effectiveModel,
        opus_model: effectiveOpusModel || undefined,
        sonnet_model: effectiveSonnetModel || undefined,
        haiku_model: effectiveHaikuModel || undefined,
      });
      setConfigDirty(false);
      setConfigDraft(
        buildConfigDraft({
          port: parsedPort,
          auto_start: effectiveAutoStart,
          ghost_mode: effectiveGhostMode,
          model: effectiveModel,
          opus_model: effectiveOpusModel || undefined,
          sonnet_model: effectiveSonnetModel || undefined,
          haiku_model: effectiveHaikuModel || undefined,
        })
      );
      if (!suppressSuccessToast) {
        toast.success('Cursor config and model mapping saved');
      }
      return true;
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save config');
      return false;
    }
  };

  const applyPreset = (preset: 'codex53' | 'claude46' | 'gemini3') => {
    const fallbackModel = effectiveModel || currentModel || models[0]?.id || 'gpt-5.3-codex';
    const codex53 = pickModelByAliases(
      models,
      ['gpt-5.3-codex', 'gpt53codex', 'GPT-5.3 Codex'],
      pickModelByPatterns(models, [/gpt[-.]?5.*codex/i], fallbackModel)
    );
    const codexMax = pickModelByAliases(
      models,
      ['gpt-5.1-codex-max', 'gpt51codexmax', 'GPT-5.1 Codex Max'],
      pickModelByPatterns(models, [/gpt[-.]?5.*codex.*max/i], codex53)
    );
    const codexFast = pickModelByAliases(
      models,
      ['gpt-5-fast', 'gpt5fast', 'GPT-5 Fast'],
      pickModelByPatterns(models, [/gpt[-.]?5.*fast/i], codex53)
    );
    const codexMini = pickModelByAliases(
      models,
      ['gpt-5-mini', 'gpt5mini', 'GPT-5 Mini'],
      pickModelByPatterns(models, [/gpt[-.]?5.*mini/i], codexFast)
    );
    const opus46 = pickModelByAliases(
      models,
      ['claude-4.6-opus', 'claude46opus', 'Claude 4.6 Opus'],
      pickModelByPatterns(models, [/claude[-.]?4\.?6.*opus/i, /claude.*opus/i], codex53)
    );
    const sonnet45 = pickModelByAliases(
      models,
      ['claude-4.5-sonnet', 'claude45sonnet', 'Claude 4.5 Sonnet'],
      pickModelByPatterns(models, [/claude[-.]?4\.?5.*sonnet/i, /claude.*sonnet/i], codex53)
    );
    const haiku45 = pickModelByAliases(
      models,
      ['claude-4.5-haiku', 'claude45haiku', 'Claude 4.5 Haiku'],
      pickModelByPatterns(models, [/claude[-.]?4\.?5.*haiku/i, /haiku/i], sonnet45)
    );
    const gemini3Pro = pickModelByAliases(
      models,
      ['gemini-3-pro', 'gemini3pro', 'Gemini 3 Pro'],
      pickModelByPatterns(models, [/gemini[-.]?3.*pro/i], codex53)
    );
    const gemini3Flash = pickModelByAliases(
      models,
      ['gemini-3-flash', 'gemini3flash', 'Gemini 3 Flash'],
      pickModelByPatterns(models, [/gemini[-.]?3.*flash/i, /gemini[-.]?2\.?5.*flash/i], gemini3Pro)
    );

    if (preset === 'codex53') {
      updateConfigDraft((draft) => ({
        ...draft,
        model: codex53,
        opus_model: codexMax,
        sonnet_model: codex53,
        haiku_model: codexMini,
      }));
      toast.success('Applied GPT-5.3 Codex preset');
      return;
    }

    if (preset === 'claude46') {
      updateConfigDraft((draft) => ({
        ...draft,
        model: opus46,
        opus_model: opus46,
        sonnet_model: sonnet45,
        haiku_model: haiku45,
      }));
      toast.success('Applied Claude 4.6 preset');
      return;
    }

    updateConfigDraft((draft) => ({
      ...draft,
      model: gemini3Pro,
      opus_model: gemini3Pro,
      sonnet_model: gemini3Pro,
      haiku_model: gemini3Flash,
    }));
    toast.success('Applied Gemini 3 preset');
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

  const handleSaveRawSettings = async ({
    suppressSuccessToast = false,
  }: { suppressSuccessToast?: boolean } = {}) => {
    if (!rawSettingsReady) {
      toast.error('Raw settings are still loading. Please wait and try again.');
      return false;
    }

    if (!rawParseResult.isValid || !rawParseResult.settings) {
      toast.error(rawParseResult.error || 'Invalid JSON');
      return false;
    }

    try {
      await saveRawSettingsAsync({
        settings: rawParseResult.settings,
        expectedMtime: rawSettings?.mtime,
      });
      setRawConfigDirty(false);
      if (!suppressSuccessToast) {
        toast.success('Raw settings saved');
      }
      return true;
    } catch (error) {
      const message = (error as Error).message || 'Failed to save raw settings';
      if (message === 'CONFLICT') {
        toast.error('Raw settings changed externally. Refresh and retry.');
      } else {
        toast.error(message);
      }
      return false;
    }
  };

  const handleSaveAll = async () => {
    if (!hasChanges) return;

    const saveConfig = configDirty;
    const saveRawSettings = rawConfigDirty;

    if (saveConfig) {
      const saved = await handleSaveConfig({
        suppressSuccessToast: saveRawSettings,
      });
      if (!saved) return;
    }

    if (saveRawSettings) {
      const saved = await handleSaveRawSettings({
        suppressSuccessToast: saveConfig,
      });
      if (!saved) return;
    }

    if (saveConfig && saveRawSettings) {
      toast.success('Cursor configuration saved');
    }
  };

  const handleHeaderRefresh = () => {
    setRawConfigDirty(false);
    refetchStatus();
    refetchRawSettings();
  };

  return (
    <>
      <div className="h-[calc(100vh-100px)] flex">
        <div className="w-80 border-r flex flex-col bg-muted/30 shrink-0">
          <div className="p-4 border-b bg-background">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/sidebar/cursor.svg"
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
                />
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
              <div className="rounded-md border border-yellow-500/50 bg-yellow-500/15 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                    Unofficial API - Use at Your Own Risk
                  </span>
                </div>
                <ul className="text-[11px] text-yellow-700 dark:text-yellow-300 space-y-0.5 pl-6 list-disc">
                  <li>Reverse-engineered integration may break anytime</li>
                  <li>Abuse or excessive usage may risk account restrictions</li>
                  <li>No warranty, no responsibility from CCS</li>
                </ul>
              </div>

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
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b bg-background flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Cursor Configuration</h2>
                    {rawSettings && (
                      <Badge variant="outline" className="text-xs">
                        cursor.settings.json
                      </Badge>
                    )}
                  </div>
                  {rawSettings && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last modified:{' '}
                      {rawSettings.exists
                        ? new Date(rawSettings.mtime).toLocaleString()
                        : 'Never saved'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHeaderRefresh}
                  disabled={statusLoading || rawSettingsLoading}
                >
                  <RefreshCw
                    className={cn(
                      'w-4 h-4',
                      (statusLoading || rawSettingsLoading) && 'animate-spin'
                    )}
                  />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={isUpdatingConfig || isSavingRawSettings || !hasChanges || !canSave}
                >
                  {isUpdatingConfig || isSavingRawSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex-1 flex divide-x overflow-hidden">
              <div className="w-[540px] shrink-0 flex flex-col overflow-hidden bg-muted/5">
                <Tabs defaultValue="config" className="h-full flex flex-col">
                  <div className="px-4 pt-4 shrink-0">
                    <TabsList className="w-full">
                      <TabsTrigger value="config" className="flex-1">
                        Model Config
                      </TabsTrigger>
                      <TabsTrigger value="settings" className="flex-1">
                        Settings
                      </TabsTrigger>
                      <TabsTrigger value="info" className="flex-1">
                        Info
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col">
                    <TabsContent
                      value="config"
                      className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
                    >
                      <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6">
                          <div>
                            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              Presets
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                              Apply pre-configured model mappings
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 gap-1"
                                onClick={() => applyPreset('codex53')}
                                title="OpenAI-only mapping: GPT-5.3 Codex / Codex Max / GPT-5 Mini"
                              >
                                <Zap className="w-3 h-3" />
                                GPT-5.3 Codex
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 gap-1"
                                onClick={() => applyPreset('claude46')}
                                title="Claude-first mapping: Opus 4.6 / Sonnet 4.5 / Haiku 4.5"
                              >
                                <Zap className="w-3 h-3" />
                                Claude 4.6
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 gap-1"
                                onClick={() => applyPreset('gemini3')}
                                title="Gemini-first mapping: Gemini 3 Pro + Gemini 3 Flash"
                              >
                                <Zap className="w-3 h-3" />
                                Gemini 3 Pro
                              </Button>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <h3 className="text-sm font-medium mb-2">Model Mapping</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                              Configure which models to use for each tier
                            </p>
                            <div className="space-y-4">
                              <CursorModelSelector
                                label="Default Model"
                                description="Used when no specific tier is requested."
                                value={effectiveModel}
                                models={orderedModels}
                                disabled={modelsLoading}
                                onChange={(value) => {
                                  updateConfigDraft((draft) => ({ ...draft, model: value }));
                                }}
                              />
                              <CursorModelSelector
                                label="Opus (Most capable)"
                                description="Complex reasoning and highest quality responses."
                                value={effectiveOpusModel}
                                models={orderedModels}
                                disabled={modelsLoading}
                                allowDefaultFallback
                                onChange={(value) => {
                                  updateConfigDraft((draft) => ({ ...draft, opus_model: value }));
                                }}
                              />
                              <CursorModelSelector
                                label="Sonnet (Balanced)"
                                description="General coding and day-to-day chat workloads."
                                value={effectiveSonnetModel}
                                models={orderedModels}
                                disabled={modelsLoading}
                                allowDefaultFallback
                                onChange={(value) => {
                                  updateConfigDraft((draft) => ({ ...draft, sonnet_model: value }));
                                }}
                              />
                              <CursorModelSelector
                                label="Haiku (Fast)"
                                description="Low-latency and lightweight request paths."
                                value={effectiveHaikuModel}
                                models={orderedModels}
                                disabled={modelsLoading}
                                allowDefaultFallback
                                onChange={(value) => {
                                  updateConfigDraft((draft) => ({ ...draft, haiku_model: value }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="settings"
                      className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
                    >
                      <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6">
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium">Runtime Settings</h3>

                            <div className="space-y-2">
                              <Label htmlFor="cursor-port" className="text-xs">
                                Port
                              </Label>
                              <Input
                                id="cursor-port"
                                type="number"
                                min={1}
                                max={65535}
                                className="max-w-[150px] h-8"
                                value={effectivePort}
                                onChange={(e) => {
                                  updateConfigDraft((draft) => ({
                                    ...draft,
                                    port: e.target.value,
                                  }));
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <Label htmlFor="cursor-auto-start" className="text-xs">
                                  Auto-start Daemon
                                </Label>
                                <p className="text-[10px] text-muted-foreground">
                                  Start Cursor daemon automatically when integration is used.
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
                              <div className="space-y-0.5">
                                <Label htmlFor="cursor-ghost-mode" className="text-xs">
                                  Ghost Mode
                                </Label>
                                <p className="text-[10px] text-muted-foreground">
                                  Request `x-ghost-mode` to reduce telemetry.
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
                          </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="info"
                      className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
                    >
                      <ScrollArea className="h-full">
                        <div className="p-4 space-y-6">
                          <div>
                            <h3 className="text-sm font-medium mb-3">Available Models</h3>
                            {modelsLoading ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading models...
                              </div>
                            ) : models.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No model metadata available yet. Start daemon and refresh.
                              </p>
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
                                    {model.id === currentModel && <Badge>Default</Badge>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                              <span className="font-medium text-muted-foreground">Provider</span>
                              <span className="font-mono">Cursor IDE</span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                              <span className="font-medium text-muted-foreground">File Path</span>
                              <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                                {rawSettings?.path ?? '~/.ccs/cursor.settings.json'}
                              </code>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Model mapping writes `ANTHROPIC_MODEL`,
                              `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, and
                              `ANTHROPIC_DEFAULT_HAIKU_MODEL` in `cursor.settings.json`.
                            </p>
                          </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>

              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0 h-[45px]">
                  <Code2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Raw Configuration (JSON)
                  </span>
                </div>
                <RawEditorSection
                  rawJsonContent={effectiveRawConfigText}
                  isRawJsonValid={isRawJsonValid}
                  rawJsonEdits={rawConfigDirty ? rawConfigText : null}
                  rawSettingsEnv={rawSettings?.settings?.env}
                  onChange={(value) => {
                    setRawConfigDirty(true);
                    setRawConfigText(value);
                  }}
                />
              </div>
            </div>
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
