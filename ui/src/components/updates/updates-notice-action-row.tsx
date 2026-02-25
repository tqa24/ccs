import { Link } from 'react-router-dom';
import { ArrowUpRight, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { type SupportNoticeAction } from '@/lib/support-updates-catalog';

export function UpdatesNoticeActionRow({ action }: { action: SupportNoticeAction }) {
  const isRouteAction = action.type === 'route' && action.path;
  const isCommandAction = action.type === 'command' && action.command;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{action.label}</p>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>

        {isRouteAction && (
          <Button size="sm" asChild>
            <Link to={action.path}>
              Open
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      {isCommandAction && (
        <div className="mt-2 flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate text-[11px]">{action.command}</code>
          <CopyButton value={action.command} />
        </div>
      )}
    </div>
  );
}
