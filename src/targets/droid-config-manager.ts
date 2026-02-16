/**
 * Droid Config Manager
 *
 * Read/write ~/.factory/settings.json safely.
 * Only touches ccs-* prefixed entries in customModels[].
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as lockfile from 'proper-lockfile';

const CCS_MODEL_PREFIX = 'ccs-';

export interface DroidCustomModel {
  model: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  provider: 'anthropic' | 'openai' | 'generic-chat-completion-api';
  maxOutputTokens?: number;
}

interface DroidSettings {
  customModels?: DroidCustomModelEntry[];
  [key: string]: unknown;
}

interface DroidCustomModelEntry extends DroidCustomModel {
  /** Internal alias used by CCS for lookup. Stored as the model's display name prefix. */
}

/**
 * Get path to ~/.factory/settings.json.
 * Respects CCS_HOME for test isolation (uses CCS_HOME/.factory/ in tests).
 */
function getFactoryDir(): string {
  const base = process.env.CCS_HOME || os.homedir();
  return path.join(base, '.factory');
}

function getSettingsPath(): string {
  return path.join(getFactoryDir(), 'settings.json');
}

/**
 * Ensure ~/.factory/ directory exists.
 */
function ensureFactoryDir(): void {
  const dir = getFactoryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Read ~/.factory/settings.json, creating empty structure if missing.
 */
function readDroidSettings(): DroidSettings {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return { customModels: [] };
  }

  const raw = fs.readFileSync(settingsPath, 'utf8');
  try {
    return JSON.parse(raw) as DroidSettings;
  } catch {
    // Corrupted file — preserve as backup, start fresh
    const backup = settingsPath + '.bak';
    fs.copyFileSync(settingsPath, backup);
    console.warn(`[!] Corrupted ${settingsPath}, backed up to ${backup}`);
    return { customModels: [] };
  }
}

/**
 * Write ~/.factory/settings.json atomically with safe permissions.
 * Uses temp file + rename for atomicity on same filesystem.
 */
function writeDroidSettings(settings: DroidSettings): void {
  ensureFactoryDir();
  const settingsPath = getSettingsPath();
  const tmpPath = settingsPath + '.tmp';

  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(tmpPath, settingsPath);

  // Fix permissions on existing file if world-readable
  try {
    const stat = fs.statSync(settingsPath);

    if (stat.mode & 0o077) {
      fs.chmodSync(settingsPath, 0o600);
      console.warn('[!] Fixed permissions on ~/.factory/settings.json (was world-readable)');
    }
  } catch {
    // Best-effort permission check
  }
}

/**
 * Build the custom model alias from a CCS profile name.
 * e.g., "gemini" → "ccs-gemini"
 */
function ccsAlias(profile: string): string {
  return `${CCS_MODEL_PREFIX}${profile}`;
}

/**
 * Upsert a CCS-managed custom model entry.
 * Acquires file lock to prevent concurrent write races.
 */
export async function upsertCcsModel(profile: string, model: DroidCustomModel): Promise<void> {
  ensureFactoryDir();
  const settingsPath = getSettingsPath();

  // Create file if it doesn't exist (lockfile needs an existing file)
  if (!fs.existsSync(settingsPath)) {
    writeDroidSettings({ customModels: [] });
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(settingsPath, {
      stale: 10000,
      retries: { retries: 5, minTimeout: 200, maxTimeout: 1000 },
    });

    const settings = readDroidSettings();
    if (!settings.customModels) {
      settings.customModels = [];
    }

    const alias = ccsAlias(profile);
    const entry: DroidCustomModelEntry = {
      ...model,
      displayName: `CCS ${profile}`,
    };

    // Find existing entry by checking displayName for CCS prefix match
    const idx = settings.customModels.findIndex(
      (m) => m.displayName === `CCS ${profile}` || m.displayName === alias
    );

    if (idx >= 0) {
      settings.customModels[idx] = entry;
    } else {
      settings.customModels.push(entry);
    }

    writeDroidSettings(settings);
  } finally {
    if (release) await release();
  }
}

/**
 * Remove a CCS-managed custom model entry.
 */
export async function removeCcsModel(profile: string): Promise<void> {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return;

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(settingsPath, {
      stale: 10000,
      retries: { retries: 3, minTimeout: 200, maxTimeout: 1000 },
    });

    const settings = readDroidSettings();
    if (!settings.customModels) return;

    settings.customModels = settings.customModels.filter(
      (m) => m.displayName !== `CCS ${profile}` && m.displayName !== ccsAlias(profile)
    );

    writeDroidSettings(settings);
  } finally {
    if (release) await release();
  }
}

/**
 * List all CCS-managed custom model entries.
 */
export async function listCcsModels(): Promise<Map<string, DroidCustomModel>> {
  const result = new Map<string, DroidCustomModel>();
  const settings = readDroidSettings();
  if (!settings.customModels) return result;

  for (const entry of settings.customModels) {
    if (entry.displayName?.startsWith('CCS ')) {
      const profile = entry.displayName.slice(4); // Remove "CCS " prefix
      result.set(profile, entry);
    }
  }

  return result;
}

/**
 * Prune orphaned CCS entries from settings.json.
 * Removes ccs-* entries whose profile no longer exists in active profiles.
 */
export async function pruneOrphanedModels(activeProfiles: string[]): Promise<number> {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return 0;

  let release: (() => Promise<void>) | undefined;
  let removed = 0;

  try {
    release = await lockfile.lock(settingsPath, {
      stale: 10000,
      retries: { retries: 3, minTimeout: 200, maxTimeout: 1000 },
    });

    const settings = readDroidSettings();
    if (!settings.customModels) return 0;

    const before = settings.customModels.length;
    settings.customModels = settings.customModels.filter((m) => {
      if (!m.displayName?.startsWith('CCS ')) return true; // Keep non-CCS entries
      const profile = m.displayName.slice(4);
      return activeProfiles.includes(profile);
    });

    removed = before - settings.customModels.length;
    if (removed > 0) {
      writeDroidSettings(settings);
    }
  } finally {
    if (release) await release();
  }

  return removed;
}
