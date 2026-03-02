import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type NoticeProgressState } from '@/lib/updates-notice-state';
import { useTranslation } from 'react-i18next';

export function NoticeProgressBadge({
  state,
  className,
}: {
  state: NoticeProgressState;
  className?: string;
}) {
  const { t } = useTranslation();
  const meta = {
    new: {
      label: t('updates.progressNeedsAction'),
      className:
        'border-amber-300/70 bg-amber-100/70 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300',
      showDot: true,
    },
    seen: {
      label: t('updates.progressInReview'),
      className:
        'border-blue-300/70 bg-blue-100/70 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
    },
    done: {
      label: t('updates.progressDone'),
      className:
        'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
    dismissed: {
      label: t('updates.progressDismissed'),
      className:
        'border-muted-foreground/20 bg-muted text-muted-foreground dark:border-muted-foreground/30',
    },
  }[state] as { label: string; className: string; showDot?: boolean };

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
