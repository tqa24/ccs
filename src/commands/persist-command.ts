/**
 * Persist Command Handler
 *
 * Writes a profile's environment variables to ~/.claude/settings.json
 * for native Claude Code usage (IDEs, extensions, etc.).
 *
 * Supports all profile types: API, CLIProxy, Copilot.
 * Account-based profiles are not supported (use CLAUDE_CONFIG_DIR).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initUI, header, subheader, color, dim, ok, fail, warn, info } from '../utils/ui';
import { InteractivePrompt } from '../utils/prompt';
import ProfileDetector, {
  ProfileDetectionResult,
  loadSettingsFromFile,
  CLIPROXY_PROFILES,
} from '../auth/profile-detector';
import { getEffectiveEnvVars, CLIPROXY_DEFAULT_PORT } from '../cliproxy/config-generator';
import { generateCopilotEnv } from '../copilot/copilot-executor';
import { expandPath } from '../utils/helpers';
import { getClaudeConfigDir, getClaudeSettingsPath } from '../utils/claude-config-path';
import { extractOption, hasAnyFlag } from './arg-extractor';

interface PersistCommandArgs {
  profile?: string;
  yes?: boolean;
  listBackups?: boolean;
  restore?: string | boolean;
  permissionMode?: PermissionMode;
  dangerouslySkipPermissions?: boolean;
  parseError?: string;
}

interface ResolvedEnv {
  env: Record<string, string>;
  profileType: string;
  warning?: string;
}

const PERSIST_KNOWN_FLAGS = [
  '--yes',
  '-y',
  '--list-backups',
  '--restore',
  '--permission-mode',
  '--dangerously-skip-permissions',
  '--auto-approve',
  '--help',
  '-h',
] as const;

const VALID_PERMISSION_MODES = ['default', 'plan', 'acceptEdits', 'bypassPermissions'] as const;

type PermissionMode = (typeof VALID_PERMISSION_MODES)[number];

function isPermissionMode(value: string): value is PermissionMode {
  return VALID_PERMISSION_MODES.includes(value as PermissionMode);
}

function resolvePermissionMode(parsedArgs: PersistCommandArgs): PermissionMode | undefined {
  if (!parsedArgs.dangerouslySkipPermissions) {
    return parsedArgs.permissionMode;
  }

  if (parsedArgs.permissionMode && parsedArgs.permissionMode !== 'bypassPermissions') {
    throw new Error(
      '--dangerously-skip-permissions conflicts with --permission-mode. Use bypassPermissions or remove one flag.'
    );
  }

  return 'bypassPermissions';
}

/** Parse command line arguments */
function parseArgs(args: string[]): PersistCommandArgs {
  const result: PersistCommandArgs = {
    yes: hasAnyFlag(args, ['--yes', '-y']),
    listBackups: hasAnyFlag(args, ['--list-backups']),
  };

  const restoreOption = extractOption(args, ['--restore']);
  if (restoreOption.found) {
    result.restore = restoreOption.missingValue ? true : restoreOption.value || true;
  }

  const permissionModeOption = extractOption(restoreOption.remainingArgs, ['--permission-mode'], {
    knownFlags: PERSIST_KNOWN_FLAGS,
  });
  if (permissionModeOption.found) {
    if (permissionModeOption.missingValue) {
      result.parseError = 'Missing value for --permission-mode';
    } else if (permissionModeOption.value) {
      if (!isPermissionMode(permissionModeOption.value)) {
        result.parseError = `Invalid --permission-mode "${permissionModeOption.value}". Valid modes: ${VALID_PERMISSION_MODES.join(', ')}`;
      } else {
        result.permissionMode = permissionModeOption.value;
      }
    }
  }

  result.dangerouslySkipPermissions = hasAnyFlag(permissionModeOption.remainingArgs, [
    '--dangerously-skip-permissions',
    '--auto-approve',
  ]);

  for (const arg of permissionModeOption.remainingArgs) {
    if (!arg.startsWith('-')) {
      result.profile = arg;
      break;
    }
  }
  return result;
}

