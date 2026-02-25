export type SupportStatus = 'new' | 'stable' | 'planned';

export type SupportScope = 'target' | 'cliproxy' | 'api-profiles' | 'websearch';

export interface SupportRouteHint {
  label: string;
  path: string;
}

export interface SupportNotice {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  status: SupportStatus;
  highlights: string[];
  routes: SupportRouteHint[];
  commands: string[];
}

export interface CliSupportEntry {
  id: string;
  name: string;
  scope: SupportScope;
  status: SupportStatus;
  summary: string;
  pillars: {
    baseUrl: string;
    auth: string;
    model: string;
  };
  routes: SupportRouteHint[];
  commands: string[];
  notes?: string;
}

export const SUPPORT_SCOPE_LABELS: Record<SupportScope, string> = {
  target: 'Target CLI',
  cliproxy: 'CLIProxy Provider',
  'api-profiles': 'API Profile',
  websearch: 'WebSearch',
};

export const SUPPORT_NOTICES: SupportNotice[] = [
  {
    id: 'droid-target-support',
    title: 'Factory Droid support is live',
    summary:
      'API Profiles and CLIProxy variants now support Droid as a first-class execution target.',
    publishedAt: '2026-02-25',
    status: 'new',
    highlights: [
      'Set default target to Droid when creating or editing API Profiles.',
      'Set default target to Droid for CLIProxy variants, including Codex and Antigravity flows.',
      'Use ccsd alias or --target droid for one-off target overrides.',
    ],
    routes: [
      { label: 'API Profiles', path: '/providers' },
      { label: 'CLIProxy', path: '/cliproxy' },
    ],
    commands: [
      'ccsd glm',
      'ccs codex --target droid "your prompt"',
      'ccs cliproxy create mycodex --provider codex --target droid',
    ],
  },
  {
    id: 'updates-center-launch',
    title: 'Updates Center added to dashboard navigation',
    summary:
      'CCS now has a dedicated updates route so support announcements are visible and reusable.',
    publishedAt: '2026-02-25',
    status: 'new',
    highlights: [
      'Single data source powers Home spotlight and Updates Center page.',
      'New support entries can be added without touching multiple pages.',
      'Catalog includes targets, CLIProxy providers, and WebSearch integrations.',
    ],
    routes: [{ label: 'Updates Center', path: '/updates' }],
    commands: ['ccs config'],
  },
];

export const CLI_SUPPORT_ENTRIES: CliSupportEntry[] = [
  {
    id: 'claude-target',
    name: 'Claude Code',
    scope: 'target',
    status: 'stable',
    summary: 'Default runtime target for all CCS profile types.',
    pillars: {
      baseUrl: 'From profile settings (ANTHROPIC_BASE_URL)',
      auth: 'From profile settings (ANTHROPIC_AUTH_TOKEN)',
      model: 'From profile settings (ANTHROPIC_MODEL)',
    },
    routes: [
      { label: 'API Profiles', path: '/providers' },
      { label: 'CLIProxy', path: '/cliproxy' },
    ],
    commands: ['ccs', 'ccs glm "your prompt"'],
  },
  {
    id: 'droid-target',
    name: 'Factory Droid',
    scope: 'target',
    status: 'new',
    summary: 'First-class target for API Profiles and CLIProxy variants.',
    pillars: {
      baseUrl: 'From profile or variant settings',
      auth: 'From profile or variant settings',
      model: 'From profile or variant settings',
    },
    routes: [
      { label: 'API Profiles', path: '/providers' },
      { label: 'CLIProxy', path: '/cliproxy' },
    ],
    commands: ['ccsd glm', 'ccs km --target droid', 'ccs codex --target droid'],
    notes: 'Use ccsd alias for automatic Droid target selection.',
  },
  {
    id: 'codex-cliproxy',
    name: 'Codex via CLIProxy',
    scope: 'cliproxy',
    status: 'stable',
    summary: 'OAuth-backed provider with configurable variant model and target.',
    pillars: {
      baseUrl: 'Managed by CLIProxy backend',
      auth: 'OAuth account via CLIProxy auth flow',
      model: 'Selectable per provider or variant',
    },
    routes: [
      { label: 'CLIProxy', path: '/cliproxy' },
      { label: 'Control Panel', path: '/cliproxy/control-panel' },
    ],
    commands: ['ccs codex', 'ccs cliproxy create mycodex --provider codex'],
  },
  {
    id: 'gemini-cliproxy',
    name: 'Gemini via CLIProxy',
    scope: 'cliproxy',
    status: 'stable',
    summary: 'OAuth-backed Gemini provider with multi-account management.',
    pillars: {
      baseUrl: 'Managed by CLIProxy backend',
      auth: 'OAuth account via CLIProxy auth flow',
      model: 'Selectable per provider or variant',
    },
    routes: [
      { label: 'CLIProxy', path: '/cliproxy' },
      { label: 'Control Panel', path: '/cliproxy/control-panel' },
    ],
    commands: ['ccs gemini', 'ccs cliproxy create mygem --provider gemini'],
  },
  {
    id: 'agy-cliproxy',
    name: 'Antigravity via CLIProxy',
    scope: 'cliproxy',
    status: 'stable',
    summary: 'OAuth-backed Antigravity provider with variant target controls.',
    pillars: {
      baseUrl: 'Managed by CLIProxy backend',
      auth: 'OAuth account via CLIProxy auth flow',
      model: 'Selectable per provider or variant',
    },
    routes: [
      { label: 'CLIProxy', path: '/cliproxy' },
      { label: 'Control Panel', path: '/cliproxy/control-panel' },
    ],
    commands: ['ccs agy', 'ccs cliproxy create myagy --provider agy --target droid'],
  },
  {
    id: 'custom-api-profiles',
    name: 'Custom API Profiles',
    scope: 'api-profiles',
    status: 'stable',
    summary: 'Any Anthropic-compatible endpoint with per-profile target and model mapping.',
    pillars: {
      baseUrl: 'User-defined endpoint',
      auth: 'User-defined token/key',
      model: 'User-defined model identifier',
    },
    routes: [{ label: 'API Profiles', path: '/providers' }],
    commands: ['ccs api create myprofile', 'ccs myprofile "your prompt"'],
  },
  {
    id: 'opencode-websearch',
    name: 'OpenCode WebSearch',
    scope: 'websearch',
    status: 'stable',
    summary: 'WebSearch provider surfaced in Settings for third-party profile workflows.',
    pillars: {
      baseUrl: 'Managed by OpenCode CLI integration',
      auth: 'Provider-specific (managed externally)',
      model: 'Configurable in WebSearch settings',
    },
    routes: [{ label: 'Settings', path: '/settings' }],
    commands: ['ccs config', 'ccs codex "your prompt"'],
    notes: 'Enable OpenCode in Settings > WebSearch to activate fallback search.',
  },
];

export function getLatestSupportNotice(): SupportNotice | null {
  if (SUPPORT_NOTICES.length === 0) {
    return null;
  }

  return [...SUPPORT_NOTICES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
}

export function formatCatalogDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}
