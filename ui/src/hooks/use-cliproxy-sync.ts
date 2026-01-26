/**
 * React Query hooks for CLIProxy sync functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/** Sync status response */
export interface SyncStatus {
  connected: boolean;
  configured: boolean;
  remoteUrl?: string;
  latencyMs?: number;
  version?: string;
  error?: string;
  errorCode?: string;
}

/** Sync preview item */
export interface SyncPreviewItem {
  name: string;
  baseUrl?: string;
  hasAliases: boolean;
  aliasCount: number;
}

/** Masked payload item for preview */
interface MaskedPayloadItem {
  'api-key': string;
  'base-url'?: string;
  prefix?: string;
  models?: { name: string; alias: string }[];
}

/** Sync preview response */
export interface SyncPreview {
  profiles: SyncPreviewItem[];
  payload: MaskedPayloadItem[];
  count: number;
}

/** Sync result response */
export interface SyncResult {
  success: boolean;
  syncedCount?: number;
  remoteUrl?: string;
  profiles?: string[];
  error?: string;
  errorCode?: string;
  message?: string;
}

/** Model alias */
export interface ModelAlias {
  from: string;
  to: string;
}

/** Aliases response */
export interface AliasesResponse {
  aliases: Record<string, ModelAlias[]>;
}

/**
 * Fetch sync status from API
 */
async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch('/api/cliproxy/sync/status');
  if (!response.ok) {
    let message = 'Failed to fetch sync status';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Fetch sync preview from API
 */
async function fetchSyncPreview(): Promise<SyncPreview> {
  const response = await fetch('/api/cliproxy/sync/preview');
  if (!response.ok) {
    let message = 'Failed to fetch sync preview';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Execute sync to remote CLIProxy
 */
async function executeSync(): Promise<SyncResult> {
  const response = await fetch('/api/cliproxy/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    let message = 'Sync failed';
    try {
      const data = await response.json();
      message = data.error || data.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch model aliases from API
 */
async function fetchAliases(): Promise<AliasesResponse> {
  const response = await fetch('/api/cliproxy/sync/aliases');
  if (!response.ok) {
    let message = 'Failed to fetch aliases';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Add a model alias
 */
async function addAlias(params: {
  profile: string;
  from: string;
  to: string;
}): Promise<{ success: boolean }> {
  const response = await fetch('/api/cliproxy/sync/aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let message = 'Failed to add alias';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Remove a model alias
 */
async function removeAlias(params: {
  profile: string;
  from: string;
}): Promise<{ success: boolean }> {
  const response = await fetch('/api/cliproxy/sync/aliases', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let message = 'Failed to remove alias';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Hook to get sync status
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ['cliproxy-sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
    staleTime: 10000,
  });
}

/**
 * Hook to get sync preview
 */
export function useSyncPreview() {
  return useQuery({
    queryKey: ['cliproxy-sync-preview'],
    queryFn: fetchSyncPreview,
    staleTime: 5000,
    retry: 1,
  });
}

/**
 * Hook to execute sync
 */
export function useExecuteSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executeSync,
    onSuccess: () => {
      // Invalidate sync-related queries after successful sync
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-preview'] });
    },
  });
}

/**
 * Hook to get model aliases
 */
export function useSyncAliases() {
  return useQuery({
    queryKey: ['cliproxy-sync-aliases'],
    queryFn: fetchAliases,
    staleTime: 30000,
    retry: 1,
  });
}

/**
 * Hook to add a model alias
 */
export function useAddAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addAlias,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-aliases'] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-preview'] });
    },
  });
}

/**
 * Hook to remove a model alias
 */
export function useRemoveAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeAlias,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-aliases'] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-preview'] });
    },
  });
}
