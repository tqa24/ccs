import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Folder,
  GripVertical,
  Loader2,
  Server,
  ShieldCheck,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { useDroid } from '@/hooks/use-droid';
import { isApiConflictError } from '@/lib/api-client';
import { RawJsonSettingsEditorPanel } from '@/components/compatible-cli/raw-json-settings-editor-panel';
import {
  DroidSettingsQuickControlsCard,
  type DroidQuickSettingsValues,
} from '@/components/compatible-cli/droid-settings-quick-controls-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const DEFAULT_DROID_FACTORY_DOC_LINKS = [
  {
    id: 'droid-cli-overview',
    label: 'Droid CLI Overview',
    url: 'https://docs.factory.ai/cli/',
    description: 'Primary entry docs for setup, auth, and core CLI usage.',
  },
  {
    id: 'droid-byok-overview',
    label: 'BYOK Overview',
    url: 'https://docs.factory.ai/cli/byok/overview/',
    description: 'BYOK model/provider shape, provider values, and migration notes.',
  },
  {
    id: 'droid-settings-reference',
    label: 'settings.json Reference',
    url: 'https://docs.factory.ai/cli/configuration/settings/',
    description: 'Supported settings keys, defaults, and allowed values.',
  },
];

const DEFAULT_DROID_PROVIDER_DOC_LINKS = [
  {
    provider: 'anthropic',
    label: 'Anthropic Messages API',
    apiFormat: 'Messages API',
    url: 'https://docs.anthropic.com/en/api/messages',
  },
  {
    provider: 'openai',
    label: 'OpenAI Responses API',
    apiFormat: 'Responses API',
    url: 'https://platform.openai.com/docs/api-reference/responses',
  },
  {
    provider: 'generic-chat-completion-api',
    label: 'OpenAI Chat Completions Spec',
    apiFormat: 'Chat Completions API',
    url: 'https://platform.openai.com/docs/api-reference/chat',
  },
];

