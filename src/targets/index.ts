/**
 * Target Adapter Module
 *
 * Re-exports for convenient access to target adapter types and registry.
 */

export type {
  TargetAdapter,
  TargetBinaryInfo,
  TargetCredentials,
  TargetType,
} from './target-adapter';
export {
  registerTarget,
  getTarget,
  getDefaultTarget,
  hasTarget,
  getRegisteredTargets,
} from './target-registry';
export { ClaudeAdapter } from './claude-adapter';
export { DroidAdapter } from './droid-adapter';
export { getDroidBinaryInfo, detectDroidCli, checkDroidVersion } from './droid-detector';
export {
  upsertCcsModel,
  removeCcsModel,
  listCcsModels,
  pruneOrphanedModels,
} from './droid-config-manager';
export type { DroidCustomModel } from './droid-config-manager';
export { resolveDroidProvider, normalizeDroidProvider } from './droid-provider';
export type { DroidProvider } from './droid-provider';
export { resolveTargetType, stripTargetFlag } from './target-resolver';
