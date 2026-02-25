export interface CompatibleCliDocLink {
  id: string;
  label: string;
  url: string;
  category: 'overview' | 'configuration' | 'byok' | 'reference';
  source: 'factory' | 'provider';
  description: string;
}

export interface CompatibleCliProviderDocLink {
  provider: string;
  label: string;
  apiFormat: string;
  url: string;
}

export interface CompatibleCliDocsReference {
  providerValues: string[];
  settingsHierarchy: string[];
  notes: string[];
  links: CompatibleCliDocLink[];
  providerDocs: CompatibleCliProviderDocLink[];
}

interface CompatibleCliDocsRegistryEntry {
  cliId: string;
  displayName: string;
  docsReference: CompatibleCliDocsReference;
}

const COMPATIBLE_CLI_DOCS_REGISTRY: Record<string, CompatibleCliDocsRegistryEntry> = {
  droid: {
    cliId: 'droid',
    displayName: 'Droid CLI',
    docsReference: {
      providerValues: ['anthropic', 'openai', 'generic-chat-completion-api'],
      settingsHierarchy: [
        'project-level config',
        'user-level config',
        'home-level config',
        'CLI flags and env vars',
      ],
      notes: [
        'BYOK custom models are read from ~/.factory/settings.json customModels[]',
        'Factory docs mention legacy support for ~/.factory/config.json',
        'Interactive model selection uses settings.model (custom:<alias>)',
        'droid exec supports --model for one-off execution mode',
      ],
      links: [
        {
          id: 'droid-cli-overview',
          label: 'Droid CLI Overview',
          url: 'https://docs.factory.ai/cli/',
          category: 'overview',
          source: 'factory',
          description: 'Primary entry docs for setup, auth, and core CLI usage.',
        },
        {
          id: 'droid-byok-overview',
          label: 'BYOK Overview',
          url: 'https://docs.factory.ai/cli/byok/overview/',
          category: 'byok',
          source: 'factory',
          description: 'BYOK model/provider shape, provider values, and migration notes.',
        },
        {
          id: 'droid-settings-reference',
          label: 'settings.json Reference',
          url: 'https://docs.factory.ai/cli/configuration/settings/',
          category: 'configuration',
          source: 'factory',
          description: 'Supported settings keys, defaults, and allowed values.',
        },
      ],
      providerDocs: [
        {
          provider: 'anthropic',
          label: 'Anthropic Messages API',
          apiFormat: 'Messages API',
          url: 'https://docs.anthropic.com/en/api/messages',
        },
        {
          provider: 'openai',
          label: 'OpenAI Responses API',
          apiFormat: 'Responses API',
          url: 'https://platform.openai.com/docs/api-reference/responses',
        },
        {
          provider: 'generic-chat-completion-api',
          label: 'OpenAI Chat Completions Spec',
          apiFormat: 'Chat Completions API',
          url: 'https://platform.openai.com/docs/api-reference/chat',
        },
      ],
    },
  },
};

export function getCompatibleCliDocsReference(cliId: string): CompatibleCliDocsReference {
  const entry = COMPATIBLE_CLI_DOCS_REGISTRY[cliId];
  if (!entry) {
    throw new Error(`Unsupported compatible CLI docs reference: ${cliId}`);
  }
  return entry.docsReference;
}
