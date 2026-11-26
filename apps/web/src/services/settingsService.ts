import { LocalStorageAdapter } from './storage/storageAdapter';
import {
  SettingsSchema,
  UpdateSettingsInputSchema,
  type Settings,
  type UpdateSettingsInput,
} from '@focusforge/shared';

export interface ISettingsService {
  get(): Promise<Settings>;
  update(input: UpdateSettingsInput): Promise<Settings>;
  resetDemoData(): Promise<void>;
  clearAllData(): Promise<void>;
}

export class SettingsService implements ISettingsService {
  async get(): Promise<Settings> {
    const defaults: Settings = {
      theme: 'dark',
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 5,
      soundEnabled: true,
      soundVolume: 70,
      alarmEnabled: true,
      alarmVolume: 70,
      alarmSound: 'chime',
      weekStartDay: 'monday',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      demoDataLoaded: true,
      userName: 'Alex Rivera',
    };
    const raw = LocalStorageAdapter.getItem<Partial<Settings>>(LocalStorageAdapter.settingsKey, defaults);
    return {
      ...defaults,
      ...raw,
      longBreakInterval: 5,
    };
  }

  async update(input: UpdateSettingsInput): Promise<Settings> {
    const validated = UpdateSettingsInputSchema.parse(input);
    const current = await this.get();
    const updated: Settings = {
      ...current,
      ...validated,
      longBreakInterval: 5,
    };

    const normalized = SettingsSchema.parse(updated);
    LocalStorageAdapter.setItem(LocalStorageAdapter.settingsKey, normalized);

    // Apply theme changes to document
    if (updated.theme) {
      let resolved = updated.theme;
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

    return normalized;
  }

  async resetDemoData(): Promise<void> {
    LocalStorageAdapter.resetToDemoData();
  }

  async clearAllData(): Promise<void> {
    LocalStorageAdapter.clearAllData();
  }
}

export const settingsService = new SettingsService();
