import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSharedItems, useSharedSummary } from '@/hooks/use-shared';
import { FileText, Sparkles, Bot, AlertTriangle, Search } from 'lucide-react';

type TabType = 'commands' | 'skills' | 'agents';

export function SharedPage() {
  const [tab, setTab] = useState<TabType>('commands');
  const [query, setQuery] = useState('');
  const { data: summary } = useSharedSummary();
  const { data: items, isLoading } = useSharedItems(tab);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    const allItems = items?.items ?? [];
    if (!normalizedQuery) {
      return allItems;
    }

    return allItems.filter((item) =>
      [item.name, item.description, item.path].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [items, normalizedQuery]);

  const tabs: { id: TabType; label: string; icon: typeof FileText; count: number }[] = [
    { id: 'commands', label: 'Commands', icon: FileText, count: summary?.commands ?? 0 },
    { id: 'skills', label: 'Skills', icon: Sparkles, count: summary?.skills ?? 0 },
    { id: 'agents', label: 'Agents', icon: Bot, count: summary?.agents ?? 0 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Shared Data</h1>
        <p className="text-muted-foreground">
          Commands, skills, and agents shared across Claude instances
        </p>
      </div>

      {summary && !summary.symlinkStatus.valid && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription>
            {summary.symlinkStatus.message}. Run `ccs sync` to configure.
          </AlertDescription>
        </Alert>
      )}

      {/* Tab buttons */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setTab(t.id);
              setQuery('');
            }}
            className="flex items-center gap-2"
          >
            <t.icon className="w-4 h-4" />
            {t.label} ({t.count})
          </Button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${tab} by name, description, or path`}
          className="pl-9"
        />
      </div>

      {/* Content */}
      <div className="mt-4">
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-muted-foreground">No {tab} found</div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.map((item) => (
              <Card key={item.name}>
                <CardContent>
                  <div className="font-medium">{item.name}</div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-2 font-mono truncate">
                    {item.path}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
