/**
 * Variant Creation Step
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIVACY_BLUR_CLASS } from '@/contexts/privacy-context';
import { MODEL_CATALOGS } from '@/lib/model-catalogs';
import type { VariantStepProps } from '../types';

const CUSTOM_MODEL_VALUE = '__custom__';

export function VariantStep({
  selectedProvider,
  selectedAccount,
  variantName,
  modelName,
  isPending,
  privacyMode,
  onVariantNameChange,
  onModelChange,
  onBack,
  onSkip,
  onCreate,
}: VariantStepProps) {
  // Track if user selected custom model option
  const catalogModels = MODEL_CATALOGS[selectedProvider]?.models || [];
  const isCustomModel = modelName && !catalogModels.some((m) => m.id === modelName);
  const [showCustomInput, setShowCustomInput] = useState(isCustomModel);

  const handleModelSelect = (value: string) => {
    if (value === CUSTOM_MODEL_VALUE) {
      setShowCustomInput(true);
      onModelChange(''); // Clear to let user type custom
    } else {
      setShowCustomInput(false);
      onModelChange(value);
    }
  };

  return (
    <div className="space-y-4">
      {selectedAccount && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
          <User className="w-4 h-4" />
          <span>
            Using:{' '}
            <span className={cn(privacyMode && PRIVACY_BLUR_CLASS)}>
              {selectedAccount.email || selectedAccount.id}
            </span>
          </span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="variant-name">Variant Name *</Label>
        <Input
          id="variant-name"
          value={variantName}
          onChange={(e) => onVariantNameChange(e.target.value)}
          placeholder="e.g., my-gemini, g3, flash"
        />
        <div className="text-xs text-muted-foreground">
          Use this name to invoke: ccs {variantName || '<name>'} "prompt"
        </div>
      </div>

      <div className="space-y-2">
        <Label>Model</Label>
        {showCustomInput ? (
          <div className="space-y-2">
            <Input
              value={modelName}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="e.g., gemini-2.5-pro, claude-opus-4-5"
            />
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setShowCustomInput(false)}
            >
              Choose from presets instead
            </button>
          </div>
        ) : (
          <Select
            value={catalogModels.some((m) => m.id === modelName) ? modelName : ''}
            onValueChange={handleModelSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {catalogModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <span>{m.name}</span>
                    {m.description && (
                      <span className="text-xs text-muted-foreground">- {m.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_MODEL_VALUE}>
                <span className="text-primary">Custom model name...</span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="text-xs text-muted-foreground">
          {showCustomInput
            ? 'Enter any model name supported by CLIProxy'
            : `Default: ${MODEL_CATALOGS[selectedProvider]?.defaultModel || 'provider default'}`}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button onClick={onCreate} disabled={!variantName || isPending}>
            {isPending ? 'Creating...' : 'Create Variant'}
          </Button>
        </div>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Skip if you just wanted to add an account without creating a variant
      </p>
    </div>
  );
}
