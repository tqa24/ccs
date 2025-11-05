'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// TTY-aware color detection (matches lib/ccs bash logic)
function getColors() {
  const forcedColors = process.env.FORCE_COLOR;
  const noColor = process.env.NO_COLOR;
  const isTTY = process.stdout.isTTY === true;  // Must be explicitly true

  const useColors = forcedColors || (isTTY && !noColor);

  if (useColors) {
    return {
      red: '\x1b[0;31m',
      yellow: '\x1b[1;33m',
      cyan: '\x1b[0;36m',
      green: '\x1b[0;32m',
      bold: '\x1b[1m',
      reset: '\x1b[0m'
    };
  }

  return { red: '', yellow: '', cyan: '', green: '', bold: '', reset: '' };
}


// Colors object (dynamic)
const colors = getColors();

// Helper: Apply color to text (returns plain text if colors disabled)
function colored(text, colorName = 'reset') {
  const currentColors = getColors();
  const color = currentColors[colorName] || '';
  return color ? `${color}${text}${currentColors.reset}` : text;
}

// Simple error formatting
function error(message) {
  console.error(`ERROR: ${message}`);
  console.error('Try: npm install -g @kaitranntt/ccs --force');
  process.exit(1);
}

// Path expansion (~ and env vars)
function expandPath(pathStr) {
  // Handle tilde expansion
  if (pathStr.startsWith('~/') || pathStr.startsWith('~\\')) {
    pathStr = path.join(os.homedir(), pathStr.slice(2));
  }

  // Expand environment variables (Windows and Unix)
  pathStr = pathStr.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
  pathStr = pathStr.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, name) => process.env[name] || '');

  // Windows %VAR% style
  if (process.platform === 'win32') {
    pathStr = pathStr.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
  }

  return path.normalize(pathStr);
}


module.exports = {
  colors,
  colored,
  error,
  expandPath
};