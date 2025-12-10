/**
 * Anomaly Alert Badge Component
 *
 * Displays detected usage anomalies with visual indicators.
 * Shows high input, I/O ratio, cost spikes, and cache read alerts.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, ChevronDown, Zap, Gauge, DollarSign, Database } from 'lucide-react';
import type { Anomaly, AnomalySummary, AnomalyType } from '@/hooks/use-usage';
import { cn } from '@/lib/utils';

interface AnomalyAlertBadgeProps {
  anomalies: Anomaly[];
  summary: AnomalySummary;
  className?: string;
}

const ANOMALY_CONFIG: Record<
  AnomalyType,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  high_input: { icon: Zap, color: 'text-yellow-600', label: 'High Input' },
  high_io_ratio: { icon: Gauge, color: 'text-orange-600', label: 'High I/O Ratio' },
  cost_spike: { icon: DollarSign, color: 'text-red-600', label: 'Cost Spike' },
  high_cache_read: { icon: Database, color: 'text-cyan-600', label: 'Heavy Caching' },
};

export function AnomalyAlertBadge({ anomalies, summary, className }: AnomalyAlertBadgeProps) {
  const [open, setOpen] = useState(false);

  if (summary.totalAnomalies === 0) {
    return (
      <Badge variant="outline" className={cn('gap-1', className)}>
        <span className="text-green-600">No anomalies</span>
      </Badge>
    );
  }

  // Get unique anomaly types for badges
  const anomalyTypes = new Set(anomalies.map((a) => a.type));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2 h-8', className)}>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{summary.totalAnomalies} anomalies</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h4 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Detected Anomalies
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Unusual usage patterns detected in the selected period
          </p>
        </div>

        {/* Summary badges */}
        <div className="p-3 border-b flex flex-wrap gap-2">
          {Array.from(anomalyTypes).map((type) => {
            const config = ANOMALY_CONFIG[type];
            const Icon = config.icon;
            const count = anomalies.filter((a) => a.type === type).length;
            return (
              <Badge key={type} variant="secondary" className="gap-1">
                <Icon className={cn('h-3 w-3', config.color)} />
                {count} {config.label}
              </Badge>
            );
          })}
        </div>

        {/* Anomaly list */}
        <div className="max-h-[300px] overflow-y-auto">
          {anomalies.slice(0, 10).map((anomaly, index) => {
            const config = ANOMALY_CONFIG[anomaly.type];
            const Icon = config.icon;

            return (
              <div
                key={index}
                className="p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn('h-4 w-4 mt-0.5', config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{anomaly.date}</span>
                      {anomaly.model && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {truncateModel(anomaly.model)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{anomaly.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {anomalies.length > 10 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              +{anomalies.length - 10} more anomalies
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function truncateModel(model: string): string {
  if (model.length <= 20) return model;
  // Try to extract the meaningful part
  const parts = model.split('-');
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('-') + '...';
  }
  return model.slice(0, 17) + '...';
}
