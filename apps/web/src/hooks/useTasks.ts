import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTaskService, getUserScope } from '../services/serviceFactory';
import { useAuthStore } from '../stores/useAuthStore';
import type { TaskFilter, CreateTaskInput, UpdateTaskInput, Task } from '@focusforge/shared';

export const TASK_QUERY_KEYS = {
  all: (scope?: string) => ['tasks', scope || getUserScope()] as const,
  list: (filters?: TaskFilter, scope?: string) =>
    ['tasks', scope || getUserScope(), 'list', filters] as const,
  detail: (id: string, scope?: string) =>
    ['tasks', scope || getUserScope(), 'detail', id] as const,
};

export function useTasks(filters?: TaskFilter) {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: TASK_QUERY_KEYS.list(filters, scope),
    queryFn: () => getTaskService().list(filters),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: CreateTaskInput) => getTaskService().create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all(scope) });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) =>
      getTaskService().update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all(scope) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (id: string) => getTaskService().remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all(scope) });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (id: string) => getTaskService().toggleStatus(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: TASK_QUERY_KEYS.all(scope) });
      const previousQueries = queryClient.getQueriesData<Task[]>({
        queryKey: TASK_QUERY_KEYS.all(scope),
      });

      // Optimistically flip task status
      queryClient.setQueriesData<Task[]>({ queryKey: TASK_QUERY_KEYS.all(scope) }, (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
        );
      });

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      // Rollback to previous state on failure
      if (context?.previousQueries) {
        context.previousQueries.forEach(([qKey, data]) => {
          queryClient.setQueryData(qKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all(scope) });
    },
  });
}
