#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { error, colored } = require('./helpers');
const { detectClaudeCli, showClaudeNotFoundError } = require('./claude-detector');
const { getSettingsPath, getConfigPath } = require('./config-manager');

// Version (sync with package.json)
const CCS_VERSION = require('../package.json').version;

// Execute Claude CLI with unified spawn logic
function execClaude(claudeCli, args) {
  // Use shell only on Windows for .cmd/.bat compatibility
  const child = spawn(claudeCli, args, {
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32'
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code || 0);
  });
  child.on('error', () => {
    showClaudeNotFoundError();
    process.exit(1);
  });
}

// Special command handlers
function handleVersionCommand() {
  // Title
  console.log(colored(`CCS (Claude Code Switch) v${CCS_VERSION}`, 'bold'));
  console.log('');

  // Installation section
  console.log(colored('Installation:', 'cyan'));

  // Location
  const installLocation = process.argv[1] || '(not found)';
  console.log(`  ${colored('Location:', 'cyan')} ${installLocation}`);

  // Config path
  const configPath = getConfigPath();
  console.log(`  ${colored('Config:', 'cyan')} ${configPath}`);
  console.log('');

  // Documentation
  console.log(`${colored('Documentation:', 'cyan')} https://github.com/kaitranntt/ccs`);
  console.log(`${colored('License:', 'cyan')} MIT`);
  console.log('');

  // Help hint
  console.log(colored('Run \'ccs --help\' for usage information', 'yellow'));

  process.exit(0);
}

function handleHelpCommand() {
  // Title
  console.log(colored('CCS (Claude Code Switch) - Instant profile switching for Claude CLI', 'bold'));
  console.log('');

  // Usage
  console.log(colored('Usage:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')} [profile] [claude-args...]`);
  console.log(`  ${colored('ccs', 'yellow')} [flags]`);
  console.log('');

  // Description
  console.log(colored('Description:', 'cyan'));
  console.log('  Switch between Claude models instantly. Stop hitting rate limits.');
  console.log('  Maps profile names to Claude settings files via ~/.ccs/config.json');
  console.log('');

  // Profile Switching
  console.log(colored('Profile Switching:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')}                         Use default profile`);
  console.log(`  ${colored('ccs glm', 'yellow')}                     Switch to GLM profile`);
  console.log(`  ${colored('ccs glm', 'yellow')} "debug this code"   Switch to GLM and run command`);
  console.log(`  ${colored('ccs glm', 'yellow')} --verbose           Switch to GLM with Claude flags`);
  console.log('');

  // Flags
  console.log(colored('Flags:', 'cyan'));
  console.log(`  ${colored('-h, --help', 'yellow')}                  Show this help message`);
  console.log(`  ${colored('-v, --version', 'yellow')}               Show version and installation info`);
  console.log('');

  // Configuration
  console.log(colored('Configuration:', 'cyan'));
  console.log('  Config File: ~/.ccs/config.json');
  console.log('  Settings:    ~/.ccs/*.settings.json');
  console.log('  Environment: CCS_CONFIG (override config path)');
  console.log('');

  // Examples
  console.log(colored('Examples:', 'cyan'));
  console.log('  # Try without installing');
  console.log(`  ${colored('npx @kaitranntt/ccs glm', 'yellow')} "write tests"`);
  console.log('');
  console.log('  # Use default Claude subscription');
  console.log(`  ${colored('ccs', 'yellow')} "Review this architecture"`);
  console.log('');
  console.log('  # Switch to GLM for cost-effective tasks');
  console.log(`  ${colored('ccs glm', 'yellow')} "Write unit tests"`);
  console.log('');
  console.log('  # Use GLM with verbose output');
  console.log(`  ${colored('ccs glm', 'yellow')} --verbose "Debug error"`);
  console.log('');

  // Uninstall
  console.log(colored('Uninstall:', 'yellow'));
  console.log('  npm:          npm uninstall -g @kaitranntt/ccs');
  console.log('  macOS/Linux:  curl -fsSL ccs.kaitran.ca/uninstall | bash');
  console.log('  Windows:      irm ccs.kaitran.ca/uninstall | iex');
  console.log('');

  // Documentation
  console.log(colored('Documentation:', 'cyan'));
  console.log(`  GitHub:  ${colored('https://github.com/kaitranntt/ccs', 'cyan')}`);
  console.log('  Docs:    https://github.com/kaitranntt/ccs/blob/main/README.md');
  console.log('  Issues:  https://github.com/kaitranntt/ccs/issues');
  console.log('');

  // License
  console.log(`${colored('License:', 'cyan')} MIT`);

  process.exit(0);
}

function handleInstallCommand() {
  console.log('');
  console.log('Feature not available');
  console.log('');
  console.log('The --install flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log('For updates: https://github.com/kaitranntt/ccs/issues');
  console.log('');
  process.exit(0);
}

function handleUninstallCommand() {
  console.log('');
  console.log('Feature not available');
  console.log('');
  console.log('The --uninstall flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log('For updates: https://github.com/kaitranntt/ccs/issues');
  console.log('');
  process.exit(0);
}

// Smart profile detection
function detectProfile(args) {
  if (args.length === 0 || args[0].startsWith('-')) {
    // No args or first arg is a flag → use default profile
    return { profile: 'default', remainingArgs: args };
  } else {
    // First arg doesn't start with '-' → treat as profile name
    return { profile: args[0], remainingArgs: args.slice(1) };
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  // Special case: version command (check BEFORE profile detection)
  const firstArg = args[0];
  if (firstArg === 'version' || firstArg === '--version' || firstArg === '-v') {
    handleVersionCommand();
  }

  // Special case: help command
  if (firstArg === '--help' || firstArg === '-h' || firstArg === 'help') {
    handleHelpCommand();
    return;
  }

  // Special case: install command
  if (firstArg === '--install') {
    handleInstallCommand();
    return;
  }

  // Special case: uninstall command
  if (firstArg === '--uninstall') {
    handleUninstallCommand();
    return;
  }

  // Detect profile
  const { profile, remainingArgs } = detectProfile(args);

  // Special case: "default" profile just runs claude directly
  if (profile === 'default') {
    const claudeCli = detectClaudeCli();
    if (!claudeCli) {
      showClaudeNotFoundError();
      process.exit(1);
    }

    execClaude(claudeCli, remainingArgs);
    return;
  }

  // Get settings path for profile
  const settingsPath = getSettingsPath(profile);

  // Detect Claude CLI
  const claudeCli = detectClaudeCli();

  // Check if claude was found
  if (!claudeCli) {
    showClaudeNotFoundError();
    process.exit(1);
  }

  // Execute claude with --settings
  execClaude(claudeCli, ['--settings', settingsPath, ...remainingArgs]);
}

// Run main
main();