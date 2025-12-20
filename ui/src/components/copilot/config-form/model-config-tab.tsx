/**
 * Model Config Tab Content
 * Presets and model mapping configuration
 */

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import type { CopilotModel } from '@/hooks/use-copilot';
import { FREE_PRESETS, PAID_PRESETS } from './presets';
import { FlexibleModelSelector } from './model-selector';
import type { ModelPreset } from './types';

interface ModelConfigTabProps {
  currentModel: string;
  opusModel: string;
  sonnetModel: string;
  haikuModel: string;
  models: CopilotModel[];
  modelsLoading: boolean;
  onApplyPreset: (preset: ModelPreset) => void;
  onUpdateModel: (model: string) => void;
  onUpdateOpusModel: (model: string) => void;
  onUpdateSonnetModel: (model: string) => void;
  onUpdateHaikuModel: (model: string) => void;
}

export function ModelConfigTab({
  currentModel,
  opusModel,
  sonnetModel,
  haikuModel,
  models,
  modelsLoading,
  onApplyPreset,
  onUpdateModel,
  onUpdateOpusModel,
  onUpdateSonnetModel,
  onUpdateHaikuModel,
}: ModelConfigTabProps) {
  return (
    <TabsContent
      value="config"
      className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Quick Presets */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Presets
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Apply pre-configured model mappings
            </p>

            {/* Free Tier Presets */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-green-100 text-green-700 border-green-200"
                >
                  Free Tier
                </Badge>
                <span className="text-[10px] text-muted-foreground">No premium usage count</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FREE_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={() => onApplyPreset(preset)}
                    title={preset.description}
                  >
                    <Zap className="w-3 h-3 text-green-600" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Paid Tier Presets */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"
                >
                  Pro+ Required
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  Uses premium request quota
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PAID_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={() => onApplyPreset(preset)}
                    title={preset.description}
                  >
                    <Zap className="w-3 h-3" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Model Mapping */}
          <div>
            <h3 className="text-sm font-medium mb-2">Model Mapping</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Configure which models to use for each tier
            </p>
            <div className="space-y-4">
              <FlexibleModelSelector
                label="Default Model"
                description="Used when no specific tier is requested"
                value={currentModel}
                onChange={onUpdateModel}
                models={models}
                disabled={modelsLoading}
              />
              <FlexibleModelSelector
                label="Opus (Most capable)"
                description="For complex reasoning tasks"
                value={opusModel || currentModel}
                onChange={onUpdateOpusModel}
                models={models}
                disabled={modelsLoading}
              />
              <FlexibleModelSelector
                label="Sonnet (Balanced)"
                description="Balance of speed and capability"
                value={sonnetModel || currentModel}
                onChange={onUpdateSonnetModel}
                models={models}
                disabled={modelsLoading}
              />
              <FlexibleModelSelector
                label="Haiku (Fast)"
                description="Quick responses for simple tasks"
                value={haikuModel || currentModel}
                onChange={onUpdateHaikuModel}
                models={models}
                disabled={modelsLoading}
              />
            </div>
          </div>
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
