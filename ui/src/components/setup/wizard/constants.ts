/**
 * Constants for Quick Setup Wizard
 * Provider display info with custom ordering for wizard UI.
 * Provider IDs must match CLIPROXY_PROVIDERS from provider-config.ts
 */

import type { ProviderOption } from './types';
import type { CLIProxyProvider } from '@/lib/provider-config';

/** Provider display info for wizard - ordered by recommendation */
const PROVIDER_INFO: Record<CLIProxyProvider, { name: string; description: string }> = {
  agy: { name: 'Antigravity', description: 'Antigravity AI models' },
  claude: { name: 'Claude (Anthropic)', description: 'Claude Opus/Sonnet models' },
  gemini: { name: 'Google Gemini', description: 'Gemini Pro/Flash models' },
  codex: { name: 'OpenAI Codex', description: 'GPT-4 and codex models' },
  qwen: { name: 'Alibaba Qwen', description: 'Qwen Code models' },
  iflow: { name: 'iFlow', description: 'iFlow AI models' },
  kiro: { name: 'Kiro (AWS)', description: 'AWS CodeWhisperer models' },
  ghcp: { name: 'GitHub Copilot (OAuth)', description: 'GitHub Copilot via OAuth' },
  kimi: { name: 'Kimi (Moonshot)', description: 'Moonshot AI K2/K2.5 models' },
};

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
  name: PROVIDER_INFO[id].name,
  description: PROVIDER_INFO[id].description,
}));

export const ALL_STEPS = ['provider', 'auth', 'variant', 'success'];

export function getStepProgress(step: string): number {
  if (step === 'account') return 1; // Same as auth
  return ALL_STEPS.indexOf(step);
}
