import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHabitService, getUserScope } from '../services/serviceFactory';
import { useAuthStore } from '../stores/useAuthStore';
import type {
  CreateHabitInput,
  UpdateHabitInput,
  ToggleHabitInput,
  HabitCompletion,
} from '@focusforge/shared';

export const HABIT_QUERY_KEYS = {
  all: (scope?: string) => ['habits', scope || getUserScope()] as const,
  list: (includeArchived?: boolean, scope?: string) =>
    ['habits', scope || getUserScope(), 'list', includeArchived] as const,
  completions: (scope?: string) => ['habit_completions', scope || getUserScope()] as const,
  habitCompletions: (habitId?: string, scope?: string) =>
    habitId
      ? (['habit_completions', scope || getUserScope(), habitId] as const)
      : (['habit_completions', scope || getUserScope()] as const),
};

export function useHabits(includeArchived = false) {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: HABIT_QUERY_KEYS.list(includeArchived, scope),
    queryFn: () => getHabitService().list(includeArchived),
  });
}

export function useHabitCompletions(habitId?: string) {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: HABIT_QUERY_KEYS.habitCompletions(habitId, scope),
    queryFn: () => getHabitService().listCompletions(habitId),
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: CreateHabitInput) => getHabitService().create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_QUERY_KEYS.all(scope) });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateHabitInput }) =>
      getHabitService().update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_QUERY_KEYS.all(scope) });
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (id: string) => getHabitService().archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_QUERY_KEYS.all(scope) });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (id: string) => getHabitService().remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_QUERY_KEYS.all(scope) });
      queryClient.invalidateQueries({ queryKey: HABIT_QUERY_KEYS.completions(scope) });
    },
  });
}

export function useToggleHabitCompletion() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: ToggleHabitInput) => getHabitService().toggleCompletion(input),
    onMutate: async (input: ToggleHabitInput) => {
      await queryClient.cancelQueries({ queryKey: HABIT_QUERY_KEYS.completions(scope) });
      const previousQueries = queryClient.getQueriesData<HabitCompletion[]>({
        queryKey: HABIT_QUERY_KEYS.completions(scope),
      });

      // Optimistically update habit completions in cache
      queryClient.setQueriesData<HabitCompletion[]>(
        { queryKey: HABIT_QUERY_KEYS.completions(scope) },
        (old) => {
          if (!old) return old;
          const idx = old.findIndex((c) => c.habitId === input.habitId && c.date === input.date);
          if (idx !== -1) {
            const next = [...old];
            const curr = next[idx]!;
            const nextCompleted = input.completed !== undefined ? input.completed : !curr.completed;
            next[idx] = { ...curr, completed: nextCompleted };
            return next;
          } else {
            return [
              ...old,
              {
                id: `opt_${Date.now()}`,
                userId: scope,
                habitId: input.habitId,
                date: input.date,
                completed: input.completed !== undefined ? input.completed : true,
                createdAt: new Date().toISOString(),
              },
            ];
          }
        }
      );

      return { previousQueries };
    },
    onError: (_err, _input, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(([qKey, data]) => {
          queryClient.setQueryData(qKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_QUERY_KEYS.completions(scope) });
    },
  });
}
