/**
 * CLIProxy Variant Edit Dialog Component
 * Phase 05: Dashboard UI full CRUD for composite variants
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUpdateVariant } from '@/hooks/use-cliproxy';
import { CLIPROXY_PROVIDERS, getProviderDisplayName } from '@/lib/provider-config';
import type { Variant } from '@/lib/api-client';

const singleProviderSchema = z.object({
  provider: z.enum(CLIPROXY_PROVIDERS, { message: 'Provider is required' }),
  model: z.string().optional(),
  account: z.string().optional(),
  target: z.enum(['claude', 'droid']),
});

const compositeSchema = z.object({
  default_tier: z.enum(['opus', 'sonnet', 'haiku'], { message: 'Default tier is required' }),
  target: z.enum(['claude', 'droid']),
  tiers: z.object({
    opus: z.object({
      provider: z.enum(CLIPROXY_PROVIDERS, { message: 'Provider is required' }),
      model: z.string().trim().min(1, 'Model is required'),
      account: z.string().optional(),
    }),
    sonnet: z.object({
      provider: z.enum(CLIPROXY_PROVIDERS, { message: 'Provider is required' }),
      model: z.string().trim().min(1, 'Model is required'),
      account: z.string().optional(),
    }),
    haiku: z.object({
      provider: z.enum(CLIPROXY_PROVIDERS, { message: 'Provider is required' }),
      model: z.string().trim().min(1, 'Model is required'),
      account: z.string().optional(),
    }),
  }),
});

type SingleProviderFormData = z.infer<typeof singleProviderSchema>;
type CompositeFormData = z.infer<typeof compositeSchema>;

interface CliproxyEditDialogProps {
  variant: Variant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const providerOptions = CLIPROXY_PROVIDERS.map((id) => ({
  value: id,
  label: getProviderDisplayName(id),
}));

export function CliproxyEditDialog({ variant, open, onOpenChange }: CliproxyEditDialogProps) {
  const updateMutation = useUpdateVariant();
  const isComposite = variant?.type === 'composite';

  const singleForm = useForm<SingleProviderFormData>({
    resolver: zodResolver(singleProviderSchema),
  });

  const compositeForm = useForm<CompositeFormData>({
    resolver: zodResolver(compositeSchema),
  });

  // Pre-populate form when variant changes
  useEffect(() => {
    if (!variant) return;

    if (isComposite && variant.tiers && variant.default_tier) {
      const mapTier = (t: { provider: string; model: string; account?: string }) => ({
        provider: t.provider as (typeof CLIPROXY_PROVIDERS)[number],
        model: t.model,
        account: t.account || '',
      });
      compositeForm.reset({
        default_tier: variant.default_tier,
        target: variant.target || 'claude',
        tiers: {
          opus: mapTier(variant.tiers.opus),
          sonnet: mapTier(variant.tiers.sonnet),
          haiku: mapTier(variant.tiers.haiku),
        },
      });
    } else {
      singleForm.reset({
        provider: variant.provider,
        model: variant.model ?? undefined,
        account: variant.account ?? undefined,
        target: variant.target || 'claude',
      });
    }
  }, [variant, isComposite, singleForm, compositeForm]);

  const onSubmitSingle = async (data: SingleProviderFormData) => {
    if (!variant) return;
    // Filter out undefined values - backend interprets undefined as "no change"
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined && v !== '')
    ) as SingleProviderFormData;
    try {
      await updateMutation.mutateAsync({ name: variant.name, data: payload });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update variant:', error);
    }
  };

  const onSubmitComposite = async (data: CompositeFormData) => {
    if (!variant) return;
    try {
      await updateMutation.mutateAsync({
        name: variant.name,
        data: {
          default_tier: data.default_tier,
          target: data.target,
          tiers: data.tiers,
        },
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update composite variant:', error);
    }
  };

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {isComposite ? 'Composite' : 'Single'} Variant: {variant.name}
          </DialogTitle>
        </DialogHeader>

        {isComposite ? (
          <form onSubmit={compositeForm.handleSubmit(onSubmitComposite)} className="space-y-4">
            <div>
              <Label>Tier Configuration</Label>
              <Tabs defaultValue="opus" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="opus">Opus</TabsTrigger>
                  <TabsTrigger value="sonnet">Sonnet</TabsTrigger>
                  <TabsTrigger value="haiku">Haiku</TabsTrigger>
                </TabsList>
                {(['opus', 'sonnet', 'haiku'] as const).map((tier) => (
                  <TabsContent key={tier} value={tier} className="space-y-3">
                    <div>
                      <Label htmlFor={`edit-${tier}-provider`}>Provider</Label>
                      <select
                        id={`edit-${tier}-provider`}
                        {...compositeForm.register(`tiers.${tier}.provider`)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {providerOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`edit-${tier}-model`}>Model</Label>
                      <Input
                        id={`edit-${tier}-model`}
                        {...compositeForm.register(`tiers.${tier}.model`)}
                        placeholder="model-id"
                      />
                      {compositeForm.formState.errors.tiers?.[tier]?.model && (
                        <span className="text-xs text-red-500">
                          {compositeForm.formState.errors.tiers[tier]?.model?.message}
                        </span>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`edit-${tier}-account`}>Account (optional)</Label>
                      <Input
                        id={`edit-${tier}-account`}
                        {...compositeForm.register(`tiers.${tier}.account`)}
                        placeholder="account-id"
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div>
              <Label htmlFor="edit-default-tier">Default Tier</Label>
              <select
                id="edit-default-tier"
                {...compositeForm.register('default_tier')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="opus">Opus</option>
                <option value="sonnet">Sonnet</option>
                <option value="haiku">Haiku</option>
              </select>
            </div>

            <div>
              <Label htmlFor="edit-composite-target">Default Target</Label>
              <select
                id="edit-composite-target"
                {...compositeForm.register('target')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="claude">Claude Code</option>
                <option value="droid">Factory Droid</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-4">
            <div>
              <Label htmlFor="edit-provider">Provider</Label>
              <select
                id="edit-provider"
                {...singleForm.register('provider')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="edit-model">Model</Label>
              <Input id="edit-model" {...singleForm.register('model')} placeholder="model-id" />
            </div>

            <div>
              <Label htmlFor="edit-account">Account (optional)</Label>
              <Input
                id="edit-account"
                {...singleForm.register('account')}
                placeholder="account-id"
              />
            </div>

            <div>
              <Label htmlFor="edit-target">Default Target</Label>
              <select
                id="edit-target"
                {...singleForm.register('target')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="claude">Claude Code</option>
                <option value="droid">Factory Droid</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
