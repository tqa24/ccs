/**
 * API Profile Types
 *
 * Shared type definitions for API profile services.
 */

import type { TargetType } from '../../targets/target-adapter';

/** Model mapping for API profiles */
export interface ModelMapping {
  default: string;
  opus: string;
  sonnet: string;
  haiku: string;
}

/** API profile info for listing */
export interface ApiProfileInfo {
  name: string;
  settingsPath: string;
  isConfigured: boolean;
  configSource: 'unified' | 'legacy';
  target: TargetType;
}

/** CLIProxy variant info */
export interface CliproxyVariantInfo {
  name: string;
  provider: string;
  settings: string;
  target: TargetType;
}

/** Result from list operation */
export interface ApiListResult {
  profiles: ApiProfileInfo[];
  variants: CliproxyVariantInfo[];
}

/** Result from create operation */
export interface CreateApiProfileResult {
  success: boolean;
  settingsFile: string;
  error?: string;
}

/** Result from remove operation */
export interface RemoveApiProfileResult {
  success: boolean;
  error?: string;
}

/** Result from updating API profile target */
export interface UpdateApiProfileTargetResult {
  success: boolean;
  target?: TargetType;
  error?: string;
}
