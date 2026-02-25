import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileCode2,
  Folder,
  GripVertical,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { useDroid } from '@/hooks/use-droid';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeEditor } from '@/components/shared/code-editor';
import { cn } from '@/lib/utils';

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
  } = useDroid();

  const [copied, setCopied] = useState(false);

  const copyRawSettings = async () => {
    if (!rawSettings?.rawText) return;
    await navigator.clipboard.writeText(rawSettings.rawText);
    setCopied(true);
    toast.success('Droid settings copied to clipboard');
    window.setTimeout(() => setCopied(false), 1500);
  };

  const refreshAll = async () => {
    await Promise.all([refetchDiagnostics(), refetchRawSettings()]);
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
              {[diagnostics.files.settings, diagnostics.files.globalConfig].map((file) => (
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
              {diagnostics.docsReference.notes.map((note) => (
                <p key={note} className="text-muted-foreground">
                  - {note}
                </p>
              ))}
              <Separator />
              <p className="text-xs text-muted-foreground">
                Provider values: {diagnostics.docsReference.providerValues.join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">
                Settings hierarchy: {diagnostics.docsReference.settingsHierarchy.join(' -> ')}
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
          <div className="h-full flex flex-col">
            <div className="p-4 border-b bg-background flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-primary" />
                  Droid BYOK Settings
                </h2>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {rawSettings?.path || '~/.factory/settings.json'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRawSettings}
                  disabled={!rawSettings?.rawText}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm" onClick={refreshAll}>
                  <RefreshCw
                    className={cn(
                      'h-4 w-4',
                      diagnosticsLoading || rawSettingsLoading ? 'animate-spin' : ''
                    )}
                  />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {rawSettingsLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading settings.json...
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {rawSettings?.parseError && (
                    <div className="mx-4 mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                      Parse warning: {rawSettings.parseError}
                    </div>
                  )}
                  <div className="flex-1 p-4 pt-3">
                    <div className="h-full rounded-md border overflow-hidden bg-background">
                      <CodeEditor
                        value={rawSettings?.rawText || '{}'}
                        onChange={() => {}}
                        language="json"
                        readonly
                        minHeight="100%"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
