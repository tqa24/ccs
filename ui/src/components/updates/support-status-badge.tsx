import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SupportStatus } from '@/lib/support-updates-catalog';

const STATUS_LABELS: Record<SupportStatus, string> = {
  new: 'New',
  stable: 'Stable',
  planned: 'Planned',
};

const STATUS_STYLES: Record<SupportStatus, string> = {
  new: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300',
  stable:
    'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
  planned:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300',
};

export function SupportStatusBadge({
  status,
  className,
}: {
  status: SupportStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
