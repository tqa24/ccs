/**
 * Default Port Sync Test
 *
 * Keeps backend and UI default ports in sync while allowing independent modules.
 */

import { describe, expect, test } from 'bun:test';
import { CLIPROXY_DEFAULT_PORT as BACKEND_CLIPROXY_DEFAULT_PORT } from '../../../src/cliproxy/config/port-manager';
import { DEFAULT_CURSOR_PORT as BACKEND_CURSOR_DEFAULT_PORT } from '../../../src/cursor/cursor-models';
import {
  CLIPROXY_DEFAULT_PORT as UI_CLIPROXY_DEFAULT_PORT,
  DEFAULT_CURSOR_PORT as UI_CURSOR_DEFAULT_PORT,
} from '../../../ui/src/lib/default-ports';

describe('Default Port Sync', () => {
  test('CLIProxy default port is synced between backend and UI', () => {
    expect(UI_CLIPROXY_DEFAULT_PORT).toBe(BACKEND_CLIPROXY_DEFAULT_PORT);
  });

  test('Cursor default port is synced between backend and UI', () => {
    expect(UI_CURSOR_DEFAULT_PORT).toBe(BACKEND_CURSOR_DEFAULT_PORT);
  });
});
