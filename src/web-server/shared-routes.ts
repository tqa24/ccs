/**
 * Shared Data Routes (Phase 07)
 *
 * API routes for commands, skills, agents from ~/.ccs/shared/
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getCcsDir } from '../utils/config-manager';
import { getClaudeConfigDir } from '../utils/claude-config-path';

export const sharedRoutes = Router();

interface SharedItem {
  name: string;
  description: string;
  path: string;
  type: 'command' | 'skill' | 'agent';
}

/**
 * GET /api/shared/commands
 */
sharedRoutes.get('/commands', (_req: Request, res: Response) => {
  const items = getSharedItems('commands');
  res.json({ items });
});

/**
 * GET /api/shared/skills
 */
sharedRoutes.get('/skills', (_req: Request, res: Response) => {
  const items = getSharedItems('skills');
  res.json({ items });
});

/**
 * GET /api/shared/agents
 */
sharedRoutes.get('/agents', (_req: Request, res: Response) => {
  const items = getSharedItems('agents');
  res.json({ items });
});

/**
 * GET /api/shared/summary
 */
sharedRoutes.get('/summary', (_req: Request, res: Response) => {
  const commands = getSharedItems('commands').length;
  const skills = getSharedItems('skills').length;
  const agents = getSharedItems('agents').length;

  res.json({
    commands,
    skills,
    agents,
    total: commands + skills + agents,
    symlinkStatus: checkSymlinkStatus(),
  });
});

