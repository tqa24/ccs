/**
 * React Query hooks for CLIProxy variants and accounts
 * Phase 03: REST API Routes & CRUD
 * Phase 06: Multi-Account Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreateVariant, type UpdateVariant } from '@/lib/api-client';
import { toast } from 'sonner';

export function useCliproxy() {
  return useQuery({
    queryKey: ['cliproxy'],
    queryFn: () => api.cliproxy.list(),
  });
}

export function useCliproxyAuth() {
  return useQuery({
    queryKey: ['cliproxy-auth'],
    queryFn: () => api.cliproxy.auth(),
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVariant) => api.cliproxy.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy'] });
      toast.success('Variant created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateVariant }) =>
      api.cliproxy.update(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy'] });
      toast.success('Variant updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.cliproxy.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy'] });
      toast.success('Variant deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Multi-account management hooks
export function useCliproxyAccounts() {
  return useQuery({
    queryKey: ['cliproxy-accounts'],
    queryFn: () => api.cliproxy.accounts.list(),
  });
}

export function useProviderAccounts(provider: string) {
  return useQuery({
    queryKey: ['cliproxy-accounts', provider],
    queryFn: () => api.cliproxy.accounts.listByProvider(provider),
    enabled: !!provider,
  });
}

export function useSetDefaultAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, accountId }: { provider: string; accountId: string }) =>
      api.cliproxy.accounts.setDefault(provider, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
      toast.success('Default account updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRemoveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, accountId }: { provider: string; accountId: string }) =>
      api.cliproxy.accounts.remove(provider, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
      toast.success('Account removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
