import { generateSeedData } from '../../data/seedData';
import type { Settings } from '@focusforge/shared';

const STORAGE_KEYS = {
  INITIALIZED: 'focusforge_v1_initialized',
  TASKS: 'focusforge_v1_tasks',
  HABITS: 'focusforge_v1_habits',
  HABIT_COMPLETIONS: 'focusforge_v1_habit_completions',
  STUDY_SESSIONS: 'focusforge_v1_study_sessions',
  FOCUS_SESSIONS: 'focusforge_v1_focus_sessions',
  GOAL: 'focusforge_v1_goal',
  SETTINGS: 'focusforge_v1_settings',
} as const;

export class LocalStorageAdapter {
  /**
   * Initializes storage with realistic demo data on first launch
   */
  public static ensureInitialized(): void {
    try {
      const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!isInitialized) {
        this.resetToDemoData();
      }
    } catch (err) {
      console.error('Failed to initialize local storage:', err);
    }
  }

  /**
   * Resets all stored data back to realistic demo seed data
   */
  public static resetToDemoData(): void {
    try {
      const seed = generateSeedData();
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(seed.tasks));
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(seed.habits));
      localStorage.setItem(STORAGE_KEYS.HABIT_COMPLETIONS, JSON.stringify(seed.habitCompletions));
      localStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(seed.studySessions));
      localStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(seed.focusSessions));
      localStorage.setItem(STORAGE_KEYS.GOAL, JSON.stringify(seed.goal));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(seed.settings));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    } catch (err) {
      console.error('Failed to write demo data to storage:', err);
    }
  }

  /**
   * Clears all user data (leaves empty lists and non-demo settings)
   */
  public static clearAllData(): void {
    try {
      const currentSettings = this.getItem<Settings>(STORAGE_KEYS.SETTINGS, {
        theme: 'dark',
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        soundEnabled: true,
        soundVolume: 70,
        weekStartDay: 'monday',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        demoDataLoaded: false,
        userName: 'Alex Rivera',
      });

      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.HABIT_COMPLETIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify([]));
      localStorage.setItem(
        STORAGE_KEYS.GOAL,
        JSON.stringify({
          id: 'goal-custom',
          userId: 'user-default',
          targetMinutesWeekly: 600,
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify({
          ...currentSettings,
          demoDataLoaded: false,
        })
      );
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    } catch (err) {
      console.error('Failed to clear data from storage:', err);
    }
  }

  /**
   * Safe getter with JSON error recovery
   */
  public static getItem<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`Corrupted storage item for key "${key}". Recovering with fallback value.`, err);
      return fallback;
    }
  }

  /**
   * Safe setter with quota error handling
   */
  public static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to set storage item for key "${key}":`, err);
    }
  }

  // Typed key accessors
  public static get tasksKey() {
    return STORAGE_KEYS.TASKS;
  }
  public static get habitsKey() {
    return STORAGE_KEYS.HABITS;
  }
  public static get habitCompletionsKey() {
    return STORAGE_KEYS.HABIT_COMPLETIONS;
  }
  public static get studySessionsKey() {
    return STORAGE_KEYS.STUDY_SESSIONS;
  }
  public static get focusSessionsKey() {
    return STORAGE_KEYS.FOCUS_SESSIONS;
  }
  public static get goalKey() {
    return STORAGE_KEYS.GOAL;
  }
  public static get settingsKey() {
    return STORAGE_KEYS.SETTINGS;
  }
}

// Auto ensure initialized on module load
if (typeof window !== 'undefined') {
  LocalStorageAdapter.ensureInitialized();
}