function formatDisplayPath(filePath: string): string {
  const defaultClaudeDir = path.join(os.homedir(), '.claude');
  const claudeDir = getClaudeConfigDir();

  // Keep real path when user overrides Claude directory.
  if (path.resolve(claudeDir) !== path.resolve(defaultClaudeDir)) {
    return filePath;
  }

  if (filePath === claudeDir) {
    return '~/.claude';
  }

  const claudePrefix = `${claudeDir}${path.sep}`;
  if (filePath.startsWith(claudePrefix)) {
    return filePath.replace(claudePrefix, '~/.claude/');
  }

  return filePath;
}

function getClaudeSettingsDisplayPath(): string {
  return formatDisplayPath(getClaudeSettingsPath());
}

/** Read existing Claude settings.json with validation */
function readClaudeSettings(): Record<string, unknown> {
  const settingsPath = getClaudeSettingsPath();
  try {
    const content = fs.readFileSync(settingsPath, 'utf8');
    // Handle empty file (0 bytes)
    if (!content.trim()) {
      return {};
    }
    const parsed: unknown = JSON.parse(content);
    // Validate parsed value is a plain object (not array, null, or primitive)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('settings.json must contain a JSON object, not an array or primitive');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return {};
    }
    throw new Error(`Failed to parse settings.json: ${(error as Error).message}`);
  }
}

/**
 * Write settings back to settings.json
 * Note: mode 0o600 only applies when creating a new file.
 * Existing file permissions are preserved (acceptable behavior).
 */
function writeClaudeSettings(settings: Record<string, unknown>): void {
  const settingsPath = getClaudeSettingsPath();
  // Security: Reject symlinks to prevent writing to unexpected locations
  if (isSymlink(settingsPath)) {
    throw new Error('settings.json is a symlink - refusing to write for security');
  }
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
}

/** Maximum number of backups to keep (oldest are deleted) */
const MAX_BACKUPS = 10;

/** Check if path is a symlink (security check) */
function isSymlink(filePath: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Create backup of settings.json with proper permissions and rotation */
function createBackup(): string {
  const settingsPath = getClaudeSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    throw new Error('No settings.json to backup');
  }
  // Security: Reject symlinks to prevent writing to unexpected locations
  if (isSymlink(settingsPath)) {
    throw new Error('settings.json is a symlink - refusing to backup for security');
  }
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    '_' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  const backupPath = `${settingsPath}.backup.${timestamp}`;
  fs.copyFileSync(settingsPath, backupPath);
  // Security: Set restrictive permissions on backup (contains API keys)
  fs.chmodSync(backupPath, 0o600);
  // Cleanup: Rotate old backups (keep only MAX_BACKUPS)
  cleanupOldBackups();
  return backupPath;
}

/** Remove old backups keeping only MAX_BACKUPS most recent */
function cleanupOldBackups(): void {
  const backups = getBackupFiles();
  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
      try {
        fs.unlinkSync(backup.path);
      } catch {
        // Ignore deletion errors (file may be locked or already deleted)
      }
    }
  }
}

interface BackupFile {
  path: string;
  timestamp: string;
  date: Date;
}

function parseBackupTimestamp(timestamp: string): Date | null {
  const year = parseInt(timestamp.slice(0, 4), 10);
  const month = parseInt(timestamp.slice(4, 6), 10);
  const day = parseInt(timestamp.slice(6, 8), 10);
  const hour = parseInt(timestamp.slice(9, 11), 10);
  const minute = parseInt(timestamp.slice(11, 13), 10);
  const second = parseInt(timestamp.slice(13, 15), 10);
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (date.getFullYear() !== year) return null;
  if (date.getMonth() !== month - 1) return null;
  if (date.getDate() !== day) return null;
  if (date.getHours() !== hour) return null;
  if (date.getMinutes() !== minute) return null;
  if (date.getSeconds() !== second) return null;

  return date;
}

