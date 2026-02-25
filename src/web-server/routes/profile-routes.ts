/**
 * Profile Routes - CRUD operations for user profiles
 *
 * Uses unified config (config.yaml) when available, falls back to legacy (config.json).
 * Note: Account routes have been moved to account-routes.ts
 */

import { Router, Request, Response } from 'express';
import { isReservedName, RESERVED_PROFILE_NAMES } from '../../config/reserved-names';
import {
  createApiProfile,
  removeApiProfile,
  updateApiProfileTarget,
} from '../../api/services/profile-writer';
import { apiProfileExists, listApiProfiles } from '../../api/services/profile-reader';
import type { TargetType } from '../../targets/target-adapter';
import { normalizeDroidProvider } from '../../targets/droid-provider';
import { updateSettingsFile } from './route-helpers';

const router = Router();

export function parseTarget(rawTarget: unknown): TargetType | null {
  if (rawTarget === undefined || rawTarget === null || rawTarget === '') {
    return null;
  }

  if (typeof rawTarget !== 'string') {
    return null;
  }

  const normalized = rawTarget.trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'droid') {
    return normalized;
  }

  return null;
}

// ==================== Profile CRUD ====================

/**
 * GET /api/profiles - List all profiles
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const result = listApiProfiles();
    // Map isConfigured -> configured for UI compatibility
    const profiles = result.profiles.map((p) => ({
      name: p.name,
      settingsPath: p.settingsPath,
      configured: p.isConfigured,
      target: p.target,
    }));
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/profiles - Create new profile
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel, target } = req.body;
  const providerHint = req.body?.droidProvider ?? req.body?.provider;
  const parsedProvider = normalizeDroidProvider(providerHint);

  const parsedTarget = parseTarget(target);
  if (target !== undefined && parsedTarget === null) {
    res.status(400).json({ error: 'Invalid target. Expected: claude or droid' });
    return;
  }
  if (providerHint !== undefined && parsedProvider === null) {
    res.status(400).json({
      error: 'Invalid droid provider. Expected: anthropic, openai, or generic-chat-completion-api',
    });
    return;
  }

  if (!name || !baseUrl || !apiKey) {
    res.status(400).json({ error: 'Missing required fields: name, baseUrl, apiKey' });
    return;
  }

  // Validate reserved names
  if (isReservedName(name)) {
    res.status(400).json({
      error: `Profile name '${name}' is reserved`,
      reserved: RESERVED_PROFILE_NAMES,
    });
    return;
  }

  // Check if profile already exists (uses unified config when available)
  if (apiProfileExists(name)) {
    res.status(409).json({ error: 'Profile already exists' });
    return;
  }

  // Create profile using unified-config-aware service
  const result = createApiProfile(
    name,
    baseUrl,
    apiKey,
    {
      default: model || '',
      opus: opusModel || model || '',
      sonnet: sonnetModel || model || '',
      haiku: haikuModel || model || '',
    },
    parsedTarget || 'claude',
    parsedProvider || undefined
  );

  if (!result.success) {
    res.status(500).json({ error: result.error || 'Failed to create profile' });
    return;
  }

  res.status(201).json({
    name,
    settingsPath: result.settingsFile,
    target: parsedTarget || 'claude',
  });
});

/**
 * PUT /api/profiles/:name - Update profile
 */
router.put('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;
  const { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel, target } = req.body;
  const providerHint = req.body?.droidProvider ?? req.body?.provider;
  const parsedProvider = normalizeDroidProvider(providerHint);

  const parsedTarget = parseTarget(target);
  if (target !== undefined && parsedTarget === null) {
    res.status(400).json({ error: 'Invalid target. Expected: claude or droid' });
    return;
  }
  if (providerHint !== undefined && parsedProvider === null) {
    res.status(400).json({
      error: 'Invalid droid provider. Expected: anthropic, openai, or generic-chat-completion-api',
    });
    return;
  }

  // Check if profile exists (uses unified config when available)
  if (!apiProfileExists(name)) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Validate required fields if provided (prevent setting to empty)
  if (baseUrl !== undefined && !baseUrl.trim()) {
    res.status(400).json({ error: 'baseUrl cannot be empty' });
    return;
  }
  if (apiKey !== undefined && !apiKey.trim()) {
    res.status(400).json({ error: 'apiKey cannot be empty' });
    return;
  }

  try {
    const hasSettingsUpdates =
      baseUrl !== undefined ||
      apiKey !== undefined ||
      model !== undefined ||
      opusModel !== undefined ||
      sonnetModel !== undefined ||
      haikuModel !== undefined ||
      providerHint !== undefined;
    const hasTargetUpdate = target !== undefined;

    if (!hasSettingsUpdates && !hasTargetUpdate) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    if (hasSettingsUpdates) {
      updateSettingsFile(name, {
        baseUrl,
        apiKey,
        model,
        opusModel,
        sonnetModel,
        haikuModel,
        provider: parsedProvider || undefined,
      });
    }

    if (hasTargetUpdate && parsedTarget) {
      const targetUpdate = updateApiProfileTarget(name, parsedTarget);
      if (!targetUpdate.success) {
        res.status(500).json({ error: targetUpdate.error || 'Failed to update target' });
        return;
      }
    }

    res.json({
      name,
      updated: true,
      ...(hasTargetUpdate && parsedTarget && { target: parsedTarget }),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/profiles/:name - Delete profile
 */
router.delete('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;

  // Check if profile exists (uses unified config when available)
  if (!apiProfileExists(name)) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Remove profile using unified-config-aware service
  const result = removeApiProfile(name);

  if (!result.success) {
    res.status(500).json({ error: result.error || 'Failed to delete profile' });
    return;
  }

  res.json({ name, deleted: true });
});

export default router;
