/**
 * Flow Visualization Header Component
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ChevronRight, Eye, EyeOff, RotateCcw } from 'lucide-react';

interface FlowVizHeaderProps {
  onBack?: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
  hasCustomPositions: boolean;
  onResetPositions: () => void;
}

export function FlowVizHeader({
  onBack,
  showDetails,
  onToggleDetails,
  hasCustomPositions,
  onResetPositions,
}: FlowVizHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      {onBack ? (
        <button
          onClick={onBack}
          className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200 px-3 py-1.5 rounded-md hover:bg-muted/50 border border-transparent hover:border-border/50"
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5" />
          <span>{t('flowViz.backToProviders')}</span>
        </button>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleDetails}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium transition-all duration-200 px-3 py-1.5 rounded-md border shadow-sm',
            showDetails
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-background text-muted-foreground hover:text-foreground border-border/60 hover:border-border hover:bg-muted/50'
          )}
        >
          {showDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showDetails ? t('flowViz.hideDetails') : t('flowViz.showDetails')}</span>
        </button>
        {hasCustomPositions && (
          <button
            onClick={onResetPositions}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200 px-3 py-1.5 rounded-md border border-border/60 hover:border-border bg-background hover:bg-muted/50 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('flowViz.resetLayout')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