/** Get all backup files sorted by date (newest first) */
function getBackupFiles(): BackupFile[] {
  const settingsPath = getClaudeSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const backupPattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;
  const files = fs
    .readdirSync(dir)
    .filter((f) => backupPattern.test(f))
    .map((f) => {
      const match = f.match(backupPattern);
      if (!match) return null;
      const timestamp = match[1];
      const date = parseBackupTimestamp(timestamp);
      if (!date) return null;
      return {
        path: path.join(dir, f),
        timestamp,
        date,
      };
    })
    .filter((f): f is BackupFile => f !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // newest first
  return files;
}

/** Mask API key for display (show first 4 and last 4 chars) */
function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return '****';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/** Resolve env vars for a profile */
async function resolveProfileEnvVars(
  profileName: string,
  profileResult: ProfileDetectionResult
): Promise<ResolvedEnv> {
  switch (profileResult.type) {
    case 'settings': {
      // API profile - load from settings file
      let env: Record<string, string> = {};
      if (profileResult.env) {
        env = profileResult.env;
      } else if (profileResult.settingsPath) {
        env = loadSettingsFromFile(expandPath(profileResult.settingsPath));
      }
      if (Object.keys(env).length === 0) {
        throw new Error(`Profile '${profileName}' has no env vars configured`);
      }
      return { env, profileType: 'API' };
    }
    case 'cliproxy': {
      // CLIProxy profile - generate env vars
      const provider =
        profileResult.provider || (profileName as (typeof CLIPROXY_PROFILES)[number]);
      const port = profileResult.port || CLIPROXY_DEFAULT_PORT;
      const env = getEffectiveEnvVars(provider, port, profileResult.settingsPath) as Record<
        string,
        string
      >;
      return {
        env,
        profileType: 'CLIProxy',
        warning: 'CLIProxy must be running for this profile to work',
      };
    }
    case 'copilot': {
      // Copilot profile - generate env vars
      if (!profileResult.copilotConfig) {
        throw new Error('Copilot configuration not found');
      }
      const env = generateCopilotEnv(profileResult.copilotConfig);
      return {
        env,
        profileType: 'Copilot',
        warning: 'copilot-api daemon must be running for this profile to work',
      };
    }
    case 'account': {
      throw new Error(
        `Account profiles use CLAUDE_CONFIG_DIR isolation, not env vars.\n` +
          `Use 'ccs ${profileName}' to run with this profile instead.`
      );
    }
    case 'default': {
      throw new Error(
        'Default profile has no env vars to persist.\n' +
          'Specify a profile name: ccs persist <profile>'
      );
    }
    default: {
      throw new Error(`Unknown profile type: ${profileResult.type}`);
    }
  }
}

/** Handle --list-backups flag */
async function handleListBackups(): Promise<void> {
  await initUI();
  const backups = getBackupFiles();
  if (backups.length === 0) {
    console.log(info('No backups found'));
    return;
  }
  console.log(header('Available Backups'));
  console.log('');
  backups.forEach((b, i) => {
    const dateStr = b.date.toLocaleString();
    const marker = i === 0 ? color(' (latest)', 'success') : '';
    console.log(`  ${color(b.timestamp, 'command')}  ${dim(dateStr)}${marker}`);
  });
  console.log('');
  console.log(dim('To restore: ccs persist --restore [timestamp]'));
}

/** Handle --restore [timestamp] flag */
async function handleRestore(timestamp: string | boolean, yes: boolean): Promise<void> {
  await initUI();
  const backups = getBackupFiles();
  if (backups.length === 0) {
    console.log(fail('No backups found'));
    process.exit(1);
  }
  // Find backup to restore
  let backup: BackupFile;
  if (timestamp === true) {
    // Use latest
    backup = backups[0];
  } else {
    const found = backups.find((b) => b.timestamp === timestamp);
    if (!found) {
      console.log(fail(`Backup not found: ${timestamp}`));
      console.log('');
      console.log('Available backups:');
      backups.slice(0, 5).forEach((b) => console.log(`  ${b.timestamp}`));
      process.exit(1);
    }
    backup = found;
  }
  console.log(header('Restore Backup'));
  console.log('');
  console.log(`Backup: ${color(backup.timestamp, 'command')}`);
  console.log(`Date:   ${backup.date.toLocaleString()}`);
  console.log('');
  console.log(warn(`This will replace ${getClaudeSettingsDisplayPath()}`));
  console.log('');
  if (!yes) {
    const proceed = await InteractivePrompt.confirm('Proceed with restore?', { default: false });
    if (!proceed) {
      console.log(info('Cancelled'));
      process.exit(0);
    }
  }
  // Validate backup JSON integrity before restore
  try {
    const backupContent = fs.readFileSync(backup.path, 'utf8');
    const parsed: unknown = JSON.parse(backupContent);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.log(fail('Backup file is corrupted: not a valid JSON object'));
      process.exit(1);
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      console.log(fail('Backup was deleted during restore'));
      process.exit(1);
    }
    console.log(fail(`Backup file is corrupted: ${(error as Error).message}`));
    process.exit(1);
  }
  // Security: Reject symlink backup files
  if (isSymlink(backup.path)) {
    console.log(fail('Backup file is a symlink - refusing to restore for security'));
    process.exit(1);
  }
  // Copy backup over settings.json
  const settingsPath = getClaudeSettingsPath();
  // Security: Reject symlink target
  if (isSymlink(settingsPath)) {
    console.log(fail('settings.json is a symlink - refusing to restore for security'));
    process.exit(1);
  }
  fs.copyFileSync(backup.path, settingsPath);
  console.log(ok(`Restored from backup: ${backup.timestamp}`));
}

