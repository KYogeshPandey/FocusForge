import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudySessionService, getUserScope } from '../services/serviceFactory';
import { useAuthStore } from '../stores/useAuthStore';
import type {
  CreateStudySessionInput,
  UpdateStudySessionInput,
} from '@focusforge/shared';

export const STUDY_SESSION_QUERY_KEYS = {
  all: (scope?: string) => ['study_sessions', scope || getUserScope()] as const,
  list: (date?: string, scope?: string) =>
    ['study_sessions', scope || getUserScope(), 'list', date] as const,
};

export function useStudySessions(date?: string) {
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useQuery({
    queryKey: STUDY_SESSION_QUERY_KEYS.list(date, scope),
    queryFn: () => getStudySessionService().list(date),
  });
}

export function useCreateStudySession() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (input: CreateStudySessionInput) => getStudySessionService().create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDY_SESSION_QUERY_KEYS.all(scope) });
    },
  });
}

export function useUpdateStudySession() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateStudySessionInput }) =>
      getStudySessionService().update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDY_SESSION_QUERY_KEYS.all(scope) });
    },
  });
}

export function useDeleteStudySession() {
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => (s.status === 'authenticated' && s.user?.id ? s.user.id : 'guest'));

  return useMutation({
    mutationFn: (id: string) => getStudySessionService().remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDY_SESSION_QUERY_KEYS.all(scope) });
    },
  });
}
