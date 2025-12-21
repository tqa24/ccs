/**
 * Types for Profile Editor
 */

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
  onDelete?: () => void;
  onHasChangesUpdate?: (hasChanges: boolean) => void;
}
