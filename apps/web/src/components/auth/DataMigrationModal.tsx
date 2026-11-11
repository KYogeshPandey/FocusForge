import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiClient } from '../../services/api/apiClient';
import { LocalStorageAdapter } from '../../services/storage/storageAdapter';
import { ImportDataSchema, type ImportData, type Goal, type Settings } from '@focusforge/shared';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Flame,
  Calendar,
  Trash2,
} from 'lucide-react';

const DISMISSED_KEY = 'focusforge_migration_dismissed';

export function DataMigrationModal() {
  const queryClient = useQueryClient();
  const { status, user } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    tasks: number;
    habits: number;
    sessions: number;
  } | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    // Only check when authenticated
    if (status !== 'authenticated' || !user) return;

    // Check if dismissed
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;

    try {
      const tasks = LocalStorageAdapter.getItem<Array<{ id?: string }>>(
        LocalStorageAdapter.tasksKey,
        []
      );
      const habits = LocalStorageAdapter.getItem<Array<{ id?: string }>>(
        LocalStorageAdapter.habitsKey,
        []
      );
      const studySessions = LocalStorageAdapter.getItem<Array<{ id?: string }>>(
        LocalStorageAdapter.studySessionsKey,
        []
      );
      const focusSessions = LocalStorageAdapter.getItem<Array<{ id?: string }>>(
        LocalStorageAdapter.focusSessionsKey,
        []
      );
      const settings = LocalStorageAdapter.getItem<{ demoDataLoaded?: boolean }>(
        LocalStorageAdapter.settingsKey,
        {}
      );

      // Check if there is non-demo custom data
      const hasCustomTasks = tasks.some((t) => t.id && !t.id.startsWith('task-'));
      const hasCustomHabits = habits.some((h) => h.id && !h.id.startsWith('habit-'));
      const hasCustomData =
        hasCustomTasks ||
        hasCustomHabits ||
        settings.demoDataLoaded === false;

      const totalItems = tasks.length + habits.length + studySessions.length + focusSessions.length;

      if (hasCustomData && totalItems > 0) {
        setImportSummary({
          tasks: tasks.length,
          habits: habits.length,
          sessions: studySessions.length + focusSessions.length,
        });
        setIsOpen(true);
      }
    } catch {
      // Ignore reading errors
    }
  }, [status, user]);

  const handleSkip = () => {
    setIsOpen(false);
  };

  const handleDontAskAgain = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsOpen(false);
  };

  const handleImport = async () => {
    if (isImporting) return; // Prevent double click
    setIsImporting(true);
    setError(null);

    try {
      const rawTasks = LocalStorageAdapter.getItem(LocalStorageAdapter.tasksKey, []);
      const rawHabits = LocalStorageAdapter.getItem(LocalStorageAdapter.habitsKey, []);
      const rawCompletions = LocalStorageAdapter.getItem(
        LocalStorageAdapter.habitCompletionsKey,
        []
      );
      const rawStudySessions = LocalStorageAdapter.getItem(
        LocalStorageAdapter.studySessionsKey,
        []
      );
      const rawFocusSessions = LocalStorageAdapter.getItem(
        LocalStorageAdapter.focusSessionsKey,
        []
      );
      const rawGoal = LocalStorageAdapter.getItem<Goal | null>(LocalStorageAdapter.goalKey, null);
      const rawSettings = LocalStorageAdapter.getItem<Settings | null>(LocalStorageAdapter.settingsKey, null);

      const payload: ImportData = {
        tasks: rawTasks,
        habits: rawHabits,
        habitCompletions: rawCompletions,
        studySessions: rawStudySessions,
        focusSessions: rawFocusSessions,
        goal: rawGoal ? { targetMinutesWeekly: rawGoal.targetMinutesWeekly } : undefined,
        settings: rawSettings
          ? {
              theme: rawSettings.theme,
              focusDuration: rawSettings.focusDuration,
              shortBreakDuration: rawSettings.shortBreakDuration,
              longBreakDuration: rawSettings.longBreakDuration,
              longBreakInterval: rawSettings.longBreakInterval,
              soundEnabled: rawSettings.soundEnabled,
              soundVolume: rawSettings.soundVolume,
              weekStartDay: rawSettings.weekStartDay,
              timezone: rawSettings.timezone,
            }
          : undefined,
      };

      // Validate client-side first
      const validated = ImportDataSchema.parse(payload);

      // Send to POST /api/v1/import
      await apiClient.post('/import', validated);

      // Mark migration done
      localStorage.setItem(DISMISSED_KEY, 'true');

      // Invalidate queries so imported data appears
      queryClient.invalidateQueries();

      setImportSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to import data. Please check connection.');
      } else {
        setError('An unexpected error occurred during data import.');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearLocalData = () => {
    LocalStorageAdapter.clearAllData();
    setIsOpen(false);
  };

  const handleKeepLocalCopy = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={importSuccess ? () => setIsOpen(false) : handleSkip}
      title={importSuccess ? 'Import Complete!' : 'Import Your Local Data'}
      description={
        importSuccess
          ? 'Your local records were safely copied into your FocusForge account.'
          : 'We found study records in this browser. Would you like to import them into your account?'
      }
    >
      <div className="space-y-5 text-sm">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-button flex items-start gap-2.5 text-xs text-danger font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {importSuccess ? (
          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/30 rounded-card flex items-center gap-3 text-success">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold text-xs sm:text-sm">
                  Successfully imported all records!
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Your data is now permanently backed up to your account.
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-2 rounded-card text-xs text-text-muted space-y-1">
              <p className="font-semibold text-text">Local Storage Cleanup</p>
              <p>
                Would you like to clear the duplicate local copy in this browser to free up storage?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleKeepLocalCopy} className="w-full sm:w-auto">
                Keep Local Copy
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleClearLocalData}
                className="w-full sm:w-auto gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Local Data</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {importSummary && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface-2 rounded-card text-center space-y-1">
                  <CheckSquare className="w-5 h-5 mx-auto text-primary" />
                  <div className="font-bold text-base text-text">{importSummary.tasks}</div>
                  <div className="text-[10px] text-text-muted font-medium">Tasks</div>
                </div>
                <div className="p-3 bg-surface-2 rounded-card text-center space-y-1">
                  <Flame className="w-5 h-5 mx-auto text-warning" />
                  <div className="font-bold text-base text-text">{importSummary.habits}</div>
                  <div className="text-[10px] text-text-muted font-medium">Habits</div>
                </div>
                <div className="p-3 bg-surface-2 rounded-card text-center space-y-1">
                  <Calendar className="w-5 h-5 mx-auto text-secondary" />
                  <div className="font-bold text-base text-text">{importSummary.sessions}</div>
                  <div className="text-[10px] text-text-muted font-medium">Sessions</div>
                </div>
              </div>
            )}

            <p className="text-xs text-text-muted leading-relaxed">
              Importing will link your previous tasks and study sessions to your new profile so you
              can access them across all your devices.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleDontAskAgain}
                className="text-xs text-text-subtle hover:text-text-muted underline text-left"
              >
                Don&apos;t ask again
              </button>

              <div className="flex items-center gap-2 justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={handleSkip}>
                  Skip
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleImport}
                  isLoading={isImporting}
                  disabled={isImporting}
                  className="gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Import Records</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
