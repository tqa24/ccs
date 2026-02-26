/**
 * Types for Profile Editor
 */

import type { CliTarget } from '@/lib/api-client';

export interface Settings {
  env?: Record<string, string>;
}

export interface SettingsResponse {
  profile: string;
  settings: Settings;
  mtime: number;
  path: string;
}

export interface ProfileEditorProps {
  profileName: string;
  profileTarget?: CliTarget;
  onDelete?: () => void;
  onHasChangesUpdate?: (hasChanges: boolean) => void;
}
