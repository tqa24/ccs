import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { detectDroidCli } from '../../targets/droid-detector';
import type {
  DroidByokDiagnostics,
  DroidConfigFileDiagnostics,
  DroidCustomModelDiagnostics,
  DroidDashboardDiagnostics,
  DroidRawSettingsResponse,
} from './compatible-cli-types';

interface DroidConfigPaths {
  settingsPath: string;
  settingsDisplayPath: string;
  legacyConfigPath: string;
  legacyConfigDisplayPath: string;
}

interface JsonFileProbe {
  diagnostics: DroidConfigFileDiagnostics;
  json: Record<string, unknown> | null;
  rawText: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseHost(value: string): string | null {
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

export function maskApiKeyPreview(value: string): string {
  if (!value) return '';
  const suffix = value.slice(-4);
  return `***${suffix}`;
}

function isCcsManagedDisplayName(displayName: string): boolean {
  return displayName.startsWith('CCS ') || displayName.startsWith('ccs-');
}

export function resolveDroidConfigPaths(
  options: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
    homeDir?: string;
  } = {}
): DroidConfigPaths {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();

  const byokBase = env.CCS_HOME || homeDir;
  const settingsPath = path.join(byokBase, '.factory', 'settings.json');
  const legacyConfigPath = path.join(byokBase, '.factory', 'config.json');

  return {
    settingsPath,
    settingsDisplayPath: '~/.factory/settings.json',
    legacyConfigPath,
    legacyConfigDisplayPath: '~/.factory/config.json',
  };
}

function getBinaryVersion(binaryPath: string): string | null {
  try {
    return execFileSync(binaryPath, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    })
      .trim()
      .split('\n')[0]
      .trim();
  } catch {
    return null;
  }
}

function readJsonFileProbe(filePath: string, label: string, displayPath: string): JsonFileProbe {
  if (!fs.existsSync(filePath)) {
    return {
      diagnostics: {
        label,
        path: displayPath,
        resolvedPath: filePath,
        exists: false,
        isSymlink: false,
        isRegularFile: false,
        sizeBytes: null,
        mtimeMs: null,
        parseError: null,
        readError: null,
      },
      json: null,
      rawText: '{}',
    };
  }

  const stat = fs.lstatSync(filePath);
  const diagnostics: DroidConfigFileDiagnostics = {
    label,
    path: displayPath,
    resolvedPath: filePath,
    exists: true,
    isSymlink: stat.isSymbolicLink(),
    isRegularFile: stat.isFile(),
    sizeBytes: stat.size,
    mtimeMs: stat.mtimeMs,
    parseError: null,
    readError: null,
  };

  if (diagnostics.isSymlink) {
    diagnostics.readError = 'Refusing symlink file for safety.';
    return { diagnostics, json: null, rawText: '{}' };
  }

  if (!diagnostics.isRegularFile) {
    diagnostics.readError = 'Target is not a regular file.';
    return { diagnostics, json: null, rawText: '{}' };
  }

  try {
    const rawText = fs.readFileSync(filePath, 'utf8');
    try {
      const parsed = JSON.parse(rawText);
      if (!isObject(parsed)) {
        diagnostics.parseError = 'JSON root must be an object.';
        return { diagnostics, json: null, rawText };
      }
      return { diagnostics, json: parsed, rawText };
    } catch (error) {
      diagnostics.parseError = (error as Error).message;
      return { diagnostics, json: null, rawText };
    }
  } catch (error) {
    diagnostics.readError = (error as Error).message;
    return { diagnostics, json: null, rawText: '{}' };
  }
}

