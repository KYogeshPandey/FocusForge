import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UpdateSettingsInputSchema,
  type UpdateSettingsInput,
  type Theme,
} from '@focusforge/shared';
import {
  useSettings,
  useUpdateSettings,
  useResetDemoData,
  useClearAllData,
} from '../hooks/useSettings';
import { useGoal, useUpdateGoal } from '../hooks/useGoals';
import { useThemeStore } from '../stores/useThemeStore';
import { useToastStore } from '../stores/useToastStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AccountSettings } from '../components/settings/AccountSettings';
import { playChime } from '../utils/sound';
import {
  Sun,
  Moon,
  Monitor,
  Volume2,
  Calendar,
  RotateCcw,
  Trash2,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../utils/cn';

export default function SettingsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const resetDemo = useResetDemoData();
  const clearData = useClearAllData();

  const { data: goal } = useGoal();
  const updateGoal = useUpdateGoal();

  const { theme, setTheme } = useThemeStore();
  const { addToast } = useToastStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(900);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(UpdateSettingsInputSchema),
    defaultValues: {
      userName: 'Alex Rivera',
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      soundEnabled: true,
      soundVolume: 70,
      weekStartDay: 'monday',
    },
  });

  const currentSoundEnabled = watch('soundEnabled');
  const currentSoundVolume = watch('soundVolume') ?? 70;
  const currentWeekStart = watch('weekStartDay');

  useEffect(() => {
    if (settings) {
      reset({
        userName: settings.userName,
        focusDuration: settings.focusDuration,
        shortBreakDuration: settings.shortBreakDuration,
        longBreakDuration: settings.longBreakDuration,
        longBreakInterval: settings.longBreakInterval,
        soundEnabled: settings.soundEnabled,
        soundVolume: settings.soundVolume,
        weekStartDay: settings.weekStartDay,
      });
    }
  }, [settings, reset]);

  useEffect(() => {
    if (goal) {
      setWeeklyGoalMinutes(goal.targetMinutesWeekly);
    }
  }, [goal]);

  const onSaveSettings = async (data: UpdateSettingsInput) => {
    try {
      await updateSettings.mutateAsync(data);
      if (weeklyGoalMinutes !== goal?.targetMinutesWeekly) {
        await updateGoal.mutateAsync({ targetMinutesWeekly: weeklyGoalMinutes });
      }
      addToast({
        type: 'success',
        title: 'Settings saved',
        message: 'Your timer durations and study preferences have been updated.',
      });
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error saving settings',
        message: 'Please check your inputs and try again.',
      });
    }
  };

  const handleTestSound = () => {
    playChime(currentSoundVolume);
  };

  const handleResetDemoData = async () => {
    await resetDemo.mutateAsync();
    setShowResetConfirm(false);
    addToast({
      type: 'success',
      title: 'Demo data restored',
      message: 'Sample tasks, habits, and study sessions have been reset.',
    });
  };

  const handleClearAllData = async () => {
    await clearData.mutateAsync();
    setShowClearConfirm(false);
    addToast({
      type: 'info',
      title: 'All data cleared',
      message: 'You have a fresh, clean workspace ready for your own study routine.',
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">Settings</h1>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          Customize your appearance, timer intervals, notification sound, and storage data.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSaveSettings)} className="space-y-6">
        {/* Appearance Section */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Select your preferred theme. Defaults to dark charcoal with electric purple accents.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { id: 'dark' as Theme, label: 'Dark', icon: Moon },
              { id: 'light' as Theme, label: 'Light', icon: Sun },
              { id: 'system' as Theme, label: 'System', icon: Monitor },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 rounded-card border transition-all select-none',
                    isSelected
                      ? 'bg-primary-soft border-primary text-primary font-bold shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:text-text hover:border-text-subtle'
                  )}
                >
                  <Icon className="w-5 h-5 mb-2" />
                  <span className="text-xs">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Profile & Weekly Study Goal */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profile & Target</CardTitle>
              <CardDescription>Set your student name and weekly study commitment.</CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Input
              label="Student Name"
              placeholder="Alex Rivera"
              {...register('userName')}
            />

            <Input
              type="number"
              label="Weekly Study Goal (Minutes)"
              value={weeklyGoalMinutes}
              onChange={(e) => setWeeklyGoalMinutes(Number(e.target.value))}
              min={30}
              max={6000}
              step={30}
              hint={`Target: ${(weeklyGoalMinutes / 60).toFixed(1)} hours of focus per week`}
            />
          </div>
        </Card>

        {/* Focus Timer Durations */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Timer Configuration</CardTitle>
              <CardDescription>
                Configure the length of your focus and rest intervals (in minutes).
              </CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <Input
              type="number"
              label="Focus Duration"
              min={1}
              max={120}
              hint="Default: 25m"
              {...register('focusDuration', { valueAsNumber: true })}
            />

            <Input
              type="number"
              label="Short Break"
              min={1}
              max={30}
              hint="Default: 5m"
              {...register('shortBreakDuration', { valueAsNumber: true })}
            />

            <Input
              type="number"
              label="Long Break"
              min={1}
              max={60}
              hint="Default: 15m"
              {...register('longBreakDuration', { valueAsNumber: true })}
            />

            <Input
              type="number"
              label="Rounds for Long Break"
              min={1}
              max={12}
              hint="Default: 4 rounds"
              {...register('longBreakInterval', { valueAsNumber: true })}
            />
          </div>
        </Card>

        {/* Audio & Notifications */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sound & Alerts</CardTitle>
              <CardDescription>
                Play an ambient audio chime when a focus round or break concludes.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-4 pt-2">
            <Toggle
              label="Enable Interval Completion Sound"
              description="Uses Web Audio API synthesis without external network requests"
              checked={currentSoundEnabled}
              onChange={(e) => setValue('soundEnabled', e.target.checked, { shouldDirty: true })}
            />

            {currentSoundEnabled && (
              <div className="flex items-center gap-4 pt-2">
                <Volume2 className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                    <span>Volume</span>
                    <span>{currentSoundVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    aria-label="Chime Volume"
                    value={currentSoundVolume}
                    onChange={(e) =>
                      setValue('soundVolume', Number(e.target.value), { shouldDirty: true })
                    }
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestSound}
                  className="shrink-0"
                >
                  Test Chime
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Calendar Preferences */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Calendar Preferences</CardTitle>
              <CardDescription>
                Choose which day starts the week in your planner and goal charts.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="flex items-center gap-4 pt-2">
            <Calendar className="w-5 h-5 text-text-muted shrink-0" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  value="monday"
                  checked={currentWeekStart === 'monday'}
                  onChange={() => setValue('weekStartDay', 'monday', { shouldDirty: true })}
                  className="text-primary focus:ring-primary"
                />
                Monday (Default)
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  value="sunday"
                  checked={currentWeekStart === 'sunday'}
                  onChange={() => setValue('weekStartDay', 'sunday', { shouldDirty: true })}
                  className="text-primary focus:ring-primary"
                />
                Sunday
              </label>
            </div>
          </div>
        </Card>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" isLoading={isSubmitting} className="gap-2">
            {isDirty ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Save Preferences</span>
          </Button>
        </div>
      </form>

      {/* Account & Security Section */}
      <AccountSettings />

      {/* Data Management Section */}
      <Card className="border-border">
        <CardHeader>
          <div>
            <CardTitle>Storage & Demo Data</CardTitle>
            <CardDescription>
              Manage your browser storage records. All data persists across page refreshes.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowResetConfirm(true)}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo Data</span>
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={() => setShowClearConfirm(true)}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Data</span>
          </Button>
        </div>
      </Card>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetDemoData}
        title="Reset Demo Data"
        message="This will re-populate realistic sample tasks, habits, and 3 weeks of focus sessions. Any custom data will be replaced."
        confirmLabel="Reset"
        variant="primary"
      />

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllData}
        title="Clear All Stored Data"
        message="Are you sure you want to clear all tasks, habits, and recorded study sessions? You will start with an empty slate."
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  );
}
