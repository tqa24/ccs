import * as fs from 'fs';
import * as path from 'path';

export interface JsonFileDiagnostics {
  label: string;
  path: string;
  resolvedPath: string;
  exists: boolean;
  isSymlink: boolean;
  isRegularFile: boolean;
  sizeBytes: number | null;
  mtimeMs: number | null;
  parseError: string | null;
  readError: string | null;
}

export interface JsonFileProbe {
  diagnostics: JsonFileDiagnostics;
  json: Record<string, unknown> | null;
  rawText: string;
}

interface WriteJsonObjectFileInput {
  filePath: string;
  rawText: string;
  expectedMtime?: number;
  fileLabel?: string;
  dirMode?: number;
  fileMode?: number;
}

interface WriteJsonObjectFileResult {
  mtime: number;
}

export class JsonFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonFileValidationError';
  }
}

export class JsonFileConflictError extends Error {
  readonly code = 'CONFLICT';
  readonly mtime: number;

  constructor(message: string, mtime: number) {
    super(message);
    this.name = 'JsonFileConflictError';
    this.mtime = mtime;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function probeJsonObjectFile(
  filePath: string,
  label: string,
  displayPath: string
): JsonFileProbe {
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
  const diagnostics: JsonFileDiagnostics = {
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

export function parseJsonObjectText(
  rawText: string,
  fieldName = 'rawText'
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new JsonFileValidationError(`Invalid JSON in ${fieldName}: ${(error as Error).message}`);
  }

  if (!isObject(parsed)) {
    throw new JsonFileValidationError(`${fieldName} JSON root must be an object.`);
  }

  return parsed;
}

export function writeJsonObjectFileAtomic(
  input: WriteJsonObjectFileInput
): WriteJsonObjectFileResult {
  const fileLabel = input.fileLabel || path.basename(input.filePath);
  const parsed = parseJsonObjectText(input.rawText, fileLabel);
  const targetPath = input.filePath;
  const targetDir = path.dirname(targetPath);
  const tempPath = targetPath + '.tmp';
  const dirMode = input.dirMode ?? 0o700;
  const fileMode = input.fileMode ?? 0o600;

  fs.mkdirSync(targetDir, { recursive: true, mode: dirMode });

  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to write: ${fileLabel} is a symlink.`);
    }
    if (!stat.isFile()) {
      throw new Error(`Refusing to write: ${fileLabel} is not a regular file.`);
    }

    if (typeof input.expectedMtime !== 'number' || !Number.isFinite(input.expectedMtime)) {
      throw new JsonFileConflictError('File metadata not loaded. Refresh and retry.', stat.mtimeMs);
    }
    if (Math.abs(stat.mtimeMs - input.expectedMtime) > 1000) {
      throw new JsonFileConflictError('File modified externally.', stat.mtimeMs);
    }
  }

  let wroteTemp = false;
  try {
    if (fs.existsSync(tempPath)) {
      const tempStat = fs.lstatSync(tempPath);
      if (tempStat.isSymbolicLink()) {
        throw new Error(`Refusing to write: ${fileLabel}.tmp is a symlink.`);
      }
      if (!tempStat.isFile()) {
        throw new Error(`Refusing to write: ${fileLabel}.tmp is not a regular file.`);
      }
    }

    fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2) + '\n', { mode: fileMode });
    wroteTemp = true;

    const tempStat = fs.lstatSync(tempPath);
    if (tempStat.isSymbolicLink()) {
      throw new Error(`Refusing to write: ${fileLabel}.tmp is a symlink.`);
    }
    if (!tempStat.isFile()) {
      throw new Error(`Refusing to write: ${fileLabel}.tmp is not a regular file.`);
    }

    fs.renameSync(tempPath, targetPath);
    wroteTemp = false;

    try {
      fs.chmodSync(targetPath, fileMode);
    } catch {
      // Best-effort permission hardening.
    }

    const stat = fs.statSync(targetPath);
    return { mtime: stat.mtimeMs };
  } finally {
    if (wroteTemp && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}
