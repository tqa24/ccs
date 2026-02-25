import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiConflictError, withApiBase } from '@/lib/api-client';

export interface DroidBinaryDiagnostics {
  installed: boolean;
  path: string | null;
  installDir: string | null;
  source: 'CCS_DROID_PATH' | 'PATH' | 'missing';
  version: string | null;
  overridePath: string | null;
}

export interface DroidConfigFileDiagnostics {
  label: string;
  path: string;
  resolvedPath: string;
  exists: boolean;
  isSymlink: boolean;
  isRegularFile: boolean;
  sizeBytes: number | null;
  mtimeMs: number | null;
  parseError: string | null;
  readError: string | null;
}

export interface DroidCustomModelDiagnostics {
  displayName: string;
  model: string;
  provider: string;
  baseUrl: string;
  host: string | null;
  maxOutputTokens: number | null;
  isCcsManaged: boolean;
  apiKeyState: 'set' | 'missing';
  apiKeyPreview: string | null;
}

export interface DroidDashboardDiagnostics {
  binary: DroidBinaryDiagnostics;
  files: {
    settings: DroidConfigFileDiagnostics;
    legacyConfig: DroidConfigFileDiagnostics;
  };
  byok: {
    activeModelSelector: string | null;
    customModelCount: number;
    ccsManagedCount: number;
    userManagedCount: number;
    invalidModelEntryCount: number;
    providerBreakdown: Record<string, number>;
    customModels: DroidCustomModelDiagnostics[];
  };
  warnings: string[];
  docsReference: {
    providerValues: string[];
    settingsHierarchy: string[];
    notes: string[];
  };
}

export interface DroidRawSettings {
  path: string;
  resolvedPath: string;
  exists: boolean;
  mtime: number;
  rawText: string;
  settings: Record<string, unknown> | null;
  parseError: string | null;
}

interface SaveDroidRawSettingsInput {
  rawText: string;
  expectedMtime?: number;
}

interface SaveDroidRawSettingsResponse {
  success: true;
  mtime: number;
}

async function fetchDroidDiagnostics(): Promise<DroidDashboardDiagnostics> {
  const res = await fetch(withApiBase('/droid/diagnostics'));
  if (!res.ok) throw new Error('Failed to fetch Droid diagnostics');
  return res.json();
}

async function fetchDroidRawSettings(): Promise<DroidRawSettings> {
  const res = await fetch(withApiBase('/droid/settings/raw'));
  if (!res.ok) throw new Error('Failed to fetch Droid raw settings');
  return res.json();
}

async function saveDroidRawSettings(
  data: SaveDroidRawSettingsInput
): Promise<SaveDroidRawSettingsResponse> {
  const res = await fetch(withApiBase('/droid/settings/raw'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new ApiConflictError('Droid raw settings changed externally');

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Failed to save Droid raw settings');
  }
  return res.json();
}

export function useDroid() {
  const queryClient = useQueryClient();

  const diagnosticsQuery = useQuery({
    queryKey: ['droid-diagnostics'],
    queryFn: fetchDroidDiagnostics,
    refetchInterval: 10000,
  });

  const rawSettingsQuery = useQuery({
    queryKey: ['droid-raw-settings'],
    queryFn: fetchDroidRawSettings,
  });

  const saveRawSettingsMutation = useMutation({
    mutationFn: saveDroidRawSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['droid-diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['droid-raw-settings'] });
    },
  });

  return useMemo(
    () => ({
      diagnostics: diagnosticsQuery.data,
      diagnosticsLoading: diagnosticsQuery.isLoading,
      diagnosticsError: diagnosticsQuery.error,
      refetchDiagnostics: diagnosticsQuery.refetch,

      rawSettings: rawSettingsQuery.data,
      rawSettingsLoading: rawSettingsQuery.isLoading,
      rawSettingsError: rawSettingsQuery.error,
      refetchRawSettings: rawSettingsQuery.refetch,

      saveRawSettings: saveRawSettingsMutation.mutate,
      saveRawSettingsAsync: saveRawSettingsMutation.mutateAsync,
      isSavingRawSettings: saveRawSettingsMutation.isPending,
    }),
    [
      diagnosticsQuery.data,
      diagnosticsQuery.isLoading,
      diagnosticsQuery.error,
      diagnosticsQuery.refetch,
      rawSettingsQuery.data,
      rawSettingsQuery.isLoading,
      rawSettingsQuery.error,
      rawSettingsQuery.refetch,
      saveRawSettingsMutation.mutate,
      saveRawSettingsMutation.mutateAsync,
      saveRawSettingsMutation.isPending,
    ]
  );
}
