import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, Filter, Megaphone, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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
        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
        isSelected
          ? 'border-primary/20 bg-primary/10'
          : 'border-transparent hover:border-border hover:bg-muted/70'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{notice.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatCatalogDate(notice.publishedAt)}
          </p>
        </div>
        <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground')} />
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

  return (
    <div className="h-[calc(100vh-100px)] flex overflow-hidden">
      <div className="w-80 border-r bg-muted/30 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-background">
          <div className="mb-1 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">Updates</h1>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Product announcements and release notes.
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search updates or integrations"
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
              {filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-background grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        {selectedNotice && (
          <div className="border-b bg-background px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight">{selectedNotice.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedNotice.summary}</p>
              </div>
              <SupportStatusBadge status={selectedNotice.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Published {formatCatalogDate(selectedNotice.publishedAt)}</span>
            </div>
          </div>
        )}

        <div className="min-h-0 p-4">
          <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] overflow-hidden">
            <Card className="h-full gap-3 overflow-hidden">
              <CardHeader className="gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Release Details</CardTitle>
                </div>
                <CardDescription>
                  Changelog-first view with impacted integrations and quick commands.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 min-h-0">
                <div className="h-full flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      Filter:
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
                      {filteredEntries.length} integration{filteredEntries.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <ScrollArea className="flex-1 min-h-0 pr-2">
                    <div className="space-y-4 pb-1">
                      <section className="space-y-2">
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          What Changed
                        </h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {selectedNotice?.highlights.map((highlight) => (
                            <li key={`${selectedNotice.id}-${highlight}`}>- {highlight}</li>
                          ))}
                        </ul>
                      </section>

                      <section className="space-y-2">
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Dashboard Entry Points
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedNotice?.routes.map((route) => (
                            <Link
                              key={`${selectedNotice.id}-${route.path}`}
                              to={route.path}
                              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                            >
                              {route.label}
                            </Link>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-2">
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Quick Commands
                        </h3>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {selectedNotice?.commands.map((command) => (
                            <code
                              key={`${selectedNotice.id}-${command}`}
                              className="rounded bg-muted px-2 py-1.5 text-[11px]"
                            >
                              {command}
                            </code>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-2">
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Impacted Integrations
                        </h3>
                        {filteredEntries.length === 0 ? (
                          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            No integration entries match your current filter.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {filteredEntries.map((entry) => (
                              <div key={entry.id} className="rounded-md border bg-muted/20 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{entry.name}</p>
                                    <p className="text-xs text-muted-foreground">{entry.summary}</p>
                                  </div>
                                  <SupportStatusBadge
                                    status={entry.status}
                                    className="h-5 px-1.5 text-[10px]"
                                  />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                    {SUPPORT_SCOPE_LABELS[entry.scope]}
                                  </Badge>
                                  {entry.routes.map((route) => (
                                    <Link
                                      key={`${entry.id}-${route.path}`}
                                      to={route.path}
                                      className="rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                                    >
                                      {route.label}
                                    </Link>
                                  ))}
                                </div>
                                <code className="mt-2 block rounded bg-muted px-2 py-1 text-[11px]">
                                  {entry.commands[0]}
                                </code>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full gap-3 overflow-hidden">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Announcement Timeline</CardTitle>
                <CardDescription>Recent notices in chronological order.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-2 pb-1">
                    {SUPPORT_NOTICES.map((notice) => (
                      <button
                        key={`timeline-${notice.id}`}
                        type="button"
                        onClick={() => setSelectedNoticeId(notice.id)}
                        className={cn(
                          'w-full rounded-md border p-3 text-left transition-colors',
                          selectedNotice?.id === notice.id
                            ? 'border-primary/20 bg-primary/10'
                            : 'hover:bg-muted/70'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{notice.title}</p>
                          <SupportStatusBadge
                            status={notice.status}
                            className="h-5 px-1.5 text-[10px]"
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{notice.summary}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatCatalogDate(notice.publishedAt)}
                        </p>
                      </button>
                    ))}

                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
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
