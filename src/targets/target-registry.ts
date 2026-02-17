/**
 * Target Registry
 *
 * Map-based registry for target adapters.
 * Adapters self-register at startup; lookup is O(1).
 */

import { TargetAdapter, TargetType } from './target-adapter';

const adapters = new Map<TargetType, TargetAdapter>();

/**
 * Register a target adapter. Overwrites if already registered.
 */
export function registerTarget(adapter: TargetAdapter): void {
  adapters.set(adapter.type, adapter);
}

/**
 * Get a registered target adapter by type.
 * @throws Error if target type is not registered
 */
export function getTarget(type: TargetType): TargetAdapter {
  const adapter = adapters.get(type);
  if (!adapter) {
    const available = Array.from(adapters.keys()).join(', ');
    throw new Error(`Unknown target "${type}". Available: ${available}`);
  }
  return adapter;
}

/**
 * Get the default target adapter ('claude').
 * @throws Error if claude adapter is not registered
 */
export function getDefaultTarget(): TargetAdapter {
  return getTarget('claude');
}

/**
 * Check if a target type is registered.
 */
export function hasTarget(type: TargetType): boolean {
  return adapters.has(type);
}

/**
 * Get all registered target types.
 */
export function getRegisteredTargets(): TargetType[] {
  return Array.from(adapters.keys());
}
