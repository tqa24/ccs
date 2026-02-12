#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const DEFAULT_BASELINE_PATH = path.join(
  PROJECT_ROOT,
  'docs',
  'metrics',
  'maintainability-baseline.json'
);

const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.cts', '.mts']);
const LARGE_FILE_THRESHOLD_LOC = 350;

const FS_SYNC_APIS = [
  'accessSync',
  'appendFileSync',
  'chmodSync',
  'chownSync',
  'closeSync',
  'copyFileSync',
  'cpSync',
  'existsSync',
  'fchmodSync',
  'fchownSync',
  'fdatasyncSync',
  'fstatSync',
  'fsyncSync',
  'ftruncateSync',
  'futimesSync',
  'lchmodSync',
  'lchownSync',
  'linkSync',
  'lstatSync',
  'lutimesSync',
  'mkdirSync',
  'mkdtempSync',
  'openSync',
  'opendirSync',
  'readFileSync',
  'readdirSync',
  'readlinkSync',
  'readSync',
  'realpathSync',
  'renameSync',
  'rmSync',
  'rmdirSync',
  'statSync',
  'symlinkSync',
  'truncateSync',
  'unlinkSync',
  'utimesSync',
  'writeFileSync',
  'writeSync',
  'writevSync',
];

const PROCESS_EXIT_PATTERN = /\bprocess\s*\.\s*exit\b/g;
const FS_SYNC_PATTERN = new RegExp(`\\b(?:${FS_SYNC_APIS.join('|')})\\b`, 'g');

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/maintainability-baseline.js',
      '  node scripts/maintainability-baseline.js --out [path]',
      '  node scripts/maintainability-baseline.js --check [path]',
      '',
      'Defaults:',
      `  baseline path: ${path.relative(PROJECT_ROOT, DEFAULT_BASELINE_PATH)}`,
    ].join('\n')
  );
}

function parseArgs(argv) {
  const options = {
    outPath: null,
    checkPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--out' || arg === '--write') {
      const nextArg = argv[index + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options.outPath = nextArg;
        index += 1;
      } else {
        options.outPath = path.relative(process.cwd(), DEFAULT_BASELINE_PATH);
      }
      continue;
    }

    if (arg === '--check') {
      const nextArg = argv[index + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options.checkPath = nextArg;
        index += 1;
      } else {
        options.checkPath = path.relative(process.cwd(), DEFAULT_BASELINE_PATH);
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function collectFiles(dirPath) {
  const collected = [];
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      collected.push(fullPath);
    }
  }

  return collected;
}

function countLines(content) {
  if (content.length === 0) {
    return 0;
  }

  const lineBreakMatches = content.match(/\r\n|\n|\r/g);
  const lineBreakCount = lineBreakMatches ? lineBreakMatches.length : 0;
  const endsWithLineBreak = content.endsWith('\n') || content.endsWith('\r');

  return endsWithLineBreak ? lineBreakCount : lineBreakCount + 1;
}

function countMatches(content, pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function collectMetrics() {
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Directory not found: ${SRC_DIR}`);
  }

  const files = collectFiles(SRC_DIR);

  let typeScriptFileCount = 0;
  let locInSrc = 0;
  let processExitReferenceCount = 0;
  let synchronousFsApiReferenceCount = 0;
  let largeFileCountOver350Loc = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const loc = countLines(content);
    const extension = path.extname(filePath).toLowerCase();
    const isTypeScriptFile = TYPESCRIPT_EXTENSIONS.has(extension);

    locInSrc += loc;
    processExitReferenceCount += countMatches(content, PROCESS_EXIT_PATTERN);
    synchronousFsApiReferenceCount += countMatches(content, FS_SYNC_PATTERN);

    if (isTypeScriptFile) {
      typeScriptFileCount += 1;
      if (loc > LARGE_FILE_THRESHOLD_LOC) {
        largeFileCountOver350Loc += 1;
      }
    }
  }

  return {
    sourceDirectory: 'src',
    largeFileThresholdLoc: LARGE_FILE_THRESHOLD_LOC,
    typeScriptFileCount,
    locInSrc,
    processExitReferenceCount,
    synchronousFsApiReferenceCount,
    largeFileCountOver350Loc,
  };
}

function writeMetrics(outPath, metrics) {
  const resolvedOutPath = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
  fs.writeFileSync(resolvedOutPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
}

function runCheck(checkPath, currentMetrics) {
  const resolvedCheckPath = path.resolve(process.cwd(), checkPath);
  const baselineContent = fs.readFileSync(resolvedCheckPath, 'utf8');
  const baselineMetrics = JSON.parse(baselineContent);

  const gatedKeys = [
    'processExitReferenceCount',
    'synchronousFsApiReferenceCount',
    'largeFileCountOver350Loc',
  ];

  const violations = [];
  for (const key of gatedKeys) {
    if (typeof baselineMetrics[key] !== 'number') {
      throw new Error(`Baseline is missing numeric metric: ${key}`);
    }

    if (currentMetrics[key] > baselineMetrics[key]) {
      violations.push({
        metric: key,
        baseline: baselineMetrics[key],
        current: currentMetrics[key],
      });
    }
  }

  return {
    gate: 'maintainability-baseline',
    baselinePath: path.relative(PROJECT_ROOT, resolvedCheckPath),
    passed: violations.length === 0,
    comparedMetrics: gatedKeys,
    baseline: {
      typeScriptFileCount: baselineMetrics.typeScriptFileCount,
      locInSrc: baselineMetrics.locInSrc,
      processExitReferenceCount: baselineMetrics.processExitReferenceCount,
      synchronousFsApiReferenceCount: baselineMetrics.synchronousFsApiReferenceCount,
      largeFileCountOver350Loc: baselineMetrics.largeFileCountOver350Loc,
    },
    current: {
      typeScriptFileCount: currentMetrics.typeScriptFileCount,
      locInSrc: currentMetrics.locInSrc,
      processExitReferenceCount: currentMetrics.processExitReferenceCount,
      synchronousFsApiReferenceCount: currentMetrics.synchronousFsApiReferenceCount,
      largeFileCountOver350Loc: currentMetrics.largeFileCountOver350Loc,
    },
    violations,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const metrics = collectMetrics();

  if (options.outPath) {
    writeMetrics(options.outPath, metrics);
  }

  if (options.checkPath) {
    const checkResult = runCheck(options.checkPath, metrics);
    console.log(JSON.stringify(checkResult, null, 2));
    if (!checkResult.passed) {
      process.exit(1);
    }
    return;
  }

  console.log(JSON.stringify(metrics, null, 2));
}

main();
