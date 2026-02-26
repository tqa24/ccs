/**
 * React Query hooks for account management
 * Dashboard parity: Full CRUD operations for auth profiles
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Account } from '@/lib/api-client';
import { toast } from 'sonner';

export interface AuthAccountsView {
  accounts: Account[];
  default: string | null;
  cliproxyCount: number;
  legacyContextCount: number;
  legacyContinuityCount: number;
  sharedCount: number;
  sharedStandardCount: number;
  deeperSharedCount: number;
  isolatedCount: number;
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
    select: (data): AuthAccountsView => {
      const authAccounts = data.accounts.filter((account) => account.type !== 'cliproxy');
      const cliproxyCount = data.accounts.length - authAccounts.length;
      const sharedCount = authAccounts.filter(
        (account) => account.context_mode === 'shared'
      ).length;
      const deeperSharedCount = authAccounts.filter(
        (account) => account.context_mode === 'shared' && account.continuity_mode === 'deeper'
      ).length;
      const sharedStandardCount = Math.max(sharedCount - deeperSharedCount, 0);
      const isolatedCount = authAccounts.length - sharedCount;
      const legacyContextCount = authAccounts.filter((account) => account.context_inferred).length;
      const legacyContinuityCount = authAccounts.filter(
        (account) =>
          account.context_mode === 'shared' &&
          account.continuity_mode !== 'deeper' &&
          account.continuity_inferred
      ).length;
      const defaultAccount = authAccounts.some((account) => account.name === data.default)
        ? data.default
        : null;

      return {
        accounts: authAccounts,
        default: defaultAccount,
        cliproxyCount,
        legacyContextCount,
        legacyContinuityCount,
        sharedCount,
        sharedStandardCount,
        deeperSharedCount,
        isolatedCount,
      };
    },
  });
}

export function useSetDefaultAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.accounts.setDefault(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Default account set to "${name}"`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useResetDefaultAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.accounts.resetDefault(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Default account reset to CCS');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.accounts.delete(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Account "${name}" deleted`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateAccountContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      context_mode,
      context_group,
      continuity_mode,
    }: {
      name: string;
      context_mode: 'isolated' | 'shared';
      context_group?: string;
      continuity_mode?: 'standard' | 'deeper';
    }) => api.accounts.updateContext(name, { context_mode, context_group, continuity_mode }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      const contextSummary =
        vars.context_mode === 'shared'
          ? vars.continuity_mode === 'deeper'
            ? `shared (${(vars.context_group || 'default').trim().toLowerCase().replace(/\s+/g, '-')}, deeper continuity)`
            : `shared (${(vars.context_group || 'default').trim().toLowerCase().replace(/\s+/g, '-')}, standard)`
          : 'isolated';
      toast.success(`Updated "${vars.name}" context to ${contextSummary}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useConfirmLegacyAccountPolicies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accounts: Account[]) => {
      const legacyTargets = accounts.filter(
        (account) => account.context_inferred || account.continuity_inferred
      );

      for (const account of legacyTargets) {
        const isShared = account.context_mode === 'shared';
        await api.accounts.updateContext(account.name, {
          context_mode: isShared ? 'shared' : 'isolated',
          context_group: isShared ? account.context_group || 'default' : undefined,
          continuity_mode: isShared
            ? account.continuity_mode === 'deeper'
              ? 'deeper'
              : 'standard'
            : undefined,
        });
      }

      return { updatedCount: legacyTargets.length };
    },
    onSuccess: ({ updatedCount }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      if (updatedCount > 0) {
        toast.success(
          `Confirmed explicit sync mode for ${updatedCount} legacy account${updatedCount > 1 ? 's' : ''}`
        );
        return;
      }

      toast.info('No legacy accounts need confirmation');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
