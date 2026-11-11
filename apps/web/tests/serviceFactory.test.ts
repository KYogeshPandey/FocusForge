import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTaskService,
  getHabitService,
  getUserScope,
} from '../src/services/serviceFactory';
import { TaskService } from '../src/services/taskService';
import { ApiTaskService } from '../src/services/api/apiTaskService';
import { HabitService } from '../src/services/habitService';
import { ApiHabitService } from '../src/services/api/apiHabitService';
import { useAuthStore } from '../src/stores/useAuthStore';
import { queryClient } from '../src/queryClient';

describe('Service Factory & Auth Scope Resolution', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'guest',
      user: null,
      accessToken: null,
    });
  });

  it('provides LocalStorage service implementations when in guest mode', () => {
    useAuthStore.setState({ status: 'guest', user: null });

    expect(getTaskService()).toBeInstanceOf(TaskService);
    expect(getHabitService()).toBeInstanceOf(HabitService);
    expect(getUserScope()).toBe('guest');
  });

  it('switches to API service implementations when user is authenticated', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 'usr_test_123',
        name: 'Logged In User',
        email: 'user@test.com',
        preferences: {
          theme: 'dark',
          focusDuration: 25,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          longBreakInterval: 4,
          soundEnabled: true,
          soundVolume: 70,
          weekStartDay: 'monday',
          timezone: 'UTC',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accessToken: 'sample-token',
    });

    expect(getTaskService()).toBeInstanceOf(ApiTaskService);
    expect(getHabitService()).toBeInstanceOf(ApiHabitService);
    expect(getUserScope()).toBe('usr_test_123');
  });

  it('wipes and invalidates TanStack Query cache when switching auth identity', () => {
    const clearSpy = vi.spyOn(queryClient, 'clear');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Transition from guest to User A
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 'user_a',
        name: 'User A',
        email: 'a@test.com',
        preferences: {} as any,
        createdAt: '',
        updatedAt: '',
      },
    });

    expect(clearSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();

    clearSpy.mockClear();
    invalidateSpy.mockClear();

    // Transition from User A to User B
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 'user_b',
        name: 'User B',
        email: 'b@test.com',
        preferences: {} as any,
        createdAt: '',
        updatedAt: '',
      },
    });

    expect(clearSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
