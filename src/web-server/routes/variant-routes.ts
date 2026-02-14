/**
 * Variant Routes - CLIProxy variant management (custom profiles)
 *
 * Uses variant-service.ts for proper port allocation and cleanup.
 */

import { Router, Request, Response } from 'express';
import { isReservedName, RESERVED_PROFILE_NAMES } from '../../config/reserved-names';
import type { CLIProxyProvider } from '../../cliproxy/types';
import {
  createVariant,
  removeVariant,
  listVariants,
  validateProfileName,
  updateVariant,
  createCompositeVariant,
  updateCompositeVariant,
} from '../../cliproxy/services/variant-service';
import {
  validateCompositeDefaultTier,
  validateCompositeTiers,
} from '../../cliproxy/composite-validator';

const router = Router();

/**
 * GET /api/cliproxy - List cliproxy variants
 * Uses variant-service for consistent behavior with CLI
 */
router.get('/', (_req: Request, res: Response) => {
  const variants = listVariants();
  const variantList = Object.entries(variants).map(([name, variant]) => ({
    name,
    provider: variant.provider,
    settings: variant.settings,
    account: variant.account || 'default',
    port: variant.port, // Include port for port isolation
    model: variant.model,
    type: variant.type,
    default_tier: variant.default_tier,
    tiers: variant.tiers,
  }));

  res.json({ variants: variantList });
});

/**
 * POST /api/cliproxy - Create cliproxy variant
 * Uses variant-service for proper port allocation
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, provider, model, account, type, default_tier, tiers } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' });
    return;
  }

  // Validate profile name
  const validationError = validateProfileName(name);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  // Reject reserved names (extra safety check)
  if (isReservedName(name)) {
    res.status(400).json({
      error: `Cannot use reserved name '${name}' as variant name`,
      reserved: RESERVED_PROFILE_NAMES,
    });
    return;
  }

  // Handle composite variant creation
  if (type === 'composite') {
    if (!default_tier || !tiers) {
      res.status(400).json({ error: 'Missing required fields: default_tier, tiers' });
      return;
    }

    // Validate tiers shape, providers, and default_tier (all tiers required for create)
    const tierError = validateCompositeTiers(tiers, {
      defaultTier: default_tier,
      requireAllTiers: true,
    });
    if (tierError) {
      res.status(400).json({ error: tierError });
      return;
    }

    let result;
    try {
      result = createCompositeVariant({ name, defaultTier: default_tier, tiers });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (!result.success) {
      res.status(409).json({ error: result.error });
      return;
    }

    res.status(201).json({
      name,
      type: 'composite',
      default_tier,
      tiers,
      settings: result.settingsPath,
      port: result.variant?.port,
    });
    return;
  }

  // Handle single provider variant creation
  if (!provider) {
    res.status(400).json({ error: 'Missing required field: provider' });
    return;
  }

  // Require model for variant creation (prevents empty model causing issues)
  if (!model || !model.trim()) {
    res.status(400).json({ error: 'Missing required field: model' });
    return;
  }

  // Use variant-service for proper port allocation
  const result = createVariant(name, provider as CLIProxyProvider, model, account);

  if (!result.success) {
    res.status(409).json({ error: result.error });
    return;
  }

  res.status(201).json({
    name,
    provider,
    settings: result.settingsPath,
    account: account || 'default',
    port: result.variant?.port,
    model: result.variant?.model,
  });
});

/**
 * PUT /api/cliproxy/:name - Update cliproxy variant
 * Uses variant-service for consistent behavior with CLI
 *
 * TODO: Add file-based locking (e.g., proper-lockfile) to prevent concurrent modification
 * Current behavior: last-write-wins if two requests modify same variant simultaneously
 */
router.put('/:name', (req: Request, res: Response): void => {
  try {
    const { name } = req.params;
    const { provider, account, model, default_tier, tiers } = req.body;

    // Check if variant is composite - use updateCompositeVariant if so
    const variants = listVariants();
    const existing = variants[name];

    if (!existing) {
      res.status(404).json({ error: `Variant '${name}' not found` });
      return;
    }

    if (existing.type === 'composite') {
      if (!default_tier && !tiers) {
        res.status(400).json({ error: 'Must provide at least default_tier or tiers' });
        return;
      }

      // Validate tiers shape, providers, and default_tier if provided
      if (tiers) {
        const tierError = validateCompositeTiers(tiers, {
          defaultTier: default_tier,
        });
        if (tierError) {
          res.status(400).json({ error: tierError });
          return;
        }
      } else {
        const defaultTierError = validateCompositeDefaultTier(default_tier);
        if (defaultTierError) {
          res.status(400).json({
            error: defaultTierError,
          });
          return;
        }
      }

      const result = updateCompositeVariant(name, { defaultTier: default_tier, tiers });

      if (!result.success) {
        const status = result.error?.includes('not found') ? 404 : 400;
        res.status(status).json({
          error: result.error,
        });
        return;
      }

      const persisted = result.variant;
      res.json({
        name,
        type: 'composite',
        default_tier: persisted?.default_tier,
        tiers: persisted?.tiers,
        settings: persisted?.settings,
        port: persisted?.port,
        updated: true,
      });
      return;
    }

    // Use variant-service for proper update handling (single provider)
    const result = updateVariant(name, { provider, account, model });

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 : 400;
      res.status(status).json({ error: result.error });
      return;
    }

    res.json({
      name,
      provider: result.variant?.provider,
      account: result.variant?.account || 'default',
      settings: result.variant?.settings,
      port: result.variant?.port,
      updated: true,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/cliproxy/:name - Delete cliproxy variant
 * Uses variant-service for proper port-specific file cleanup
 */
router.delete('/:name', (req: Request, res: Response): void => {
  try {
    const { name } = req.params;

    // Use variant-service for proper cleanup (settings, config, session files)
    const result = removeVariant(name);

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ name, deleted: true, port: result.variant?.port });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
