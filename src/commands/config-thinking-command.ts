/**
 * Config Thinking Command Handler
 *
 * Manages thinking section of config.yaml via CLI.
 * Usage: ccs config thinking [options]
 */

import { initUI, header, ok, info, warn, fail, subheader, color, dim } from '../utils/ui';
import {
  getThinkingConfig,
  updateUnifiedConfig,
  loadOrCreateUnifiedConfig,
} from '../config/unified-config-loader';
import { DEFAULT_THINKING_TIER_DEFAULTS } from '../config/unified-config-types';
import { VALID_THINKING_LEVELS } from '../cliproxy/thinking-validator';

const VALID_THINKING_MODES = ['auto', 'off', 'manual'] as const;

interface ThinkingCommandOptions {
  mode?: string;
  override?: string;
  clearOverride?: boolean;
  tier?: { tier: string; level: string };
  providerOverride?: { provider: string; tier: string; level: string };
  help?: boolean;
}

const VALID_TIERS = ['opus', 'sonnet', 'haiku'] as const;

function parseArgs(args: string[]): ThinkingCommandOptions {
  const options: ThinkingCommandOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i];
    } else if (arg === '--override' && args[i + 1]) {
      options.override = args[++i];
    } else if (arg === '--clear-override') {
      options.clearOverride = true;
    } else if (arg === '--tier' && args[i + 1] && args[i + 2]) {
      options.tier = { tier: args[++i], level: args[++i] };
    } else if (arg === '--provider-override' && args[i + 1] && args[i + 2] && args[i + 3]) {
      options.providerOverride = {
        provider: args[++i],
        tier: args[++i],
        level: args[++i],
      };
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp(): void {
  console.log('');
  console.log(header('ccs config thinking'));
  console.log('');
  console.log('  Configure extended thinking/reasoning for CLIProxy providers.');
  console.log('');

  console.log(subheader('Usage:'));
  console.log(`  ${color('ccs config thinking', 'command')} [options]`);
  console.log('');

  console.log(subheader('Options:'));
  console.log(
    `  ${color('--mode <mode>', 'command')}                    Set mode (auto, off, manual)`
  );
  console.log(
    `  ${color('--override <level>', 'command')}               Set persistent override (manual mode)`
  );
  console.log(
    `  ${color('--clear-override', 'command')}                  Remove persistent override`
  );
  console.log(
    `  ${color('--tier <tier> <level>', 'command')}            Set tier default (opus/sonnet/haiku)`
  );
  console.log(
    `  ${color('--provider-override <p> <t> <l>', 'command')} Set provider-specific tier override`
  );
  console.log(`  ${color('--help, -h', 'command')}                        Show this help`);
  console.log('');

  console.log(subheader('Levels:'));
  console.log(
    `  ${dim('minimal (512), low (1K), medium (8K), high (24K), xhigh (32K), auto, off')}`
  );
  console.log('');

  console.log(subheader('Examples:'));
  console.log(
    `  $ ${color('ccs config thinking', 'command')}                            ${dim('# Show status')}`
  );
  console.log(
    `  $ ${color('ccs config thinking --mode auto', 'command')}                ${dim('# Auto mode')}`
  );
  console.log(
    `  $ ${color('ccs config thinking --mode manual --override high', 'command')} ${dim('# Persistent high')}`
  );
  console.log(
    `  $ ${color('ccs config thinking --tier opus xhigh', 'command')}          ${dim('# Opus -> xhigh')}`
  );
  console.log(
    `  $ ${color('ccs config thinking --provider-override codex opus xhigh', 'command')}`
  );
  console.log('');

  console.log(subheader('Environment:'));
  console.log(
    `  ${color('CCS_THINKING', 'command')}  Override per-session via env var (priority: flag > env > config)`
  );
  console.log(`  ${dim('Example: CCS_THINKING=high ccs codex "debug this"')}`);
  console.log('');
}

function showStatus(): void {
  const config = getThinkingConfig();

  console.log('');
  console.log(header('Thinking Configuration'));
  console.log('');

  // Mode
  const modeText =
    config.mode === 'auto' ? ok('Auto') : config.mode === 'off' ? warn('Off') : info('Manual');
  console.log(`  Mode:      ${modeText}`);

  // Override
  if (config.override !== undefined) {
    console.log(`  Override:  ${color(String(config.override), 'command')}`);
  }

  // Warnings
  console.log(`  Warnings:  ${config.show_warnings !== false ? 'on' : 'off'}`);
  console.log('');

  // Tier defaults
  console.log(subheader('Tier Defaults:'));
  for (const tier of VALID_TIERS) {
    const level = config.tier_defaults?.[tier] ?? DEFAULT_THINKING_TIER_DEFAULTS[tier];
    const isDefault = level === DEFAULT_THINKING_TIER_DEFAULTS[tier];
    const suffix = isDefault ? dim(' (default)') : '';
    console.log(`  ${color(tier.padEnd(10), 'command')} ${level}${suffix}`);
  }
  console.log('');

  // Provider overrides
  const overrides = config.provider_overrides;
  if (overrides && Object.keys(overrides).length > 0) {
    console.log(subheader('Provider Overrides:'));
    for (const [provider, tierOverrides] of Object.entries(overrides)) {
      const parts = Object.entries(tierOverrides)
        .map(([t, l]) => `${t}=${l}`)
        .join(', ');
      console.log(`  ${color(provider.padEnd(10), 'command')} ${parts}`);
    }
    console.log('');
  }

  // Config location
  console.log(subheader('Configuration:'));
  console.log(`  File: ${color('~/.ccs/config.yaml', 'path')}`);
  console.log(`  Section: ${dim('thinking')}`);
  console.log('');

  // Env var hint
  if (process.env.CCS_THINKING) {
    console.log(info(`CCS_THINKING env var active: ${process.env.CCS_THINKING}`));
    console.log('');
  }
}

export async function handleConfigThinkingCommand(args: string[]): Promise<void> {
  await initUI();

  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    return;
  }

  let hasChanges = false;
  const config = loadOrCreateUnifiedConfig();
  const thinkingConfig = config.thinking ?? {
    mode: 'auto' as const,
    tier_defaults: { ...DEFAULT_THINKING_TIER_DEFAULTS },
    show_warnings: true,
  };

  // Validate and apply --mode
  if (options.mode !== undefined) {
    if (!(VALID_THINKING_MODES as readonly string[]).includes(options.mode)) {
      console.error(fail(`Invalid mode: ${options.mode}`));
      console.error(info(`Valid modes: ${VALID_THINKING_MODES.join(', ')}`));
      process.exit(1);
    }
    thinkingConfig.mode = options.mode as 'auto' | 'off' | 'manual';
    hasChanges = true;
  }

  // Validate and apply --override
  if (options.override !== undefined) {
    const normalized = options.override.toLowerCase().trim();
    if (
      !(VALID_THINKING_LEVELS as readonly string[]).includes(normalized) &&
      !/^\d+$/.test(normalized)
    ) {
      console.error(fail(`Invalid override: ${options.override}`));
      console.error(info(`Valid levels: ${VALID_THINKING_LEVELS.join(', ')}, or a number`));
      process.exit(1);
    }
    thinkingConfig.override = /^\d+$/.test(normalized)
      ? Number.parseInt(normalized, 10)
      : normalized;
    hasChanges = true;
  }

  // Apply --clear-override
  if (options.clearOverride) {
    thinkingConfig.override = undefined;
    hasChanges = true;
  }

  // Validate and apply --tier
  if (options.tier) {
    const { tier, level } = options.tier;
    if (!(VALID_TIERS as readonly string[]).includes(tier)) {
      console.error(fail(`Invalid tier: ${tier}`));
      console.error(info(`Valid tiers: ${VALID_TIERS.join(', ')}`));
      process.exit(1);
    }
    if (!(VALID_THINKING_LEVELS as readonly string[]).includes(level.toLowerCase())) {
      console.error(fail(`Invalid level for ${tier}: ${level}`));
      console.error(info(`Valid levels: ${VALID_THINKING_LEVELS.join(', ')}`));
      process.exit(1);
    }
    thinkingConfig.tier_defaults = {
      ...DEFAULT_THINKING_TIER_DEFAULTS,
      ...thinkingConfig.tier_defaults,
      [tier]: level.toLowerCase(),
    };
    hasChanges = true;
  }

  // Validate and apply --provider-override
  if (options.providerOverride) {
    const { provider, tier, level } = options.providerOverride;
    if (!(VALID_TIERS as readonly string[]).includes(tier)) {
      console.error(fail(`Invalid tier: ${tier}`));
      process.exit(1);
    }
    if (!(VALID_THINKING_LEVELS as readonly string[]).includes(level.toLowerCase())) {
      console.error(fail(`Invalid level: ${level}`));
      process.exit(1);
    }
    thinkingConfig.provider_overrides = {
      ...thinkingConfig.provider_overrides,
      [provider]: {
        ...thinkingConfig.provider_overrides?.[provider],
        [tier]: level.toLowerCase(),
      },
    };
    hasChanges = true;
  }

  if (hasChanges) {
    updateUnifiedConfig({ thinking: thinkingConfig });
    console.log(ok('Configuration updated'));
    console.log('');
  }

  // Always show current status
  showStatus();
}
