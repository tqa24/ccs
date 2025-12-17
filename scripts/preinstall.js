#!/usr/bin/env node
'use strict';

/**
 * CCS Preinstall Script
 * Installs dependencies in ui/ folder before main install
 *
 * Runs when: bun install, npm install, yarn install
 * Skips when: CI environment or global install (npm -g)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Skip in CI environments or global installs
if (process.env.CI || process.env.npm_config_global === 'true') {
  process.exit(0);
}

const uiDir = path.join(__dirname, '..', 'ui');
const uiPackageJson = path.join(uiDir, 'package.json');

// Skip if ui/ folder or package.json doesn't exist
if (!fs.existsSync(uiPackageJson)) {
  process.exit(0);
}

// Detect package manager (prefer bun > npm)
function getPackageManager() {
  // Check if running via bun
  if (process.env.npm_execpath?.includes('bun') || process.env._?.includes('bun')) {
    return 'bun';
  }
  // Check if bun is available
  try {
    execSync('bun --version', { stdio: 'ignore' });
    return 'bun';
  } catch {
    return 'npm';
  }
}

const pm = getPackageManager();

console.log(`[i] Installing ui/ dependencies with ${pm}...`);

try {
  execSync(`${pm} install`, {
    cwd: uiDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_global: undefined }
  });
  console.log('[OK] ui/ dependencies installed');
} catch (err) {
  console.error('[!] Failed to install ui/ dependencies:', err.message);
  console.error('    You can manually install: cd ui && bun install');
  // Don't fail the main install - ui is optional for CLI usage
}
