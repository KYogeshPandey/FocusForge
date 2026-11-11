import { apiClient } from './apiClient';
import type { ISettingsService } from '../settingsService';
import type { Settings, UpdateSettingsInput, UserProfile } from '@focusforge/shared';

export class ApiSettingsService implements ISettingsService {
  async get(): Promise<Settings> {
    const user = await apiClient.get<UserProfile>('/auth/me');
    const prefs = user.preferences || {};

    return {
      theme: prefs.theme || 'dark',
      focusDuration: prefs.focusDuration ?? 25,
      shortBreakDuration: prefs.shortBreakDuration ?? 5,
      longBreakDuration: prefs.longBreakDuration ?? 15,
      longBreakInterval: prefs.longBreakInterval ?? 4,
      soundEnabled: prefs.soundEnabled ?? true,
      soundVolume: prefs.soundVolume ?? 70,
      weekStartDay: prefs.weekStartDay || 'monday',
      timezone: prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      demoDataLoaded: false,
      userName: user.name || 'Alex Rivera',
    };
  }

  async update(input: UpdateSettingsInput): Promise<Settings> {
    const name = input.userName;
    const prefFields = { ...input };
    delete prefFields.userName;
    delete prefFields.demoDataLoaded;

    await apiClient.patch<UserProfile>('/auth/me', {
      ...(name !== undefined ? { name } : {}),
      preferences: prefFields,
    });

    // Apply theme changes to DOM
    if (input.theme) {
      let resolved = input.theme;
      if (resolved === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', resolved);
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    return this.get();
  }

  async resetDemoData(): Promise<void> {
    // In API mode, reset local demo data without affecting remote account
    localStorage.clear();
  }

  async clearAllData(): Promise<void> {
    localStorage.clear();
  }
}

export const apiSettingsService = new ApiSettingsService();
