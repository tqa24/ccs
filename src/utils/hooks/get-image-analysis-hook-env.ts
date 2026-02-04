/**
 * Image Analysis Hook Environment Variables
 *
 * Provides environment variables for image analysis hook configuration.
 * Hook routes image/PDF files through CLIProxy for vision analysis.
 *
 * @module utils/hooks/image-analysis-hook-env
 */

import { getImageAnalysisConfig } from '../../config/unified-config-loader';

/**
 * Get image analysis hook environment variables.
 * These env vars control the hook's behavior via Claude Code hook system.
 *
 * @param profileName - Current profile name (to determine if native Claude)
 * @returns Environment variables for image analysis hook
 */
export function getImageAnalysisHookEnv(profileName?: string): Record<string, string> {
  const config = getImageAnalysisConfig();

  // Native Claude profiles (no CLIProxy) should skip image analysis
  const isNativeProfile = !profileName || ['claude', 'anthropic'].includes(profileName);
  const skipImageAnalysis = isNativeProfile || !config.enabled;

  return {
    CCS_IMAGE_ANALYSIS_ENABLED: config.enabled ? '1' : '0',
    CCS_IMAGE_ANALYSIS_MODEL: config.model,
    CCS_IMAGE_ANALYSIS_TIMEOUT: config.timeout.toString(),
    CCS_IMAGE_ANALYSIS_PROVIDERS: config.providers.join(','),
    CCS_IMAGE_ANALYSIS_SKIP: skipImageAnalysis ? '1' : '0',
  };
}
