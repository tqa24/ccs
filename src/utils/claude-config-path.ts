import * as os from 'os';
import * as path from 'path';

/**
 * Resolve Claude config directory with test/dev overrides.
 * Precedence:
 * 1. CLAUDE_CONFIG_DIR (explicit override)
 * 2. CCS_HOME compatibility path (<CCS_HOME>/.claude)
 * 3. ~/.claude (default)
 */
export function getClaudeConfigDir(): string {
  if (process.env.CLAUDE_CONFIG_DIR) {
    return path.resolve(process.env.CLAUDE_CONFIG_DIR);
  }

  if (process.env.CCS_HOME) {
    return path.join(path.resolve(process.env.CCS_HOME), '.claude');
  }

  return path.join(os.homedir(), '.claude');
}

/** Resolve Claude settings.json path. */
export function getClaudeSettingsPath(): string {
  return path.join(getClaudeConfigDir(), 'settings.json');
}
