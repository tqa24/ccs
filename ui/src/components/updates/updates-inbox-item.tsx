import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCatalogDate, type SupportNotice } from '@/lib/support-updates-catalog';
import { type NoticeProgressState } from '@/lib/updates-notice-state';
import { NoticeProgressBadge } from './notice-progress-badge';

export function UpdatesInboxItem({
  notice,
  progress,
  selected,
  onSelect,
}: {
  notice: SupportNotice;
  progress: NoticeProgressState;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border px-3 py-3 text-left transition-colors',
        selected
          ? 'border-primary/30 bg-primary/10'
          : 'border-transparent bg-background/40 hover:border-border hover:bg-muted/70'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">{notice.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{notice.primaryAction}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {formatCatalogDate(notice.publishedAt)}
        </span>
        <NoticeProgressBadge state={progress} />
      </div>
    </button>
  );
}
