/**
 * Create Command Handler
 *
 * Creates a new profile and prompts for login in an isolated Claude instance.
 */

import { spawn, ChildProcess } from 'child_process';
import { initUI, header, color, fail, warn, info, infoBox, warnBox } from '../../utils/ui';
import { getClaudeCliInfo } from '../../utils/claude-detector';
import { escapeShellArg, stripClaudeCodeEnv } from '../../utils/shell-executor';
import { isUnifiedMode } from '../../config/unified-config-loader';
import { ProfileMetadata } from '../../types';
import {
  resolveCreateAccountContext,
  policyToAccountContextMetadata,
  formatAccountContextPolicy,
  isValidAccountProfileName,
} from '../account-context';
import { exitWithError } from '../../errors';
import { ExitCode } from '../../errors/exit-codes';
import { CommandContext, parseArgs } from './types';

function sanitizeProfileNameForInstance(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

/**
 * Handle the create command
 */
export async function handleCreate(ctx: CommandContext, args: string[]): Promise<void> {
  await initUI();
  const { profileName, force, shareContext, contextGroup, unknownFlags } = parseArgs(args);

  if (!profileName) {
    console.log(fail('Profile name is required'));
    console.log('');
    console.log(
      `Usage: ${color('ccs auth create <profile> [--force] [--share-context] [--context-group <name>]', 'command')}`
    );
    console.log('');
    console.log('Example:');
    console.log(`  ${color('ccs auth create work', 'command')}`);
    exitWithError('Profile name is required', ExitCode.PROFILE_ERROR);
  }

  if (unknownFlags && unknownFlags.length > 0) {
    const unknownList = unknownFlags.join(', ');
    console.log(fail(`Unknown option(s): ${unknownList}`));
    console.log('');
    exitWithError(`Unknown option(s): ${unknownList}`, ExitCode.PROFILE_ERROR);
  }

  if (!isValidAccountProfileName(profileName)) {
    const error =
      'Invalid profile name. Use letters/numbers/dash/underscore and start with a letter.';
    console.log(fail(error));
    console.log('');
    exitWithError(error, ExitCode.PROFILE_ERROR);
  }

  // Check if profile already exists (check both legacy and unified)
  const existsLegacy = ctx.registry.hasProfile(profileName);
  const existsUnified = ctx.registry.hasAccountUnified(profileName);
  if (!force && (existsLegacy || existsUnified)) {
    console.log(fail(`Profile already exists: ${profileName}`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    exitWithError(`Profile already exists: ${profileName}`, ExitCode.PROFILE_ERROR);
  }

  const normalizedName = sanitizeProfileNameForInstance(profileName);
  const collidingName = Object.keys(ctx.registry.getAllProfilesMerged()).find(
    (name) => name !== profileName && sanitizeProfileNameForInstance(name) === normalizedName
  );

  if (collidingName) {
    const error = `Profile "${profileName}" conflicts with existing profile "${collidingName}" on filesystem.`;
    console.log(fail(error));
    console.log('');
    exitWithError(error, ExitCode.PROFILE_ERROR);
  }

  const resolvedContext = resolveCreateAccountContext({
    shareContext: !!shareContext,
    contextGroup,
  });

  if (resolvedContext.error) {
    console.log(fail(resolvedContext.error));
    console.log('');
    exitWithError(resolvedContext.error, ExitCode.PROFILE_ERROR);
  }

  const contextPolicy = resolvedContext.policy;
  const contextMetadata = policyToAccountContextMetadata(contextPolicy);
  const useUnifiedConfig = isUnifiedMode();
  const createdProfile = useUnifiedConfig ? !existsUnified : !existsLegacy;
  const previousLegacyProfile: ProfileMetadata | undefined =
    !useUnifiedConfig && existsLegacy ? ctx.registry.getProfile(profileName) : undefined;
  const previousUnifiedProfile =
    useUnifiedConfig && existsUnified
      ? ctx.registry.getAllAccountsUnified()[profileName]
      : undefined;

  try {
    const rollbackMetadata = (): void => {
      try {
        if (useUnifiedConfig) {
          if (createdProfile) {
            if (ctx.registry.hasAccountUnified(profileName)) {
              ctx.registry.removeAccountUnified(profileName);
            }
          } else if (previousUnifiedProfile) {
            ctx.registry.updateAccountUnified(profileName, previousUnifiedProfile);
          }
          return;
        }

        if (createdProfile) {
          if (ctx.registry.hasProfile(profileName)) {
            ctx.registry.deleteProfile(profileName);
          }
        } else if (previousLegacyProfile) {
          ctx.registry.updateProfile(profileName, previousLegacyProfile);
        }
      } catch {
        // Best-effort rollback to avoid leaving stale accounts after failed login.
      }
    };

    // Create instance directory
    console.log(info(`Creating profile: ${profileName}`));
    const instancePath = await ctx.instanceMgr.ensureInstance(profileName, contextPolicy);

    // Create/update profile entry based on config mode
    if (useUnifiedConfig) {
      // Use unified config (config.yaml)
      if (existsUnified) {
        ctx.registry.updateAccountUnified(profileName, {
          context_mode: contextMetadata.context_mode,
          context_group: contextMetadata.context_group,
        });
        ctx.registry.touchAccountUnified(profileName);
      } else {
        ctx.registry.createAccountUnified(profileName, contextMetadata);
      }
    } else {
      // Use legacy profiles.json
      if (existsLegacy) {
        ctx.registry.updateProfile(profileName, {
          type: 'account',
          context_mode: contextMetadata.context_mode,
          context_group: contextMetadata.context_group,
        });
      } else {
        ctx.registry.createProfile(profileName, {
          type: 'account',
          context_mode: contextMetadata.context_mode,
          context_group: contextMetadata.context_group,
        });
      }
    }

    console.log(info(`Instance directory: ${instancePath}`));
    console.log('');
    const launchDescription =
      contextPolicy.mode === 'shared'
        ? `Starting Claude with shared context group "${contextPolicy.group || 'default'}"...`
        : 'Starting Claude in isolated instance...';
    console.log(warn(launchDescription));
    console.log(warn('You will be prompted to login with your account.'));
    console.log('');

    // Detect Claude CLI
    const claudeInfo = getClaudeCliInfo();
    if (!claudeInfo) {
      console.log(fail('Claude CLI not found'));
      console.log('');
      console.log('Please install Claude CLI first:');
      console.log(`  ${color('https://claude.ai/download', 'path')}`);
      exitWithError('Claude CLI not found', ExitCode.BINARY_ERROR);
    }

    const { path: claudeCli, needsShell } = claudeInfo;
    const childEnv = stripClaudeCodeEnv({ ...process.env, CLAUDE_CONFIG_DIR: instancePath });
    // Avoid ambient provider credentials influencing account-login bootstrap behavior.
    const ambientProviderPrefixes = ['ANTHROPIC_', 'OPENAI_', 'GOOGLE_', 'GEMINI_', 'MINIMAX_'];
    for (const envKey of Object.keys(childEnv)) {
      if (envKey === 'CLAUDE_CONFIG_DIR') {
        continue;
      }

      if (
        ambientProviderPrefixes.some((prefix) => envKey.startsWith(prefix)) ||
        envKey === 'OPENROUTER_API_KEY'
      ) {
        delete childEnv[envKey];
      }
    }

    // Execute Claude in isolated instance (will auto-prompt for login if no credentials)
    // On Windows, .cmd/.bat/.ps1 files need shell: true to execute properly
    let child: ChildProcess;
    if (needsShell) {
      const cmdString = escapeShellArg(claudeCli);
      child = spawn(cmdString, {
        stdio: 'inherit',
        windowsHide: true,
        shell: true,
        env: childEnv,
      });
    } else {
      child = spawn(claudeCli, [], {
        stdio: 'inherit',
        windowsHide: true,
        env: childEnv,
      });
    }

    child.on('exit', (code: number | null) => {
      if (code === 0) {
        console.log('');
        console.log(
          infoBox(
            `Profile:  ${profileName}\n` +
              `Instance: ${instancePath}\n` +
              `Type:     account\n` +
              `Context:  ${formatAccountContextPolicy(contextPolicy)}`,
            'Profile Created'
          )
        );
        console.log('');
        console.log(header('Usage'));
        console.log(`  ${color(`ccs ${profileName} "your prompt here"`, 'command')}`);
        console.log('');
        console.log(
          warnBox(
            `Running the command below will SWITCH your default\n` +
              `CCS account to "${profileName}". After this, running\n` +
              `"ccs" without a profile name will use this account.\n\n` +
              `  ${color(`ccs auth default ${profileName}`, 'command')}\n\n` +
              `To restore the original default, run:\n` +
              `  ${color('ccs auth reset-default', 'command')}`,
            'Set as Default?'
          )
        );
        console.log('');
        process.exit(0);
      } else {
        rollbackMetadata();
        if (createdProfile) {
          ctx.instanceMgr.deleteInstance(profileName);
        }

        console.log('');
        console.log(fail('Login failed or cancelled'));
        console.log('');
        console.log('To retry:');
        console.log(`  ${color(`ccs auth create ${profileName} --force`, 'command')}`);
        console.log('');
        exitWithError('Login failed or cancelled', ExitCode.AUTH_ERROR);
      }
    });

    child.on('error', (err: Error) => {
      rollbackMetadata();
      if (createdProfile) {
        ctx.instanceMgr.deleteInstance(profileName);
      }
      exitWithError(`Failed to execute Claude CLI: ${err.message}`, ExitCode.BINARY_ERROR);
    });
  } catch (error) {
    exitWithError(`Failed to create profile: ${(error as Error).message}`, ExitCode.GENERAL_ERROR);
  }
}
