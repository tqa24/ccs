import { describe, expect, it } from 'vitest';
import {
  applyAnthropicBudgetTokensToDroidByokModel,
  applyReasoningEffortToDroidByokModel,
  extractDroidByokModels,
} from '@/lib/droid-byok-custom-models';

describe('extractDroidByokModels', () => {
  it('extracts modern and legacy custom model key styles', () => {
    const settings = {
      customModels: [
        {
          displayName: 'GPT-5.2 High',
          model: 'gpt-5.2',
          provider: 'openai',
          extraArgs: {
            reasoning: { effort: 'high' },
          },
        },
      ],
      custom_models: [
        {
          model_display_name: 'GLM Legacy',
          model: 'glm-4.7',
          provider: 'generic-chat-completion-api',
          extraArgs: {
            reasoning_effort: 'medium',
          },
        },
      ],
    };

    const models = extractDroidByokModels(settings);

    expect(models).toHaveLength(2);
    expect(models[0].displayName).toBe('GPT-5.2 High');
    expect(models[0].effort).toBe('high');
    expect(models[1].displayName).toBe('GLM Legacy');
    expect(models[1].effort).toBe('medium');
  });

  it('infers anthropic effort from thinking budget tokens', () => {
    const settings = {
      customModels: [
        {
          displayName: 'Claude Thinking',
          model: 'claude-opus-4.5-thinking',
          provider: 'anthropic',
          extraArgs: {
            thinking: {
              type: 'enabled',
              budget_tokens: 30000,
            },
          },
        },
      ],
    };

    const models = extractDroidByokModels(settings);

    expect(models).toHaveLength(1);
    expect(models[0].providerKind).toBe('anthropic');
    expect(models[0].effort).toBe('high');
    expect(models[0].anthropicBudgetTokens).toBe(30000);
  });
});

describe('applyReasoningEffortToDroidByokModel', () => {
  it('updates generic provider to reasoning_effort', () => {
    const settings = {
      customModels: [
        {
          displayName: 'GLM Profile',
          model: 'glm-4.7',
          provider: 'generic-chat-completion-api',
          extraArgs: {},
        },
      ],
    };
    const modelId = extractDroidByokModels(settings)[0].id;

    const next = applyReasoningEffortToDroidByokModel(settings, modelId, 'high');

    expect(next).not.toBeNull();
    const updated = (next as { customModels: Array<Record<string, unknown>> }).customModels[0];
    expect((updated.extraArgs as Record<string, unknown>).reasoning_effort).toBe('high');
  });

  it('updates openai provider to reasoning.effort', () => {
    const settings = {
      customModels: [
        {
          displayName: 'GPT Profile',
          model: 'gpt-5.2',
          provider: 'openai',
          extraArgs: {},
        },
      ],
    };
    const modelId = extractDroidByokModels(settings)[0].id;

    const next = applyReasoningEffortToDroidByokModel(settings, modelId, 'high');

    expect(next).not.toBeNull();
    const updated = (next as { customModels: Array<Record<string, unknown>> }).customModels[0];
    const extraArgs = updated.extraArgs as Record<string, unknown>;
    expect((extraArgs.reasoning as Record<string, unknown>).effort).toBe('high');
    expect(extraArgs.reasoning_effort).toBeUndefined();
  });

  it('updates anthropic provider to thinking config with budget', () => {
    const settings = {
      customModels: [
        {
          displayName: 'Claude Profile',
          model: 'claude-opus-4.5-thinking',
          provider: 'anthropic',
          extraArgs: {},
        },
      ],
    };
    const modelId = extractDroidByokModels(settings)[0].id;

    const next = applyReasoningEffortToDroidByokModel(settings, modelId, 'high');

    expect(next).not.toBeNull();
    const updated = (next as { customModels: Array<Record<string, unknown>> }).customModels[0];
    const thinking = ((updated.extraArgs as Record<string, unknown>).thinking ?? {}) as Record<
      string,
      unknown
    >;
    expect(thinking.type).toBe('enabled');
    expect(thinking.budget_tokens).toBe(30000);
  });
});

describe('applyAnthropicBudgetTokensToDroidByokModel', () => {
  it('sets anthropic thinking budget tokens', () => {
    const settings = {
      customModels: [
        {
          displayName: 'Claude Profile',
          model: 'claude-opus-4.5-thinking',
          provider: 'anthropic',
          extraArgs: {
            thinking: { type: 'enabled', budget_tokens: 30000 },
          },
        },
      ],
    };
    const modelId = extractDroidByokModels(settings)[0].id;

    const next = applyAnthropicBudgetTokensToDroidByokModel(settings, modelId, 40960);

    expect(next).not.toBeNull();
    const updated = (next as { customModels: Array<Record<string, unknown>> }).customModels[0];
    const thinking = ((updated.extraArgs as Record<string, unknown>).thinking ?? {}) as Record<
      string,
      unknown
    >;
    expect(thinking.type).toBe('enabled');
    expect(thinking.budget_tokens).toBe(40960);
  });

  it('returns null for non-anthropic providers', () => {
    const settings = {
      customModels: [
        {
          displayName: 'GPT Profile',
          model: 'gpt-5.2',
          provider: 'openai',
          extraArgs: {},
        },
      ],
    };
    const modelId = extractDroidByokModels(settings)[0].id;

    const next = applyAnthropicBudgetTokensToDroidByokModel(settings, modelId, 40960);

    expect(next).toBeNull();
  });
});
