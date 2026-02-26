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
  sharedCount: number;
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
      const isolatedCount = authAccounts.length - sharedCount;
      const legacyContextCount = authAccounts.filter((account) => account.context_inferred).length;
      const defaultAccount = authAccounts.some((account) => account.name === data.default)
        ? data.default
        : null;

      return {
        accounts: authAccounts,
        default: defaultAccount,
        cliproxyCount,
        legacyContextCount,
        sharedCount,
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
    }: {
      name: string;
      context_mode: 'isolated' | 'shared';
      context_group?: string;
    }) => api.accounts.updateContext(name, { context_mode, context_group }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      const contextSummary =
        vars.context_mode === 'shared'
          ? `shared (${(vars.context_group || 'default').trim().toLowerCase().replace(/\s+/g, '-')})`
          : 'isolated';
      toast.success(`Updated "${vars.name}" context to ${contextSummary}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
