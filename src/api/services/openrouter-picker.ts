/**
 * OpenRouter Interactive Model Picker
 * CLI interface for browsing and selecting OpenRouter models
 */

import { InteractivePrompt } from '../../utils/prompt';
import { table, info, warn, color, dim, spinner } from '../../utils/ui';
import {
  fetchOpenRouterModels,
  searchModels,
  formatPricingPair,
  formatContext,
  type OpenRouterModel,
} from './openrouter-catalog';

export interface OpenRouterSelection {
  model: string;
  tierMapping?: {
    opus?: string;
    sonnet?: string;
    haiku?: string;
  };
}

/** Interactive model picker */
export async function pickOpenRouterModel(): Promise<OpenRouterSelection | null> {
  // Fetch models with spinner
  const s = await spinner('Fetching OpenRouter models...');

  let models: OpenRouterModel[];
  try {
    models = await fetchOpenRouterModels();
    s.succeed(`Loaded ${models.length} models from OpenRouter`);
  } catch (error) {
    s.fail(`Failed to fetch models: ${(error as Error).message}`);
    return null;
  }

  // Search loop
  let selectedModel: OpenRouterModel | null = null;

  while (!selectedModel) {
    const query = await InteractivePrompt.input('Search models (or press Enter to see popular)', {
      default: '',
    });

    const results = searchModels(models, query);

    if (results.length === 0) {
      console.log(warn('No models found. Try a different search term.'));
      continue;
    }

    // Display results in table
    console.log('');
    const rows = results.map((m, i) => [
      String(i + 1),
      m.id.length > 35 ? m.id.slice(0, 32) + '...' : m.id,
      formatPricingPair(m.pricing),
      formatContext(m.context_length),
    ]);

    console.log(
      table(rows, {
        head: ['#', 'Model ID', 'Price (prompt/completion)', 'Context'],
      })
    );
    console.log('');

    // Get selection
    const selection = await InteractivePrompt.input(
      `Select model [1-${results.length}] or search again`,
      { default: '1' }
    );

    const index = parseInt(selection, 10) - 1;
    if (index >= 0 && index < results.length) {
      selectedModel = results[index];
    } else if (selection.trim()) {
      // Treat as new search
      const newResults = searchModels(models, selection);
      if (newResults.length === 1) {
        selectedModel = newResults[0];
      }
    }
  }

  console.log('');
  console.log(info(`Selected: ${color(selectedModel.id, 'info')}`));

  // Ask about tier mapping
  const configureTiers = await InteractivePrompt.confirm(
    'Configure model tier mapping (opus/sonnet/haiku)?',
    { default: false }
  );

  if (!configureTiers) {
    return { model: selectedModel.id };
  }

  // Tier mapping
  console.log('');
  console.log(dim('Leave blank to skip a tier.'));

  const tierMapping = {
    opus: await InteractivePrompt.input('Opus tier model', {
      default: suggestTier(selectedModel.id, 'opus', models),
    }),
    sonnet: await InteractivePrompt.input('Sonnet tier model', {
      default: selectedModel.id,
    }),
    haiku: await InteractivePrompt.input('Haiku tier model', {
      default: suggestTier(selectedModel.id, 'haiku', models),
    }),
  };

  // Clean empty values
  const cleanMapping = {
    opus: tierMapping.opus || undefined,
    sonnet: tierMapping.sonnet || undefined,
    haiku: tierMapping.haiku || undefined,
  };

  return {
    model: selectedModel.id,
    tierMapping: cleanMapping,
  };
}

/** Suggest tier model based on provider */
function suggestTier(
  selectedId: string,
  tier: 'opus' | 'haiku',
  models: OpenRouterModel[]
): string {
  const [provider] = selectedId.split('/');
  const providerModels = models.filter((m) => m.id.startsWith(`${provider}/`));

  if (providerModels.length < 2) return '';

  // Sort by price
  const sorted = [...providerModels].sort((a, b) => {
    const priceA = parseFloat(a.pricing.prompt) || 0;
    const priceB = parseFloat(b.pricing.prompt) || 0;
    return priceB - priceA; // Descending
  });

  if (tier === 'opus') {
    return sorted[0]?.id ?? '';
  } else {
    return sorted[sorted.length - 1]?.id ?? '';
  }
}
