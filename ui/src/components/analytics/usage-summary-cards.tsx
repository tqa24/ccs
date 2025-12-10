/**
 * Usage Summary Cards Component
 *
 * Displays key metrics in a card grid layout.
 * Shows total tokens, cost, cache tokens, and average cost per day.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Database, FileText, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UsageSummary } from '@/hooks/use-usage';

interface UsageSummaryCardsProps {
  data?: UsageSummary;
  isLoading?: boolean;
}

export function UsageSummaryCards({ data, isLoading }: UsageSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-8 w-[80px]" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate cache cost percentage
  const cacheCost =
    (data?.tokenBreakdown?.cacheCreation?.cost ?? 0) + (data?.tokenBreakdown?.cacheRead?.cost ?? 0);
  const cacheCostPercent = data?.totalCost ? Math.round((cacheCost / data.totalCost) * 100) : 0;

  const cards = [
    {
      title: 'Total Tokens',
      value: data?.totalTokens ?? 0,
      icon: FileText,
      format: (v: number) => formatNumber(v),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      subtitle: `${formatNumber(data?.totalInputTokens ?? 0)} in / ${formatNumber(data?.totalOutputTokens ?? 0)} out`,
    },
    {
      title: 'Total Cost',
      value: data?.totalCost ?? 0,
      icon: DollarSign,
      format: (v: number) => `$${v.toFixed(2)}`,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      subtitle: `$${data?.averageCostPerDay?.toFixed(2) ?? '0.00'}/day avg`,
    },
    {
      title: 'Cache Tokens',
      value: data?.totalCacheTokens ?? 0,
      icon: Database,
      format: (v: number) => formatNumber(v),
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/20',
      subtitle: `$${cacheCost.toFixed(2)} (${cacheCostPercent}% of cost)`,
    },
    {
      title: 'Input Cost',
      value: data?.tokenBreakdown?.input?.cost ?? 0,
      icon: ArrowDownRight,
      format: (v: number) => `$${v.toFixed(2)}`,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      subtitle: `${formatNumber(data?.tokenBreakdown?.input?.tokens ?? 0)} tokens`,
    },
    {
      title: 'Output Cost',
      value: data?.tokenBreakdown?.output?.cost ?? 0,
      icon: ArrowUpRight,
      format: (v: number) => `$${v.toFixed(2)}`,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      subtitle: `${formatNumber(data?.tokenBreakdown?.output?.tokens ?? 0)} tokens`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{card.title}</p>
                  <p className="text-xl font-bold truncate">{card.format(card.value)}</p>
                  {card.subtitle && (
                    <p className="text-[10px] text-muted-foreground truncate">{card.subtitle}</p>
                  )}
                </div>
                <div className={cn('p-2 rounded-lg shrink-0', card.bgColor)}>
                  <Icon className={cn('h-4 w-4', card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Helper to format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}