/** Show help for persist command */
async function showHelp(): Promise<void> {
  await initUI();
  console.log(header('CCS Persist Command'));
  console.log('');
  console.log(subheader('Usage'));
  console.log(`  ${color('ccs persist', 'command')} <profile> [options]`);
  console.log(`  ${color('ccs persist', 'command')} --list-backups`);
  console.log(`  ${color('ccs persist', 'command')} --restore [timestamp]`);
  console.log('');
  console.log(subheader('Description'));
  console.log("  Writes a profile's environment variables directly to");
  console.log(`  ${getClaudeSettingsDisplayPath()} for native Claude Code usage.`);
  console.log('');
  console.log('  This allows Claude Code to use the profile without CCS,');
  console.log('  enabling compatibility with IDEs and extensions.');
  console.log('');
  console.log(subheader('Options'));
  console.log(`  ${color('--yes, -y', 'command')}         Skip confirmation prompts (auto-backup)`);
  console.log(
    `  ${color('--permission-mode <mode>', 'command')}  Set default permission mode in settings.json`
  );
  console.log(
    `  ${color('--dangerously-skip-permissions', 'command')}  Persist auto-approve (bypassPermissions)`
  );
  console.log(`  ${color('--auto-approve', 'command')}  Alias for --dangerously-skip-permissions`);
  console.log(`  ${color('--help, -h', 'command')}        Show this help message`);
  console.log('');
  console.log(subheader('Backup Management'));
  console.log(`  ${color('--list-backups', 'command')}    List available backup files`);
  console.log(`  ${color('--restore', 'command')}         Restore from the most recent backup`);
  console.log(
    `  ${color('--restore <ts>', 'command')}    Restore from specific backup (e.g., 20260110_205324)`
  );
  console.log('');
  console.log(subheader('Supported Profile Types'));
  console.log(`  ${color('API profiles', 'command')}      glm, glmt, km, custom API profiles`);
  console.log(`  ${color('CLIProxy', 'command')}          gemini, codex, agy, qwen, kiro, ghcp`);
  console.log(`  ${color('Copilot', 'command')}           copilot (requires copilot-api daemon)`);
  console.log(`  ${dim('Account-based')}     Not supported (uses CLAUDE_CONFIG_DIR)`);
  console.log('');
  console.log(subheader('Examples'));
  console.log(`  ${dim('# Persist GLM profile')}`);
  console.log(`  ${color('ccs persist glm', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Persist with auto-confirmation')}`);
  console.log(`  ${color('ccs persist gemini --yes', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Persist with default permission mode')}`);
  console.log(`  ${color('ccs persist glm --permission-mode acceptEdits', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Persist with auto-approve enabled')}`);
  console.log(`  ${color('ccs persist codex --dangerously-skip-permissions', 'command')}`);
  console.log('');
  console.log(`  ${dim('# List all backups')}`);
  console.log(`  ${color('ccs persist --list-backups', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Restore latest backup')}`);
  console.log(`  ${color('ccs persist --restore', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Restore specific backup')}`);
  console.log(`  ${color('ccs persist --restore 20260110_205324', 'command')}`);
  console.log('');
  console.log(subheader('Notes'));
  console.log('  [i] CLIProxy profiles require the proxy to be running.');
  console.log('  [i] Copilot profiles require copilot-api daemon.');
  console.log(
    `  [i] Backups are saved as ${getClaudeSettingsDisplayPath()}.backup.YYYYMMDD_HHMMSS`
  );
  console.log('');
}

