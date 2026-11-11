import { create } from 'zustand';
import type { Theme } from '@focusforge/shared';
import { settingsService } from '../services/settingsService';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => Promise<void>;
  initializeTheme: () => Promise<void>;
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return theme;
}

function applyThemeToDOM(resolved: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', resolved);
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  initializeTheme: async () => {
    try {
      const settings = await settingsService.get();
      const resolved = resolveTheme(settings.theme);
      applyThemeToDOM(resolved);
      set({ theme: settings.theme, resolvedTheme: resolved });

      // Listen to OS preference changes if on 'system'
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        mediaQuery.addEventListener('change', () => {
          if (get().theme === 'system') {
            const newResolved = resolveTheme('system');
            applyThemeToDOM(newResolved);
            set({ resolvedTheme: newResolved });
          }
        });
      }
    } catch (err) {
      console.warn('Failed to initialize theme:', err);
    }
  },

  setTheme: async (theme: Theme) => {
    const resolved = resolveTheme(theme);
    applyThemeToDOM(resolved);
    set({ theme, resolvedTheme: resolved });
    await settingsService.update({ theme });
  },
}));
