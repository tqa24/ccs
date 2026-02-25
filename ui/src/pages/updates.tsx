import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Filter, Megaphone, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SupportEntryCard } from '@/components/updates/support-entry-card';
import { SupportStatusBadge } from '@/components/updates/support-status-badge';
import {
  CLI_SUPPORT_ENTRIES,
  SUPPORT_NOTICES,
  SUPPORT_SCOPE_LABELS,
  formatCatalogDate,
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

export function UpdatesPage() {
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [query, setQuery] = useState('');

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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Card className="gap-4 border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-background to-cyan-50/70 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-cyan-950/10">
        <CardHeader className="gap-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            CCS Updates Center
          </CardTitle>
          <CardDescription>
            Release visibility for runtime support, CLIProxy providers, and integration readiness.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant="info">
            <BellRing className="h-4 w-4" />
            <AlertDescription>
              This page is data-driven. Update one catalog file to publish new support notices
              across dashboard surfaces.
            </AlertDescription>
          </Alert>

          <div className="grid gap-2 md:grid-cols-3">
            <code className="rounded bg-blue-100/70 px-2 py-1.5 text-xs dark:bg-blue-900/30">
              ccsd glm
            </code>
            <code className="rounded bg-blue-100/70 px-2 py-1.5 text-xs dark:bg-blue-900/30">
              ccs codex --target droid "your prompt"
            </code>
            <code className="rounded bg-blue-100/70 px-2 py-1.5 text-xs dark:bg-blue-900/30">
              ccs cliproxy create mycodex --provider codex --target droid
            </code>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Announcements</h2>
          <span className="text-xs text-muted-foreground">{SUPPORT_NOTICES.length} published</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {SUPPORT_NOTICES.map((notice) => (
            <Card key={notice.id} className="gap-4">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{notice.title}</CardTitle>
                    <CardDescription>{notice.summary}</CardDescription>
                  </div>
                  <SupportStatusBadge status={notice.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCatalogDate(notice.publishedAt)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {notice.highlights.map((highlight) => (
                    <li key={`${notice.id}-${highlight}`}>{highlight}</li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  {notice.routes.map((route) => (
                    <Link
                      key={`${notice.id}-${route.path}`}
                      to={route.path}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {route.label}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Support Matrix</h2>
            <p className="text-sm text-muted-foreground">
              Search by CLI/provider and filter by support surface.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by command, provider, or note"
              className="pl-8"
            />
          </div>
        </div>

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
          <span className="text-xs text-muted-foreground">{filteredEntries.length} entries</span>
        </div>

        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No support entries match this filter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredEntries.map((entry) => (
              <SupportEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle className="text-base">Maintainer Notes</CardTitle>
          <CardDescription>
            Keep update messaging in one place for future CLI expansions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Edit{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">
              ui/src/lib/support-updates-catalog.ts
            </code>{' '}
            to add new notices or support entries.
          </p>
          <p>
            Home spotlight and this page consume the same catalog, so announcements stay consistent
            without repeated UI edits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