export function summarizeDroidCustomModels(customModelsValue: unknown): DroidByokDiagnostics {
  const rows: DroidCustomModelDiagnostics[] = [];
  const providerBreakdown: Record<string, number> = {};
  let invalidModelEntryCount = 0;

  const source = Array.isArray(customModelsValue)
    ? customModelsValue
    : isObject(customModelsValue)
      ? Object.values(customModelsValue)
      : [];

  for (const item of source) {
    if (!isObject(item)) {
      invalidModelEntryCount += 1;
      continue;
    }

    const displayName = asString(item.displayName);
    const model = asString(item.model);
    const baseUrl = asString(item.baseUrl);
    const providerRaw = asString(item.provider);
    const apiKey = asString(item.apiKey);

    if (!displayName || !model || !baseUrl || !providerRaw) {
      invalidModelEntryCount += 1;
      continue;
    }

    const provider = providerRaw.toLowerCase();
    providerBreakdown[provider] = (providerBreakdown[provider] ?? 0) + 1;

    rows.push({
      displayName,
      model,
      provider,
      baseUrl,
      host: parseHost(baseUrl),
      maxOutputTokens: typeof item.maxOutputTokens === 'number' ? item.maxOutputTokens : null,
      isCcsManaged: isCcsManagedDisplayName(displayName),
      apiKeyState: apiKey ? 'set' : 'missing',
      apiKeyPreview: apiKey ? maskApiKeyPreview(apiKey) : null,
    });
  }

  const ccsManagedCount = rows.filter((row) => row.isCcsManaged).length;

  return {
    activeModelSelector: null,
    customModelCount: rows.length,
    ccsManagedCount,
    userManagedCount: rows.length - ccsManagedCount,
    invalidModelEntryCount,
    providerBreakdown,
    customModels: rows,
  };
}

export function getDroidDashboardDiagnostics(): DroidDashboardDiagnostics {
  const paths = resolveDroidConfigPaths();
  const binaryPath = detectDroidCli();

  const source = process.env.CCS_DROID_PATH ? 'CCS_DROID_PATH' : binaryPath ? 'PATH' : 'missing';

  const settingsProbe = readJsonFileProbe(
    paths.settingsPath,
    'BYOK settings',
    paths.settingsDisplayPath
  );
  const legacyConfigProbe = readJsonFileProbe(
    paths.legacyConfigPath,
    'Legacy config',
    paths.legacyConfigDisplayPath
  );

  const byok = summarizeDroidCustomModels(settingsProbe.json?.customModels);
  byok.activeModelSelector = asString(settingsProbe.json?.model);

  const warnings: string[] = [];
  if (!binaryPath) warnings.push('Droid binary is not detected in PATH or CCS_DROID_PATH.');
  if (settingsProbe.diagnostics.parseError) {
    warnings.push('~/.factory/settings.json contains invalid JSON.');
  }
  if (byok.invalidModelEntryCount > 0) {
    warnings.push(`${byok.invalidModelEntryCount} customModels entries are malformed.`);
  }
  if (legacyConfigProbe.diagnostics.parseError) {
    warnings.push('Legacy Droid config (~/.factory/config.json) JSON is invalid.');
  }

  return {
    binary: {
      installed: !!binaryPath,
      path: binaryPath,
      installDir: binaryPath ? path.dirname(binaryPath) : null,
      source,
      version: binaryPath ? getBinaryVersion(binaryPath) : null,
      overridePath: process.env.CCS_DROID_PATH || null,
    },
    files: {
      settings: settingsProbe.diagnostics,
      legacyConfig: legacyConfigProbe.diagnostics,
    },
    byok,
    warnings,
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
    },
  };
}

export function getDroidRawSettings(): DroidRawSettingsResponse {
  const paths = resolveDroidConfigPaths();
  const settingsProbe = readJsonFileProbe(
    paths.settingsPath,
    'BYOK settings',
    paths.settingsDisplayPath
  );

  return {
    path: paths.settingsDisplayPath,
    resolvedPath: paths.settingsPath,
    exists: settingsProbe.diagnostics.exists,
    mtime: settingsProbe.diagnostics.mtimeMs ?? Date.now(),
    rawText: settingsProbe.rawText,
    settings: settingsProbe.json,
    parseError: settingsProbe.diagnostics.parseError,
  };
}