/** Main persist command handler */
export async function handlePersistCommand(args: string[]): Promise<void> {
  // Check for help first
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    await showHelp();
    return;
  }
  const parsedArgs = parseArgs(args);
  // Handle --list-backups
  if (parsedArgs.listBackups) {
    await handleListBackups();
    return;
  }
  // Handle --restore
  if (parsedArgs.restore) {
    await handleRestore(parsedArgs.restore, parsedArgs.yes ?? false);
    return;
  }
  await initUI();
  if (parsedArgs.parseError) {
    console.log(fail(parsedArgs.parseError));
    process.exit(1);
  }
  let resolvedPermissionMode: PermissionMode | undefined;
  try {
    resolvedPermissionMode = resolvePermissionMode(parsedArgs);
  } catch (error) {
    console.log(fail((error as Error).message));
    process.exit(1);
  }
  if (!parsedArgs.profile) {
    console.log(fail('Profile name is required'));
    console.log('');
    console.log('Usage:');
    console.log(`  ${color('ccs persist <profile>', 'command')}`);
    console.log('');
    console.log('Run for help:');
    console.log(`  ${color('ccs persist --help', 'command')}`);
    process.exit(1);
  }
  // Detect profile
  const detector = new ProfileDetector();
  let profileResult: ProfileDetectionResult;
  try {
    profileResult = detector.detectProfileType(parsedArgs.profile);
  } catch (error) {
    const err = error as Error & { availableProfiles?: string };
    console.log(fail(`Profile not found: ${parsedArgs.profile}`));
    console.log('');
    if (err.availableProfiles) {
      console.log(err.availableProfiles);
    }
    process.exit(1);
  }
  // Resolve env vars
  let resolved: ResolvedEnv;
  try {
    resolved = await resolveProfileEnvVars(parsedArgs.profile, profileResult);
  } catch (error) {
    console.log(fail((error as Error).message));
    process.exit(1);
  }
  // Display what will be written
  console.log(header(`Persist Profile: ${parsedArgs.profile}`));
  console.log('');
  console.log(`Profile type: ${color(resolved.profileType, 'command')}`);
  console.log('');
  console.log(`The following env vars will be written to ${getClaudeSettingsDisplayPath()}:`);
  console.log('');
  // Display env vars (mask sensitive values)
  const envKeys = Object.keys(resolved.env);
  if (envKeys.length === 0) {
    console.log(fail('Profile has no environment variables to persist'));
    process.exit(1);
  }
  const maxKeyLen = Math.max(...envKeys.map((k) => k.length));
  for (const [key, value] of Object.entries(resolved.env)) {
    const paddedKey = key.padEnd(maxKeyLen + 2);
    const displayValue =
      key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')
        ? maskApiKey(value)
        : value;
    console.log(`  ${color(paddedKey, 'command')} = ${displayValue}`);
  }
  console.log('');
  if (resolvedPermissionMode) {
    console.log(`Default permission mode: ${color(resolvedPermissionMode, 'command')}`);
    if (resolvedPermissionMode === 'bypassPermissions') {
      console.log(warn('Auto-approve enabled: Claude will skip permission prompts by default.'));
    }
    console.log('');
  }
  // Show warning if applicable
  if (resolved.warning) {
    console.log(warn(resolved.warning));
    console.log('');
  }
  // Warning about modification
  console.log(warn(`This will modify ${getClaudeSettingsDisplayPath()}`));
  console.log(dim('    Existing hooks and other settings will be preserved.'));
  console.log('');
  // Check if settings.json exists for backup
  const settingsPath = getClaudeSettingsPath();
  const settingsExist = fs.existsSync(settingsPath);
  // Track backup path for error recovery guidance
  let createdBackupPath: string | null = null;
  // Backup prompt (unless --yes)
  if (settingsExist) {
    let createBackupFlag: boolean = parsedArgs.yes === true; // Auto-backup with --yes
    if (!parsedArgs.yes) {
      createBackupFlag = await InteractivePrompt.confirm('Create backup before modifying?', {
        default: true,
      });
    }
    if (createBackupFlag) {
      try {
        createdBackupPath = createBackup();
        console.log(ok(`Backup created: ${formatDisplayPath(createdBackupPath)}`));
        console.log('');
      } catch (error) {
        console.log(fail(`Failed to create backup: ${(error as Error).message}`));
        process.exit(1);
      }
    }
  }
  // Proceed confirmation (unless --yes)
  if (!parsedArgs.yes) {
    const proceed = await InteractivePrompt.confirm('Proceed with persist?', { default: true });
    if (!proceed) {
      console.log(info('Cancelled'));
      process.exit(0);
    }
  }
  // Read existing settings and merge
  const existingSettings = readClaudeSettings();
  // Validate existing env is an object (not array/primitive)
  const rawEnv = existingSettings.env;
  let existingEnv: Record<string, string> = {};
  if (rawEnv !== undefined && rawEnv !== null) {
    if (typeof rawEnv !== 'object' || Array.isArray(rawEnv)) {
      console.log(warn('Existing env in settings.json is not an object - it will be replaced'));
    } else {
      existingEnv = rawEnv as Record<string, string>;
    }
  }
  const mergedSettings: Record<string, unknown> = {
    ...existingSettings,
    env: {
      ...existingEnv,
      ...resolved.env,
    },
  };
  if (resolvedPermissionMode) {
    const rawPermissions = existingSettings.permissions;
    let existingPermissions: Record<string, unknown> = {};
    if (rawPermissions !== undefined && rawPermissions !== null) {
      if (typeof rawPermissions !== 'object' || Array.isArray(rawPermissions)) {
        console.log(
          warn('Existing permissions in settings.json is not an object - it will be replaced')
        );
      } else {
        existingPermissions = rawPermissions as Record<string, unknown>;
      }
    }
    mergedSettings.permissions = {
      ...existingPermissions,
      defaultMode: resolvedPermissionMode,
    };
  }
  // Write merged settings
  try {
    writeClaudeSettings(mergedSettings);
  } catch (error) {
    console.log(fail(`Failed to write settings: ${(error as Error).message}`));
    if (createdBackupPath) {
      console.log('');
      console.log(info(`A backup was created before this error:`));
      console.log(`    ${formatDisplayPath(createdBackupPath)}`);
      console.log(dim('    To restore: ccs persist --restore'));
    }
    process.exit(1);
  }
  console.log('');
  console.log(ok(`Profile '${parsedArgs.profile}' written to ${getClaudeSettingsDisplayPath()}`));
  console.log('');
  console.log(info('Claude Code will now use this profile by default.'));
  console.log(dim('    To revert, restore the backup or edit settings.json manually.'));
  console.log('');
}
