import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGoalService, getUserScope } from '../services/serviceFactory';
import { useAuthStore } from '../stores/useAuthStore';
import type { UpdateGoalInput } from '@focusforge/shared';

export const GOAL_QUERY_KEYS = {
  current: (scope?: string) => ['goal', scope || getUserScope(), 'current'] as const,
};

export function useGoal() {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: GOAL_QUERY_KEYS.current(scope),
    queryFn: () => getGoalService().get(),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: UpdateGoalInput) => getGoalService().update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOAL_QUERY_KEYS.current(scope) });
    },
  });
}
