/**
 * Cache Efficiency Card Component
 *
 * Displays cache usage metrics including hit rate, savings estimate,
 * and cache read/write breakdown.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, TrendingUp, Zap } from 'lucide-react';
import type { UsageSummary } from '@/hooks/use-usage';
import { cn } from '@/lib/utils';

interface CacheEfficiencyCardProps {
  data: UsageSummary | undefined;
  isLoading?: boolean;
  className?: string;
}

export function CacheEfficiencyCard({ data, isLoading, className }: CacheEfficiencyCardProps) {
  const metrics = useMemo(() => {
    if (!data) return null;

    const totalCacheTokens = data.totalCacheCreationTokens + data.totalCacheReadTokens;
    const cacheHitRate =
      totalCacheTokens > 0 ? (data.totalCacheReadTokens / totalCacheTokens) * 100 : 0;

    // Estimate savings: cache reads cost ~90% less than regular input
    // Savings = cacheReadTokens * (inputRate - cacheReadRate)
    const inputCost = data.tokenBreakdown.input.cost;
    const inputTokens = data.tokenBreakdown.input.tokens || 1;
    const cacheReadCost = data.tokenBreakdown.cacheRead.cost;
    const cacheReadTokens = data.tokenBreakdown.cacheRead.tokens || 1;

    const inputRate = inputTokens > 0 ? inputCost / (inputTokens / 1_000_000) : 0;
    const cacheReadRate = cacheReadTokens > 0 ? cacheReadCost / (cacheReadTokens / 1_000_000) : 0;

    const estimatedSavings =
      inputRate > 0 && cacheReadRate < inputRate
        ? (data.totalCacheReadTokens / 1_000_000) * (inputRate - cacheReadRate)
        : 0;

    return {
      cacheHitRate,
      estimatedSavings: Math.max(0, estimatedSavings),
      totalCacheReads: data.totalCacheReadTokens,
      totalCacheWrites: data.totalCacheCreationTokens,
      totalCacheTokens,
      cacheCost: data.tokenBreakdown.cacheRead.cost + data.tokenBreakdown.cacheCreation.cost,
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardHeader className="px-3 py-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 flex-1">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalCacheTokens === 0) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardHeader className="px-3 py-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Database className="w-4 h-4" />
            Cache Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground text-center">No cache data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col h-full shadow-sm', className)}>
      <CardHeader className="px-3 py-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="w-4 h-4" />
          Cache Efficiency
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 flex flex-col justify-center gap-3">
        {/* Primary metric: Savings */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-5 h-5" />
            <span className="text-2xl font-bold">${metrics.estimatedSavings.toFixed(2)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
            Estimated Savings
          </p>
        </div>

        {/* Secondary metrics row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Cache Hit Rate */}
          <div className="p-2 rounded-md bg-muted/50 border text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-lg font-bold">{metrics.cacheHitRate.toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hit Rate</p>
          </div>

          {/* Cache Cost */}
          <div className="p-2 rounded-md bg-muted/50 border text-center">
            <span className="text-lg font-bold">${metrics.cacheCost.toFixed(2)}</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cache Cost</p>
          </div>
        </div>

        {/* Cache breakdown bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Reads: {formatCompact(metrics.totalCacheReads)}</span>
            <span>Writes: {formatCompact(metrics.totalCacheWrites)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full"
              style={{
                backgroundColor: '#9e2a2b',
                width: `${(metrics.totalCacheReads / metrics.totalCacheTokens) * 100}%`,
              }}
              title={`Cache Reads: ${metrics.totalCacheReads.toLocaleString()}`}
            />
            <div
              className="h-full"
              style={{
                backgroundColor: '#e09f3e',
                width: `${(metrics.totalCacheWrites / metrics.totalCacheTokens) * 100}%`,
              }}
              title={`Cache Writes: ${metrics.totalCacheWrites.toLocaleString()}`}
            />
          </div>
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9e2a2b' }} />
              Read
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#e09f3e' }} />
              Write
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCompact(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}
