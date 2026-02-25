import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronRight, Filter, Megaphone, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SupportEntryCard } from '@/components/updates/support-entry-card';
import { SupportStatusBadge } from '@/components/updates/support-status-badge';
import {
  CLI_SUPPORT_ENTRIES,
  SUPPORT_NOTICES,
  SUPPORT_SCOPE_LABELS,
  formatCatalogDate,
  type SupportNotice,
  type SupportScope,
} from '@/lib/support-updates-catalog';

type ScopeFilter = 'all' | SupportScope;

const SCOPE_FILTERS: { id: ScopeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'target', label: SUPPORT_SCOPE_LABELS.target },
  { id: 'cliproxy', label: SUPPORT_SCOPE_LABELS.cliproxy },
  { id: 'api-profiles', label: SUPPORT_SCOPE_LABELS['api-profiles'] },
  { id: 'websearch', label: SUPPORT_SCOPE_LABELS.websearch },
];

const CORE_CONTRACT = [
  {
    id: 'base-url',
    title: 'Base URL',
    detail: 'Source endpoint is explicit per target/provider/profile.',
  },
  {
    id: 'auth',
    title: 'Auth',
    detail: 'OAuth or token ownership is visible in one support matrix.',
  },
  {
    id: 'model',
    title: 'Model',
    detail: 'Default model behavior stays configurable and documented.',
  },
] as const;

function NoticeListItem({
  notice,
  isSelected,
  onSelect,
}: {
  notice: SupportNotice;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'border-primary/20 bg-primary/10'
          : 'border-transparent hover:border-border hover:bg-muted/70'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{notice.title}</p>
          <p className="text-xs text-muted-foreground">{notice.summary}</p>
          <div className="flex items-center gap-2">
            <SupportStatusBadge status={notice.status} className="h-5 px-1.5 text-[10px]" />
            <span className="text-[10px] text-muted-foreground">
              {formatCatalogDate(notice.publishedAt)}
            </span>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground',
            isSelected && 'text-primary'
          )}
        />
      </div>
    </button>
  );
}

export function UpdatesPage() {
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(
    SUPPORT_NOTICES[0]?.id ?? null
  );

  const selectedNotice = useMemo(
    () => SUPPORT_NOTICES.find((notice) => notice.id === selectedNoticeId) ?? SUPPORT_NOTICES[0],
    [selectedNoticeId]
  );

  const filteredEntries = useMemo(() => {
    const queryValue = query.trim().toLowerCase();

    return CLI_SUPPORT_ENTRIES.filter((entry) => {
      if (scope !== 'all' && entry.scope !== scope) {
        return false;
      }

      if (!queryValue) {
        return true;
      }

      const haystack = [
        entry.name,
        entry.summary,
        entry.notes || '',
        ...entry.commands,
        ...entry.routes.map((route) => route.label),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(queryValue);
    });
  }, [scope, query]);

  const scopeStats = useMemo(
    () =>
      SCOPE_FILTERS.filter((filter) => filter.id !== 'all').map((filter) => ({
        id: filter.id,
        label: filter.label,
        count: CLI_SUPPORT_ENTRIES.filter((entry) => entry.scope === filter.id).length,
      })),
    []
  );

  return (
    <div className="h-[calc(100vh-100px)] flex">
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b bg-background">
          <div className="mb-1 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">Updates Center</h1>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Release visibility for target, provider, and support rollouts.
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search support matrix"
              className="pl-8 h-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {SUPPORT_NOTICES.map((notice) => (
              <NoticeListItem
                key={notice.id}
                notice={notice}
                isSelected={selectedNotice?.id === notice.id}
                onSelect={() => setSelectedNoticeId(notice.id)}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {SUPPORT_NOTICES.length} notice{SUPPORT_NOTICES.length !== 1 ? 's' : ''}
            </span>
            <span>
              {CLI_SUPPORT_ENTRIES.length} support entr
              {CLI_SUPPORT_ENTRIES.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-background flex flex-col">
        {selectedNotice && (
          <div className="border-b bg-background p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{selectedNotice.title}</h2>
                <p className="text-sm text-muted-foreground">{selectedNotice.summary}</p>
              </div>
              <SupportStatusBadge status={selectedNotice.status} />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BellRing className="h-3.5 w-3.5" />
              Published {formatCatalogDate(selectedNotice.publishedAt)}
            </div>

            <ul className="grid gap-1 text-sm text-muted-foreground">
              {selectedNotice.highlights.map((highlight) => (
                <li key={`${selectedNotice.id}-${highlight}`}>- {highlight}</li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              {selectedNotice.routes.map((route) => (
                <Link
                  key={`${selectedNotice.id}-${route.path}`}
                  to={route.path}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                >
                  {route.label}
                </Link>
              ))}
            </div>

            <div className="grid gap-2 lg:grid-cols-3">
              {selectedNotice.commands.map((command) => (
                <code
                  key={`${selectedNotice.id}-${command}`}
                  className="rounded bg-muted px-2 py-1.5 text-[11px]"
                >
                  {command}
                </code>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 p-4">
          <div className="h-full grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="h-full gap-3">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Support Matrix</CardTitle>
                <CardDescription>
                  Filter by support area. Internal scroll keeps the page frame stable.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 min-h-0">
                <div className="h-full flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      Scope:
                    </span>
                    {SCOPE_FILTERS.map((filter) => (
                      <Button
                        key={filter.id}
                        size="sm"
                        variant={scope === filter.id ? 'default' : 'outline'}
                        onClick={() => setScope(filter.id)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {filteredEntries.length} match
                    </span>
                  </div>

                  <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full pr-2">
                      {filteredEntries.length === 0 ? (
                        <div className="h-full grid place-items-center text-sm text-muted-foreground">
                          No support entries match this filter.
                        </div>
                      ) : (
                        <div className="grid gap-4 pb-1">
                          {filteredEntries.map((entry) => (
                            <SupportEntryCard key={entry.id} entry={entry} />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full gap-3">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Config Contract</CardTitle>
                <CardDescription>
                  Every new CLI integration follows the same three configuration pillars.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-4 pb-1">
                    <div className="grid gap-2">
                      {CORE_CONTRACT.map((item) => (
                        <div key={item.id} className="rounded-md border bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {item.title}
                          </p>
                          <p className="text-sm font-medium">{item.detail}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Coverage by Scope
                      </p>
                      <div className="grid gap-2">
                        {scopeStats.map((stat) => (
                          <div
                            key={stat.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                          >
                            <span>{stat.label}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {stat.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      Update source of truth:{' '}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        ui/src/lib/support-updates-catalog.ts
                      </code>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
