import {
  ArrowRight,
  ArrowRightLeft,
  Layers3,
  Link2,
  Unlink,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HistorySyncLearningMapProps {
  isolatedCount: number;
  sharedStandardCount: number;
  deeperSharedCount: number;
  sharedGroups: string[];
  legacyTargetCount: number;
}

type StageTone = 'isolated' | 'shared' | 'deeper';

function StageCard({
  title,
  count,
  icon: Icon,
  tone,
  description,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  tone: StageTone;
  description: string;
}) {
  const toneClasses: Record<StageTone, { card: string; icon: string; count: string }> = {
    isolated: {
      card: 'border-blue-300/60 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10',
      icon: 'text-blue-700 dark:text-blue-400',
      count: 'text-blue-700 dark:text-blue-400',
    },
    shared: {
      card: 'border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10',
      icon: 'text-emerald-700 dark:text-emerald-400',
      count: 'text-emerald-700 dark:text-emerald-400',
    },
    deeper: {
      card: 'border-indigo-300/60 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-900/10',
      icon: 'text-indigo-700 dark:text-indigo-400',
      count: 'text-indigo-700 dark:text-indigo-400',
    },
  };

  return (
    <div className={cn('rounded-md border p-3', toneClasses[tone].card)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <Icon className={cn('h-4 w-4', toneClasses[tone].icon)} />
      </div>
      <p className={cn('mt-1 text-2xl font-mono font-semibold', toneClasses[tone].count)}>
        {count}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function HistorySyncLearningMap({
  isolatedCount,
  sharedStandardCount,
  deeperSharedCount,
  sharedGroups,
  legacyTargetCount,
}: HistorySyncLearningMapProps) {
  const groupsToShow = sharedGroups.length > 0 ? sharedGroups : ['default'];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">How History Sync Works</CardTitle>
          <Badge variant="outline">Learning Map</Badge>
        </div>
        <CardDescription>
          Accounts can move between modes at any time. Link/unlink is instant; Edit gives full
          control of group and continuity depth.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
          <StageCard
            title="Isolated"
            count={isolatedCount}
            icon={Unlink}
            tone="isolated"
            description="No shared history with other accounts."
          />
          <div className="hidden lg:flex justify-center text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
          </div>
          <StageCard
            title="Shared (Standard)"
            count={sharedStandardCount}
            icon={Link2}
            tone="shared"
            description="Shared project context only."
          />
          <div className="hidden lg:flex justify-center text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
          </div>
          <StageCard
            title="Shared (Deeper)"
            count={deeperSharedCount}
            icon={Waves}
            tone="deeper"
            description="Adds continuity data: session-env/file-history/todos/shell-snapshots."
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Mode Switch Actions</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">Link: Isolated -&gt; Shared</Badge>
              <Badge variant="secondary">Unlink: Shared -&gt; Isolated</Badge>
              <Badge variant="secondary">Edit: Group + Deeper</Badge>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">History Sync Group</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Accounts in the same group share the same project context bucket. Group names are
              user-defined lanes, with <code>default</code> as fallback.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {groupsToShow.map((group) => (
                <Badge key={group} variant="outline" className="font-mono text-[11px]">
                  {group}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {legacyTargetCount > 0 && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {legacyTargetCount} legacy account
            {legacyTargetCount > 1 ? 's still need' : ' still needs'} explicit confirmation. Use{' '}
            <strong>Confirm Legacy Policies</strong> in Action Center.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
