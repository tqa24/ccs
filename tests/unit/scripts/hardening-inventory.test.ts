import { describe, expect, test } from 'bun:test';

const { collectSyncCallSites } = require('../../../scripts/hardening-inventory.js');

describe('hardening-inventory sync call scanning', () => {
  test('ignores sync-call names inside regex literals after else', () => {
    const source = [
      'if (enabled) {',
      '  run();',
      '} else /fs\\.readFileSync\\(/.test("pattern");',
    ].join('\n');

    const result = collectSyncCallSites(source);
    expect(result.count).toBe(0);
  });

  test('ignores sync-call names inside regex literals after do', () => {
    const source = 'do /fs\\.writeFileSync\\(/.test("pattern"); while (false);';
    const result = collectSyncCallSites(source);

    expect(result.count).toBe(0);
  });

  test('still counts real sync fs call sites', () => {
    const source = [
      'if (enabled) {',
      '  run();',
      '} else /fs\\.readFileSync\\(/.test("pattern");',
      'fs.readFileSync("file.txt", "utf8");',
    ].join('\n');

    const result = collectSyncCallSites(source);
    expect(result.count).toBe(1);
    expect(result.calls).toEqual(['readFileSync']);
  });
});
