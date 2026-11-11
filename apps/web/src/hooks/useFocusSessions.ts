import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFocusSessionService, getUserScope } from '../services/serviceFactory';
import { useAuthStore } from '../stores/useAuthStore';
import type { CreateFocusSessionInput } from '@focusforge/shared';

export const FOCUS_SESSION_QUERY_KEYS = {
  all: (scope?: string) => ['focus_sessions', scope || getUserScope()] as const,
};

export function useFocusSessions() {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: FOCUS_SESSION_QUERY_KEYS.all(scope),
    queryFn: () => getFocusSessionService().list(),
  });
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: CreateFocusSessionInput) => getFocusSessionService().create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOCUS_SESSION_QUERY_KEYS.all(scope) });
    },
  });
}
