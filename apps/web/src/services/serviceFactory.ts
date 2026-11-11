import { useAuthStore } from '../stores/useAuthStore';
import { queryClient } from '../queryClient';
import { taskService, type ITaskService } from './taskService';
import { apiTaskService } from './api/apiTaskService';
import { habitService, type IHabitService } from './habitService';
import { apiHabitService } from './api/apiHabitService';
import { studySessionService, type IStudySessionService } from './studySessionService';
import { apiStudySessionService } from './api/apiStudySessionService';
import { focusSessionService, type IFocusSessionService } from './focusSessionService';
import { apiFocusSessionService } from './api/apiFocusSessionService';
import { goalService, type IGoalService } from './goalService';
import { apiGoalService } from './api/apiGoalService';
import { settingsService, type ISettingsService } from './settingsService';
import { apiSettingsService } from './api/apiSettingsService';

export function getUserScope(): string {
  const { user, status } = useAuthStore.getState();
  if (status === 'authenticated' && user?.id) {
    return user.id;
  }
  return 'guest';
}

export function getTaskService(): ITaskService {
  return useAuthStore.getState().status === 'authenticated' ? apiTaskService : taskService;
}

export function getHabitService(): IHabitService {
  return useAuthStore.getState().status === 'authenticated' ? apiHabitService : habitService;
}

export function getStudySessionService(): IStudySessionService {
  return useAuthStore.getState().status === 'authenticated'
    ? apiStudySessionService
    : studySessionService;
}

export function getFocusSessionService(): IFocusSessionService {
  return useAuthStore.getState().status === 'authenticated'
    ? apiFocusSessionService
    : focusSessionService;
}

export function getGoalService(): IGoalService {
  return useAuthStore.getState().status === 'authenticated' ? apiGoalService : goalService;
}

export function getSettingsService(): ISettingsService {
  return useAuthStore.getState().status === 'authenticated' ? apiSettingsService : settingsService;
}

// Automatically reset and wipe query cache when auth identity shifts (guest <-> user A <-> user B)
let previousScope = getUserScope();

useAuthStore.subscribe((state) => {
  const currentScope = state.status === 'authenticated' && state.user?.id ? state.user.id : 'guest';
  if (currentScope !== previousScope) {
    previousScope = currentScope;
    // Wipe all cached queries to ensure zero cross-user cache contamination
    queryClient.clear();
    queryClient.invalidateQueries();
  }
});
