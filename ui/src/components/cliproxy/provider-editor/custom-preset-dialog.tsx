/**
 * Custom Preset Dialog
 * Configure all model mappings at once with save option
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Star, Zap } from 'lucide-react';
import { FlexibleModelSelector } from '../provider-model-selector';
import type { CustomPresetDialogProps, ModelMappingValues } from './types';

export function CustomPresetDialog({
  open,
  onClose,
  currentValues,
  onApply,
  onSave,
  isSaving,
  catalog,
  allModels,
}: CustomPresetDialogProps) {
  const [values, setValues] = useState<ModelMappingValues>(currentValues);
  const [presetName, setPresetName] = useState('');

  // Reset values when dialog opens with current values
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setValues(currentValues);
      setPresetName('');
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Custom Preset
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name (optional)</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., My Custom Config"
              className="text-sm"
            />
          </div>
          <Separator />
          {catalog?.provider === 'codex' && (
            <p className="text-[11px] text-muted-foreground rounded-md border bg-muted/30 px-2.5 py-2">
              Codex tip: suffixes <code>-medium</code>, <code>-high</code>, and <code>-xhigh</code>{' '}
              pin effort. Unsuffixed models use Thinking settings.
            </p>
          )}
          <FlexibleModelSelector
            label="Default Model"
            description="Used when no specific tier is requested"
            value={values.default}
            onChange={(model) => setValues({ ...values, default: model })}
            catalog={catalog}
            allModels={allModels}
          />
          <FlexibleModelSelector
            label="Opus (Most capable)"
            description="For complex reasoning tasks"
            value={values.opus}
            onChange={(model) => setValues({ ...values, opus: model })}
            catalog={catalog}
            allModels={allModels}
          />
          <FlexibleModelSelector
            label="Sonnet (Balanced)"
            description="Balance of speed and capability"
            value={values.sonnet}
            onChange={(model) => setValues({ ...values, sonnet: model })}
            catalog={catalog}
            allModels={allModels}
          />
          <FlexibleModelSelector
            label="Haiku (Fast)"
            description="Quick responses for simple tasks"
            value={values.haiku}
            onChange={(model) => setValues({ ...values, haiku: model })}
            catalog={catalog}
            allModels={allModels}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {onSave && (
            <Button
              variant="secondary"
              onClick={() => onSave(values, presetName || undefined)}
              disabled={isSaving || !presetName.trim()}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Star className="w-4 h-4 mr-1" />
              )}
              Save Preset
            </Button>
          )}
          <Button onClick={() => onApply(values, presetName || undefined)}>
            <Zap className="w-4 h-4 mr-1" />
            Apply Preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
