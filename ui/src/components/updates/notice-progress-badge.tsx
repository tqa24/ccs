import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type NoticeProgressState } from '@/lib/updates-notice-state';

const NOTICE_PROGRESS_META: Record<
  NoticeProgressState,
  { label: string; className: string; showDot?: boolean }
> = {
  new: {
    label: 'Needs Action',
    className:
      'border-amber-300/70 bg-amber-100/70 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300',
    showDot: true,
  },
  seen: {
    label: 'In Review',
    className:
      'border-blue-300/70 bg-blue-100/70 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
  },
  done: {
    label: 'Done',
    className:
      'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  dismissed: {
    label: 'Dismissed',
    className:
      'border-muted-foreground/20 bg-muted text-muted-foreground dark:border-muted-foreground/30',
  },
};

export function NoticeProgressBadge({
  state,
  className,
}: {
  state: NoticeProgressState;
  className?: string;
}) {
  const meta = NOTICE_PROGRESS_META[state];

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 border text-[10px] font-medium', meta.className, className)}
    >
      {meta.showDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {meta.label}
    </Badge>
  );
}
