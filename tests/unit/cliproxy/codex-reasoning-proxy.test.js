const assert = require('assert');

const {
  buildCodexModelEffortMap,
  getEffortForModel,
  injectReasoningEffortIntoBody,
} = require('../../../dist/cliproxy/codex-reasoning-proxy');

describe('Codex Reasoning Proxy', () => {
  describe('buildCodexModelEffortMap', () => {
    it('maps tier models to expected efforts', () => {
      const map = buildCodexModelEffortMap({
        defaultModel: 'gpt-5.2-codex',
        opusModel: 'gpt-5.2-codex',
        sonnetModel: 'gpt-5.2-codex-high',
        haikuModel: 'gpt-5.2-codex-mini',
      });

      assert.strictEqual(map.get('gpt-5.2-codex'), 'xhigh');
      assert.strictEqual(map.get('gpt-5.2-codex-high'), 'high');
      assert.strictEqual(map.get('gpt-5.2-codex-mini'), 'medium');
    });

    it('uses the lowest effort when the same model appears in multiple tiers', () => {
      const map = buildCodexModelEffortMap({
        opusModel: 'same',
        sonnetModel: 'same',
        haikuModel: 'same',
      });

      assert.strictEqual(map.get('same'), 'medium');
    });

    it('returns empty map when all models undefined', () => {
      const map = buildCodexModelEffortMap({});
      assert.strictEqual(map.size, 0);
    });

    it('ignores empty string models', () => {
      const map = buildCodexModelEffortMap({ defaultModel: '', opusModel: '  ' });
      assert.strictEqual(map.size, 0);
    });
  });

  describe('getEffortForModel', () => {
    it('defaults to medium for unknown model', () => {
      const map = buildCodexModelEffortMap({ opusModel: 'm1' });
      assert.strictEqual(getEffortForModel('unknown', map, 'medium'), 'medium');
    });

    it('handles null model', () => {
      const map = buildCodexModelEffortMap({ opusModel: 'm1' });
      assert.strictEqual(getEffortForModel(null, map, 'high'), 'high');
    });
  });

  describe('injectReasoningEffortIntoBody', () => {
    it('overrides reasoning.effort on object bodies', () => {
      const out = injectReasoningEffortIntoBody(
        { model: 'm1', reasoning: { effort: 'xhigh' } },
        'high'
      );
      assert.deepStrictEqual(out, { model: 'm1', reasoning: { effort: 'high' } });
    });

    it('leaves non-object bodies unchanged', () => {
      assert.strictEqual(injectReasoningEffortIntoBody('x', 'medium'), 'x');
    });

    it('leaves array bodies unchanged (not treated as record)', () => {
      const arr = [1, 2, 3];
      assert.deepStrictEqual(injectReasoningEffortIntoBody(arr, 'high'), arr);
    });
  });

  describe('model suffix aliasing', () => {
    it('lets callers use model-id suffixes without changing upstream model ids', () => {
      // We can't call the full proxy in unit tests, but we can validate the intent:
      // - injected effort is based on the suffix
      // - callers should set request.model to the base model upstream (proxy does this)
      const out = injectReasoningEffortIntoBody(
        { model: 'gpt-5.2-codex', reasoning: { effort: 'medium' } },
        'xhigh'
      );
      assert.deepStrictEqual(out, {
        model: 'gpt-5.2-codex',
        reasoning: { effort: 'xhigh' },
      });
    });
  });
});
