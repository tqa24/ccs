/**
 * Shared Data Routes (Phase 07)
 *
 * API routes for commands, skills, agents from ~/.ccs/shared/
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
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
  const allowedSkillAgentRoots = new Set<string>([
    sharedDirRoot,
    ...[
      path.join(getClaudeConfigDir(), type),
      path.join(ccsDir, '.claude', type),
      path.join(ccsDir, 'shared', type),
    ]
      .map((dirPath) => safeRealPath(dirPath))
      .filter((dirPath): dirPath is string => typeof dirPath === 'string'),
  ]);

  try {
    const entries = fs.readdirSync(sharedDir, { withFileTypes: true });

    for (const entry of entries) {
      try {
        const entryPath = path.join(sharedDir, entry.name);

        if (type === 'commands') {
          if (!entry.name.endsWith('.md')) {
            continue;
          }
          if (!entry.isFile() && !entry.isSymbolicLink()) {
            continue;
          }

          const commandPath = safeRealPath(entryPath);
          if (!commandPath || !isPathWithin(commandPath, sharedDirRoot)) {
            continue;
          }

          const description = readMarkdownDescription(commandPath, sharedDirRoot);
          if (!description) {
            continue;
          }

          items.push({
            name: entry.name.replace('.md', ''),
            description,
            path: entryPath,
            type: 'command',
          });
          continue;
        }

        // Skills/agents are directory-based and may be symlinked directories.
        if (!entry.isDirectory() && !entry.isSymbolicLink()) {
          continue;
        }

        const entryRoot = safeRealPath(entryPath);
        if (!entryRoot || !isPathWithinAny(entryRoot, allowedSkillAgentRoots)) {
          continue;
        }

        const markdownFile = type === 'skills' ? 'SKILL.md' : 'prompt.md';
        const description = readMarkdownDescription(path.join(entryRoot, markdownFile), entryRoot);
        if (!description) {
          continue;
        }

        items.push({
          name: entry.name,
          description,
          path: entryPath,
          type: type === 'skills' ? 'skill' : 'agent',
        });
      } catch {
        // Fail soft per entry so one bad item does not hide valid results.
      }
    }
  } catch {
    // Directory read failed
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function extractDescription(content: string): string {
  // Extract first non-empty, non-heading line
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      return trimmed.slice(0, 100);
    }
  }
  return 'No description';
}

function readMarkdownDescription(markdownPath: string, allowedRoot: string): string | null {
  try {
    const resolvedMarkdownPath = safeRealPath(markdownPath);
    if (!resolvedMarkdownPath || !isPathWithin(resolvedMarkdownPath, allowedRoot)) {
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
