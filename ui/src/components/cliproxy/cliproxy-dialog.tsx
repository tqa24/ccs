/**
 * CLIProxy Variant Dialog Component
 * Phase 03: REST API Routes & CRUD
 * Phase 05: Dashboard UI full CRUD for composite variants
 * Phase 06: Multi-Account Support
 */

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCreateVariant, useCliproxyAuth } from '@/hooks/use-cliproxy';
import { usePrivacy } from '@/contexts/privacy-context';
import { CLIPROXY_PROVIDERS, getProviderDisplayName } from '@/lib/provider-config';

const singleProviderSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Invalid variant name'),
  provider: z.enum(CLIPROXY_PROVIDERS, { message: 'Provider is required' }),
  model: z.string().optional(),
  account: z.string().optional(),
  target: z.enum(['claude', 'droid']).default('claude'),
});

const compositeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Invalid variant name'),
  default_tier: z.enum(['opus', 'sonnet', 'haiku'], { message: 'Default tier is required' }),
  target: z.enum(['claude', 'droid']).default('claude'),
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

interface CliproxyDialogProps {
  open: boolean;
  onClose: () => void;
}

const providerOptions = CLIPROXY_PROVIDERS.map((id) => ({
  value: id,
  label: getProviderDisplayName(id),
}));

export function CliproxyDialog({ open, onClose }: CliproxyDialogProps) {
  const createMutation = useCreateVariant();
  const { data: authData } = useCliproxyAuth();
  const { privacyMode } = usePrivacy();
  const [mode, setMode] = useState<'single' | 'composite'>('single');

  const singleForm = useForm<SingleProviderFormData>({
    resolver: zodResolver(singleProviderSchema),
    defaultValues: { target: 'claude' },
  });

  const compositeForm = useForm<CompositeFormData>({
    resolver: zodResolver(compositeSchema),
    defaultValues: {
      default_tier: 'opus',
      target: 'claude',
      tiers: {
        opus: { provider: 'gemini', model: '' },
        sonnet: { provider: 'gemini', model: '' },
        haiku: { provider: 'gemini', model: '' },
      },
    },
  });

  const selectedProvider = useWatch({ control: singleForm.control, name: 'provider' });
  const providerAuth = authData?.authStatus.find((s) => s.provider === selectedProvider);
  const providerAccounts = providerAuth?.accounts || [];

  const onSubmitSingle = async (data: SingleProviderFormData) => {
    try {
      await createMutation.mutateAsync(data);
      singleForm.reset();
      onClose();
    } catch (error) {
      console.error('Failed to create variant:', error);
    }
  };

  const onSubmitComposite = async (data: CompositeFormData) => {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        provider: data.tiers[data.default_tier].provider,
        target: data.target,
        type: 'composite',
        default_tier: data.default_tier,
        tiers: data.tiers,
      });
      compositeForm.reset();
      onClose();
    } catch (error) {
      console.error('Failed to create composite variant:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create CLIProxy Variant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'single' ? 'default' : 'outline'}
              onClick={() => setMode('single')}
            >
              Single Provider
            </Button>
            <Button
              type="button"
              variant={mode === 'composite' ? 'default' : 'outline'}
              onClick={() => setMode('composite')}
            >
              Composite (Multi-Provider)
            </Button>
          </div>

          {mode === 'single' ? (
            <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...singleForm.register('name')} placeholder="my-gemini" />
                {singleForm.formState.errors.name && (
                  <span className="text-xs text-red-500">
                    {singleForm.formState.errors.name.message}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  {...singleForm.register('provider')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select provider...</option>
                  {providerOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {singleForm.formState.errors.provider && (
                  <span className="text-xs text-red-500">
                    {singleForm.formState.errors.provider.message}
                  </span>
                )}
              </div>

              {selectedProvider && providerAccounts.length > 0 && (
                <div>
                  <Label htmlFor="account">Account</Label>
                  <select
                    id="account"
                    {...singleForm.register('account')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Use default account</option>
                    {providerAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {privacyMode ? '••••••' : acc.email || acc.id}
                        {acc.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="model">Model (optional)</Label>
                <Input id="model" {...singleForm.register('model')} placeholder="gemini-2.5-pro" />
              </div>

              <div>
                <Label htmlFor="target">Default Target</Label>
                <select
                  id="target"
                  {...singleForm.register('target')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="claude">Claude Code</option>
                  <option value="droid">Factory Droid</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={compositeForm.handleSubmit(onSubmitComposite)} className="space-y-4">
              <div>
                <Label htmlFor="comp-name">Name</Label>
                <Input
                  id="comp-name"
                  {...compositeForm.register('name')}
                  placeholder="my-composite"
                />
                {compositeForm.formState.errors.name && (
                  <span className="text-xs text-red-500">
                    {compositeForm.formState.errors.name.message}
                  </span>
                )}
              </div>

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
                        <Label htmlFor={`${tier}-provider`}>Provider</Label>
                        <select
                          id={`${tier}-provider`}
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
                        <Label htmlFor={`${tier}-model`}>Model</Label>
                        <Input
                          id={`${tier}-model`}
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
                        <Label htmlFor={`${tier}-account`}>Account (optional)</Label>
                        <Input
                          id={`${tier}-account`}
                          {...compositeForm.register(`tiers.${tier}.account`)}
                          placeholder="account-id"
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <div>
                <Label htmlFor="default-tier">Default Tier</Label>
                <select
                  id="default-tier"
                  {...compositeForm.register('default_tier')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="opus">Opus</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="haiku">Haiku</option>
                </select>
              </div>

              <div>
                <Label htmlFor="composite-target">Default Target</Label>
                <select
                  id="composite-target"
                  {...compositeForm.register('target')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="claude">Claude Code</option>
                  <option value="droid">Factory Droid</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