function renderTextWithLinks(text: string): ReactNode[] {
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text)) !== null) {
    const [url] = match;
    const index = match.index;

    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }

    nodes.push(
      <a
        key={`${url}-${index}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {url}
      </a>
    );
    cursor = index + url.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return 'N/A';
  return new Date(value).toLocaleString();
}

function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function parseJsonObjectText(
  text: string
): { valid: true; value: Record<string, unknown> } | { valid: false; error: string } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'JSON root must be an object.' };
    }
    return { valid: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

function asStringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBooleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-right break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

export function DroidPage() {
  const {
    diagnostics,
    diagnosticsLoading,
    diagnosticsError,
    refetchDiagnostics,
    rawSettings,
    rawSettingsLoading,
    refetchRawSettings,
    saveRawSettingsAsync,
    isSavingRawSettings,
  } = useDroid();

  const [rawDraftText, setRawDraftText] = useState<string | null>(null);
  const rawBaseText = rawSettings?.rawText ?? '{}';
  const rawEditorText = rawDraftText ?? rawBaseText;
  const rawConfigDirty = rawDraftText !== null && rawDraftText !== rawBaseText;
  const rawEditorParsed = parseJsonObjectText(rawEditorText);
  const rawEditorValidation = rawEditorParsed.valid
    ? { valid: true as const }
    : { valid: false as const, error: rawEditorParsed.error };

  const setRawEditorDraftText = (nextText: string) => {
    if (nextText === rawBaseText) {
      setRawDraftText(null);
      return;
    }
    setRawDraftText(nextText);
  };

  const updateSettingsField = (key: string, value: unknown | null) => {
    if (!rawEditorParsed.valid) {
      toast.error('Fix JSON syntax before using quick settings controls.');
      return;
    }

    const nextSettings = { ...rawEditorParsed.value };
    if (value === null || value === undefined) {
      delete nextSettings[key];
    } else {
      nextSettings[key] = value;
    }
    setRawEditorDraftText(JSON.stringify(nextSettings, null, 2) + '\n');
  };

  const quickSettingsValues: DroidQuickSettingsValues = rawEditorParsed.valid
    ? {
        reasoningEffort: asStringValue(rawEditorParsed.value.reasoningEffort),
        autonomyLevel: asStringValue(rawEditorParsed.value.autonomyLevel),
        diffMode: asStringValue(rawEditorParsed.value.diffMode),
        maxTurns: asNumberValue(rawEditorParsed.value.maxTurns),
        maxToolCalls: asNumberValue(rawEditorParsed.value.maxToolCalls),
        autoCompactThreshold: asNumberValue(rawEditorParsed.value.autoCompactThreshold),
        todoEnabled: asBooleanValue(rawEditorParsed.value.todoEnabled),
        todoAutoRefresh: asBooleanValue(rawEditorParsed.value.todoAutoRefresh),
        autoCompactEnabled: asBooleanValue(rawEditorParsed.value.autoCompactEnabled),
        soundEnabled: asBooleanValue(rawEditorParsed.value.soundEnabled),
      }
    : {
        reasoningEffort: null,
        autonomyLevel: null,
        diffMode: null,
        maxTurns: null,
        maxToolCalls: null,
        autoCompactThreshold: null,
        todoEnabled: null,
        todoAutoRefresh: null,
        autoCompactEnabled: null,
        soundEnabled: null,
      };

  const refreshAll = async () => {
    await Promise.all([refetchDiagnostics(), refetchRawSettings()]);
  };

  const handleSaveRawSettings = async () => {
    if (!rawEditorValidation.valid) {
      toast.error(`Invalid JSON: ${rawEditorValidation.error}`);
      return;
    }

    try {
      await saveRawSettingsAsync({
        rawText: rawEditorText,
        expectedMtime: rawSettings?.exists ? rawSettings.mtime : undefined,
      });
      setRawDraftText(null);
      await Promise.all([refetchDiagnostics(), refetchRawSettings()]);
      toast.success('Droid settings saved');
    } catch (error) {
      if (isApiConflictError(error)) {
        toast.error('Droid settings changed externally. Refresh and retry.');
      } else {
        toast.error((error as Error).message || 'Failed to save Droid settings');
      }
    }
  };

  const customModels = diagnostics?.byok.customModels ?? [];
  const providerRows = useMemo(
    () => Object.entries(diagnostics?.byok.providerBreakdown ?? {}).sort((a, b) => b[1] - a[1]),
    [diagnostics?.byok.providerBreakdown]
  );

  const renderOverview = () => {
    if (diagnosticsLoading) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading Droid diagnostics...
        </div>
      );
    }

    if (diagnosticsError || !diagnostics) {
      return (
        <div className="flex h-full items-center justify-center text-destructive px-6 text-center">
          Failed to load Droid diagnostics.
        </div>
      );
    }

    const docsReference = diagnostics.docsReference ?? {
      notes: [],
      links: [],
      providerDocs: [],
      providerValues: [],
      settingsHierarchy: [],
    };
    const docsNotes = docsReference.notes ?? [];
    const docsLinksRaw = docsReference.links ?? [];
    const providerDocsRaw = docsReference.providerDocs ?? [];
    const docsLinks = docsLinksRaw.length > 0 ? docsLinksRaw : DEFAULT_DROID_FACTORY_DOC_LINKS;
    const providerDocs =
      providerDocsRaw.length > 0 ? providerDocsRaw : DEFAULT_DROID_PROVIDER_DOC_LINKS;
    const providerValues = docsReference.providerValues ?? [];
    const settingsHierarchy = docsReference.settingsHierarchy ?? [];

    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TerminalSquare className="h-4 w-4" />
                Runtime & Installation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={diagnostics.binary.installed ? 'default' : 'secondary'}>
                  {diagnostics.binary.installed ? 'Detected' : 'Not Found'}
                </Badge>
              </div>
              <DetailRow label="Detection source" value={diagnostics.binary.source} mono />
              <DetailRow
                label="Binary path"
                value={diagnostics.binary.path || 'Not detected'}
                mono
              />
              <DetailRow
                label="Install directory"
                value={diagnostics.binary.installDir || 'N/A'}
                mono
              />
              <DetailRow label="Version" value={diagnostics.binary.version || 'Unknown'} mono />
              <DetailRow
                label="Override (CCS_DROID_PATH)"
                value={diagnostics.binary.overridePath || 'Not set'}
                mono
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Config Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[diagnostics.files.settings, diagnostics.files.legacyConfig].map((file) => (
                <div key={file.label} className="rounded-md border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{file.label}</span>
                    {file.exists ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <DetailRow label="Path" value={file.path} mono />
                  <DetailRow label="Resolved" value={file.resolvedPath} mono />
                  <DetailRow label="Size" value={formatBytes(file.sizeBytes)} />
                  <DetailRow label="Last modified" value={formatTimestamp(file.mtimeMs)} />
                  {file.parseError && (
                    <p className="text-xs text-amber-600">Parse warning: {file.parseError}</p>
                  )}
                  {file.readError && (
                    <p className="text-xs text-destructive">Read warning: {file.readError}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <DroidSettingsQuickControlsCard
            values={quickSettingsValues}
            disabled={rawSettingsLoading || !rawEditorParsed.valid}
            disabledReason={
              rawEditorParsed.valid ? null : `Quick settings disabled: ${rawEditorParsed.error}`
            }
            onEnumSettingChange={(key, value) => {
              updateSettingsField(key, value);
            }}
            onBooleanSettingChange={(key, value) => {
              updateSettingsField(key, value);
            }}
            onNumberSettingChange={(key, value) => {
              updateSettingsField(key, value);
            }}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" />
                BYOK Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label="Active model selector"
                value={diagnostics.byok.activeModelSelector || 'Not set'}
                mono
              />
              <DetailRow label="Custom models" value={String(diagnostics.byok.customModelCount)} />
              <DetailRow label="CCS-managed" value={String(diagnostics.byok.ccsManagedCount)} />
              <DetailRow label="User-managed" value={String(diagnostics.byok.userManagedCount)} />
              <DetailRow
                label="Malformed entries"
                value={String(diagnostics.byok.invalidModelEntryCount)}
              />
              <Separator />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Providers</p>
                <div className="flex flex-wrap gap-1.5">
                  {providerRows.length === 0 && (
                    <Badge variant="secondary" className="font-mono">
                      none
                    </Badge>
                  )}
                  {providerRows.map(([provider, count]) => (
                    <Badge key={provider} variant="outline" className="font-mono text-xs">
                      {provider}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Docs-Aligned Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {docsNotes.map((note, index) => (
                <p key={`${index}-${note}`} className="text-muted-foreground">
                  - {renderTextWithLinks(note)}
                </p>
              ))}
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Factory Docs
                </p>
                <div className="space-y-1.5">
                  {docsLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border px-2.5 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{link.label}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{link.description}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground/90 underline underline-offset-2">
                        {link.url}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Provider Fact-Check Docs
                </p>
                <div className="space-y-1.5">
                  {providerDocs.map((providerDoc) => (
                    <a
                      key={`${providerDoc.provider}-${providerDoc.url}`}
                      href={providerDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border px-2.5 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{providerDoc.label}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        provider: {providerDoc.provider} | format: {providerDoc.apiFormat}
                      </p>
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground/90 underline underline-offset-2">
                        {providerDoc.url}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Provider values: {providerValues.join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">
                Settings hierarchy: {settingsHierarchy.join(' -> ')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Custom Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_2fr] bg-muted/40 px-3 py-2 text-xs font-medium">
                  <span>Name / Model</span>
                  <span>Provider</span>
                  <span>Base URL</span>
                </div>
                <ScrollArea className="h-52">
                  <div className="divide-y">
                    {customModels.length === 0 && (
                      <div className="px-3 py-4 text-xs text-muted-foreground">
                        No custom models
                      </div>
                    )}
                    {customModels.map((model) => (
                      <div
                        key={`${model.displayName}-${model.model}-${model.baseUrl}`}
                        className="grid grid-cols-[2fr_1fr_2fr] gap-2 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{model.displayName}</p>
                          <p className="text-muted-foreground font-mono truncate">{model.model}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{model.provider}</p>
                          <p className="text-muted-foreground">{model.apiKeyPreview || 'no-key'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate" title={model.baseUrl}>
                            {model.host || model.baseUrl}
                          </p>
                          <p className="text-muted-foreground font-mono truncate">
                            {model.baseUrl}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {diagnostics.warnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {diagnostics.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-amber-800 dark:text-amber-300">
                    - {warning}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] overflow-hidden">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={45} minSize={35}>
          <div className="h-full border-r bg-muted/20">{renderOverview()}</div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center group">
          <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
        </PanelResizeHandle>
        <Panel defaultSize={55} minSize={35}>
          <RawJsonSettingsEditorPanel
            title="Droid BYOK Settings"
            pathLabel={rawSettings?.path || '~/.factory/settings.json'}
            loading={rawSettingsLoading}
            parseWarning={rawSettings?.parseError}
            value={rawEditorText}
            dirty={rawConfigDirty}
            saving={isSavingRawSettings}
            saveDisabled={
              !rawConfigDirty ||
              isSavingRawSettings ||
              rawSettingsLoading ||
              !rawEditorValidation.valid
            }
            onChange={(next) => {
              setRawEditorDraftText(next);
            }}
            onSave={handleSaveRawSettings}
            onRefresh={refreshAll}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
