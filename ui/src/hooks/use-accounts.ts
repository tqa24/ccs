/**
 * React Query hooks for account management
 * Dashboard parity: Full CRUD operations for auth profiles
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
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