function getSharedItems(type: 'commands' | 'skills' | 'agents'): SharedItem[] {
  const ccsDir = getCcsDir();
  const sharedDir = path.join(ccsDir, 'shared', type);

  if (!fs.existsSync(sharedDir)) {
    return [];
  }

  const items: SharedItem[] = [];
  const sharedDirRoot = safeRealPath(sharedDir) ?? path.resolve(sharedDir);
  const allowedRoots = new Set<string>([
    sharedDirRoot,
    ...[
      path.join(getClaudeConfigDir(), type),
      path.join(ccsDir, '.claude', type),
      path.join(ccsDir, 'shared', type),
    ]
      .map((dirPath) => safeRealPath(dirPath))
      .filter((dirPath): dirPath is string => typeof dirPath === 'string'),
  ]);

  if (type === 'commands') {
    return getCommandItems(sharedDir, allowedRoots);
  }

  try {
    const entries = fs.readdirSync(sharedDir, { withFileTypes: true });

    for (const entry of entries) {
      try {
        const entryPath = path.join(sharedDir, entry.name);
        const resolvedEntryPath = safeRealPath(entryPath);
        if (!resolvedEntryPath || !isPathWithinAny(resolvedEntryPath, allowedRoots)) {
          continue;
        }

        const stats = fs.statSync(resolvedEntryPath);
        const item = getSkillOrAgentItem(
          type,
          entry,
          entryPath,
          resolvedEntryPath,
          allowedRoots,
          stats
        );
        if (!item) {
          continue;
        }

        items.push(item);
      } catch {
        // Fail soft per entry so one bad item does not hide valid results.
      }
    }
  } catch {
    // Directory read failed
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function getCommandItems(sharedDir: string, allowedRoots: Set<string>): SharedItem[] {
  const markdownFiles = collectMarkdownFiles(sharedDir, allowedRoots);
  const items: SharedItem[] = [];

  for (const markdownFile of markdownFiles) {
    const description = readMarkdownDescription(markdownFile.resolvedPath, allowedRoots);
    if (!description) {
      continue;
    }

    const relativePath = path.relative(sharedDir, markdownFile.displayPath);
    const normalizedName = relativePath.split(path.sep).join('/').replace(/\.md$/i, '');
    if (!normalizedName) {
      continue;
    }

    items.push({
      name: normalizedName,
      description,
      path: markdownFile.displayPath,
      type: 'command',
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function getSkillOrAgentItem(
  type: 'skills' | 'agents',
  entry: fs.Dirent,
  entryPath: string,
  resolvedEntryPath: string,
  allowedRoots: Set<string>,
  stats: fs.Stats
): SharedItem | null {
  if (type === 'skills') {
    if (!stats.isDirectory()) {
      return null;
    }

    const description = readMarkdownDescription(
      path.join(resolvedEntryPath, 'SKILL.md'),
      allowedRoots
    );
    if (!description) {
      return null;
    }

    return {
      name: entry.name,
      description,
      path: entryPath,
      type: 'skill',
    };
  }

  if (stats.isDirectory()) {
    const description = readFirstMarkdownDescription(
      [
        path.join(resolvedEntryPath, 'prompt.md'),
        path.join(resolvedEntryPath, 'AGENT.md'),
        path.join(resolvedEntryPath, 'agent.md'),
      ],
      allowedRoots
    );
    if (!description) {
      return null;
    }

    return {
      name: entry.name,
      description,
      path: entryPath,
      type: 'agent',
    };
  }

  if (!stats.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
    return null;
  }

  const description = readMarkdownDescription(resolvedEntryPath, allowedRoots);
  if (!description) {
    return null;
  }

  return {
    name: entry.name.replace(/\.md$/i, ''),
    description,
    path: entryPath,
    type: 'agent',
  };
}

interface MarkdownFileEntry {
  displayPath: string;
  resolvedPath: string;
}

function collectMarkdownFiles(sharedDir: string, allowedRoots: Set<string>): MarkdownFileEntry[] {
  const directoriesToVisit = [sharedDir];
  const visitedDirectories = new Set<string>();
  const markdownFiles: MarkdownFileEntry[] = [];

  while (directoriesToVisit.length > 0) {
    const currentDir = directoriesToVisit.pop();
    if (!currentDir) {
      continue;
    }

    const resolvedCurrentDir = safeRealPath(currentDir);
    if (!resolvedCurrentDir || !isPathWithinAny(resolvedCurrentDir, allowedRoots)) {
      continue;
    }

    const normalizedDirPath = normalizeForPathComparison(resolvedCurrentDir);
    if (visitedDirectories.has(normalizedDirPath)) {
      continue;
    }
    visitedDirectories.add(normalizedDirPath);

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      const resolvedEntryPath = safeRealPath(entryPath);
      if (!resolvedEntryPath || !isPathWithinAny(resolvedEntryPath, allowedRoots)) {
        continue;
      }

      let stats: fs.Stats;
      try {
        stats = fs.statSync(resolvedEntryPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        directoriesToVisit.push(entryPath);
        continue;
      }

      if (stats.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        markdownFiles.push({
          displayPath: entryPath,
          resolvedPath: resolvedEntryPath,
        });
      }
    }
  }

  return markdownFiles;
}

function extractDescription(content: string): string {
  const frontmatterDescription = extractFrontmatterDescription(content);
  if (frontmatterDescription) {
    return trimDescription(frontmatterDescription);
  }

  // Extract first non-empty, non-heading line from the markdown body.
  const lines = stripFrontmatter(content).split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('<!--')) {
      return trimDescription(trimmed);
    }
  }

  return 'No description';
}

function extractFrontmatterDescription(content: string): string | null {
  const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!frontmatterMatch) {
    return null;
  }

  try {
    const parsed = yaml.load(frontmatterMatch[1]) as Record<string, unknown> | null;
    const description = parsed?.description;
    if (typeof description !== 'string') {
      return null;
    }

    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
}

function trimDescription(description: string): string {
  const maxLength = 140;
  if (description.length <= maxLength) {
    return description;
  }

  return `${description.slice(0, maxLength - 3).trimEnd()}...`;
}

function readFirstMarkdownDescription(
  markdownPaths: string[],
  allowedRoots: Set<string>
): string | null {
  for (const markdownPath of markdownPaths) {
    const description = readMarkdownDescription(markdownPath, allowedRoots);
    if (description) {
      return description;
    }
  }

  return null;
}

function readMarkdownDescription(markdownPath: string, allowedRoots: Set<string>): string | null {
  try {
    const resolvedMarkdownPath = safeRealPath(markdownPath);
    if (!resolvedMarkdownPath || !isPathWithinAny(resolvedMarkdownPath, allowedRoots)) {
      return null;
    }

    const stats = fs.statSync(resolvedMarkdownPath);
    if (!stats.isFile()) {
      return null;
    }
    const content = fs.readFileSync(resolvedMarkdownPath, 'utf8');
    return extractDescription(content);
  } catch {
    return null;
  }
}

function safeRealPath(targetPath: string): string | null {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return null;
  }
}

function isPathWithin(candidatePath: string, basePath: string): boolean {
  const normalizedCandidate = normalizeForPathComparison(candidatePath);
  const normalizedBase = normalizeForPathComparison(basePath);
  const relative = path.relative(normalizedBase, normalizedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isPathWithinAny(candidatePath: string, basePaths: Set<string>): boolean {
  for (const basePath of basePaths) {
    if (isPathWithin(candidatePath, basePath)) {
      return true;
    }
  }
  return false;
}

function normalizeForPathComparison(targetPath: string): string {
  const normalized = path.resolve(targetPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function checkSymlinkStatus(): { valid: boolean; message: string } {
  const ccsDir = getCcsDir();
  const sharedDir = path.join(ccsDir, 'shared');

  if (!fs.existsSync(sharedDir)) {
    return { valid: false, message: 'Shared directory not found' };
  }

  // Check all three symlinks: commands, skills, agents
  const linkTypes = ['commands', 'skills', 'agents'];
  let validLinks = 0;

  for (const linkType of linkTypes) {
    const linkPath = path.join(sharedDir, linkType);

    try {
      if (fs.existsSync(linkPath)) {
        const stats = fs.lstatSync(linkPath);
        if (stats.isSymbolicLink()) {
          const target = fs.readlinkSync(linkPath);
          // Check if it points to Claude config dir.
          const expectedTarget = path.join(getClaudeConfigDir(), linkType);
          if (path.resolve(path.dirname(linkPath), target) === path.resolve(expectedTarget)) {
            validLinks++;
          }
        }
      }
    } catch {
      // Not a symlink or read error
    }
  }

  if (validLinks === linkTypes.length) {
    return { valid: true, message: 'Symlinks active' };
  } else if (validLinks > 0) {
    return {
      valid: false,
      message: `Symlinks partially configured (${validLinks}/${linkTypes.length})`,
    };
  }

  return { valid: false, message: 'Symlinks not configured' };
}
