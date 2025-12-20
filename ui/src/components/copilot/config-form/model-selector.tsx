/**
 * Flexible Model Selector Component
 * Dropdown selector for Copilot models with plan badges
 */

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Check } from 'lucide-react';
import type { FlexibleModelSelectorProps } from './types';
import { getPlanBadgeStyle, getMultiplierDisplay } from './utils';

export function FlexibleModelSelector({
  label,
  description,
  value,
  onChange,
  models,
  disabled,
}: FlexibleModelSelectorProps) {
  // Find current model for display
  const currentModel = models.find((m) => m.id === value);

  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-xs font-medium">{label}</label>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select model">
            {value && (
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-xs">{value}</span>
                {currentModel?.minPlan && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 h-4 ${getPlanBadgeStyle(currentModel.minPlan)}`}
                  >
                    {currentModel.minPlan}
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectGroup>
            <SelectLabel className="text-xs text-muted-foreground">
              Available Models ({models.length})
            </SelectLabel>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{model.name || model.id}</span>
                  {model.minPlan && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${getPlanBadgeStyle(model.minPlan)}`}
                    >
                      {model.minPlan}
                    </Badge>
                  )}
                  {model.multiplier !== undefined && (
                    <span className="text-[9px] text-muted-foreground">
                      {getMultiplierDisplay(model.multiplier)}
                    </span>
                  )}
                  {model.preview && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      Preview
                    </Badge>
                  )}
                  {value === model.id && <Check className="w-3 h-3 text-primary ml-auto" />}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
