/**
 * Constants for Quick Setup Wizard
 * Provider display info with custom ordering for wizard UI.
 * Provider IDs must match CLIPROXY_PROVIDERS from provider-config.ts
 */

import type { ProviderOption } from './types';
import {
  type CLIProxyProvider,
  getProviderDescription,
  getProviderDisplayName,
} from '@/lib/provider-config';

/** Wizard display order - most recommended first */
const WIZARD_PROVIDER_ORDER: CLIProxyProvider[] = [
  'agy',
  'claude',
  'gemini',
  'codex',
  'qwen',
  'kimi',
  'iflow',
  'kiro',
  'ghcp',
];

export const PROVIDERS: ProviderOption[] = WIZARD_PROVIDER_ORDER.map((id) => ({
  id,
  name: getProviderDisplayName(id),
  description: getProviderDescription(id),
}));

export const ALL_STEPS = ['provider', 'auth', 'variant', 'success'];

export function getStepProgress(step: string): number {
  if (step === 'account') return 1; // Same as auth
  return ALL_STEPS.indexOf(step);
}
