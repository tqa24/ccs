import { AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LogsConfigCard } from '@/components/logs/logs-config-card';
import { LogsDetailPanel } from '@/components/logs/logs-detail-panel';
import { LogsEntryList } from '@/components/logs/logs-entry-list';
import { LogsFilters } from '@/components/logs/logs-filters';
import { LogsOverviewCards } from '@/components/logs/logs-overview-cards';
import { LogsPageSkeleton } from '@/components/logs/logs-page-skeleton';
import { getSourceLabelMap, useLogsWorkspace, useUpdateLogsConfig } from '@/hooks/use-logs';

export function LogsPage() {
  const workspace = useLogsWorkspace();
  const updateConfig = useUpdateLogsConfig();
  const sourceLabels = getSourceLabelMap(workspace.sourcesQuery.data ?? []);
  const errors = [
    workspace.configQuery.error,
    workspace.sourcesQuery.error,
    workspace.entriesQuery.error,
  ].filter(Boolean) as Error[];

  if (workspace.isInitialLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <LogsPageSkeleton />
      </div>
    );
  }

  const config = workspace.configQuery.data;
  if (!config) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-background via-background to-muted/40 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">System logs</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Unified CCS logging</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Watch current CCS activity across native and legacy emitters, inspect structured
                context, and keep retention policy aligned with what the host actually stores.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => workspace.entriesQuery.refetch()}
            >
              <RefreshCw
                className={workspace.entriesQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              />
              Refresh entries
            </Button>
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/health">
                Open health checks
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to fully load the logs workspace</AlertTitle>
          <AlertDescription>{errors[0]?.message}</AlertDescription>
        </Alert>
      ) : null}

      <LogsOverviewCards
        config={config}
        sources={workspace.sourcesQuery.data ?? []}
        entries={workspace.entriesQuery.data ?? []}
        latestTimestamp={workspace.latestTimestamp}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_22rem]">
        <div className="space-y-6">
          <LogsFilters
            sources={workspace.sourcesQuery.data ?? []}
            selectedSource={workspace.selectedSource}
            onSourceChange={workspace.setSelectedSource}
            selectedLevel={workspace.selectedLevel}
            onLevelChange={workspace.setSelectedLevel}
            search={workspace.search}
            onSearchChange={workspace.setSearch}
            limit={workspace.limit}
            onLimitChange={workspace.setLimit}
            onRefresh={() =>
              void Promise.all([workspace.sourcesQuery.refetch(), workspace.entriesQuery.refetch()])
            }
            isRefreshing={workspace.entriesQuery.isFetching || workspace.sourcesQuery.isFetching}
          />

          <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <LogsEntryList
              entries={workspace.entriesQuery.data ?? []}
              selectedEntryId={workspace.selectedEntryId}
              onSelect={workspace.setSelectedEntryId}
              sourceLabels={sourceLabels}
              isLoading={workspace.entriesQuery.isLoading}
              isFetching={workspace.entriesQuery.isFetching}
            />
            <LogsDetailPanel
              entry={workspace.selectedEntry}
              sourceLabel={
                workspace.selectedEntry ? sourceLabels[workspace.selectedEntry.source] : undefined
              }
            />
          </div>
        </div>

        <LogsConfigCard
          config={config}
          onSave={(payload) => updateConfig.mutate(payload)}
          isPending={updateConfig.isPending}
        />
      </div>
    </div>
  );
}
