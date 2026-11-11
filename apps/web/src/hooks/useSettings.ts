import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettingsService, getUserScope } from '../services/serviceFactory';
import { useAuthStore } from '../stores/useAuthStore';
import type { UpdateSettingsInput } from '@focusforge/shared';

export const SETTINGS_QUERY_KEYS = {
  current: (scope?: string) => ['settings', scope || getUserScope(), 'current'] as const,
};

export function useSettings() {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.current(scope),
    queryFn: () => getSettingsService().get(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => getSettingsService().update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.current(scope) });
    },
  });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getSettingsService().resetDemoData(),
    onSuccess: () => {
      // Invalidate everything to refresh demo state across the app
      queryClient.invalidateQueries();
    },
  });
}

export function useClearAllData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getSettingsService().clearAllData(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
