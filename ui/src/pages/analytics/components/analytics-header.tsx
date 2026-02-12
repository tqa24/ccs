/**
 * Analytics Header Component
 *
 * Title, date filter, 24H button, and refresh controls.
 */

import type { DateRange } from 'react-day-picker';
import { subDays, startOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/analytics/date-range-filter';
import { RefreshCw } from 'lucide-react';

interface AnalyticsHeaderProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onTodayClick: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdatedText: string | null;
  viewMode: 'daily' | 'hourly';
}

export function AnalyticsHeader({
  dateRange,
  onDateRangeChange,
  onTodayClick,
  onRefresh,
  isRefreshing,
  lastUpdatedText,
  viewMode,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-col gap-3 shrink-0 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track usage & insights</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <Button
          variant={viewMode === 'hourly' ? 'default' : 'outline'}
          size="sm"
          className="h-8"
          onClick={onTodayClick}
        >
          24H
        </Button>
        <DateRangeFilter
          className="flex-wrap"
          value={dateRange}
          onChange={onDateRangeChange}
          presets={[
            { label: '7D', range: { from: subDays(new Date(), 7), to: new Date() } },
            { label: '30D', range: { from: subDays(new Date(), 30), to: new Date() } },
            { label: 'Month', range: { from: startOfMonth(new Date()), to: new Date() } },
            { label: 'All Time', range: { from: undefined, to: new Date() } },
          ]}
        />

        {lastUpdatedText && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Updated {lastUpdatedText}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
