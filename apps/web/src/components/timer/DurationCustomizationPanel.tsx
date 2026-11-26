import { useState, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import {
  FOCUS_DURATION_PRESETS,
  BREAK_DURATION_PRESETS,
  LONG_BREAK_DURATION_PRESETS,
  FIXED_LONG_BREAK_INTERVAL,
  TIMER_DURATION_LIMITS,
  validateDurationMinutes,
} from '../../utils/timer';
import type { CustomDurationInput } from '../../stores/useTimerStore';

export interface DurationCustomizationPanelProps {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  isSessionActive: boolean;
  onUpdateDurations: (input: CustomDurationInput) => Promise<unknown>;
  onResetDefaults: () => Promise<unknown>;
}

export function DurationCustomizationPanel({
  focusDuration,
  shortBreakDuration,
  longBreakDuration,
  isSessionActive,
  onUpdateDurations,
  onResetDefaults,
}: DurationCustomizationPanelProps) {
  const [focusInput, setFocusInput] = useState(String(focusDuration));
  const [breakInput, setBreakInput] = useState(String(shortBreakDuration));
  const [longBreakInput, setLongBreakInput] = useState(String(longBreakDuration));

  const [focusError, setFocusError] = useState<string | null>(null);
  const [breakError, setBreakError] = useState<string | null>(null);
  const [longBreakError, setLongBreakError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFocusInput(String(focusDuration));
  }, [focusDuration]);

  useEffect(() => {
    setBreakInput(String(shortBreakDuration));
  }, [shortBreakDuration]);

  useEffect(() => {
    setLongBreakInput(String(longBreakDuration));
  }, [longBreakDuration]);

  const applySettingField = async (
    rawValue: string | number,
    limits: { min: number; max: number },
    fieldKey: keyof CustomDurationInput,
    setError: (msg: string | null) => void,
    syncInput: (val: string) => void
  ) => {
    const check = validateDurationMinutes(rawValue, limits.min, limits.max, 'minutes');
    if (!check.valid) {
      setError(check.error);
      return;
    }
    setError(null);
    setSaveError(null);
    setIsSaving(true);
    try {
      await onUpdateDurations({ [fieldKey]: check.value });
      syncInput(String(check.value));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save timer settings.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setFocusError(null);
    setBreakError(null);
    setLongBreakError(null);
    setSaveError(null);
    setIsSaving(true);
    try {
      await onResetDefaults();
      setFocusInput(String(TIMER_DURATION_LIMITS.focus.default));
      setBreakInput(String(TIMER_DURATION_LIMITS.shortBreak.default));
      setLongBreakInput(String(TIMER_DURATION_LIMITS.longBreak.default));
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to reset timer defaults. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isCustomDefault =
    focusDuration !== TIMER_DURATION_LIMITS.focus.default ||
    shortBreakDuration !== TIMER_DURATION_LIMITS.shortBreak.default ||
    longBreakDuration !== TIMER_DURATION_LIMITS.longBreak.default;

  return (
    <Card className="p-4 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-semibold text-text">Custom Timer Durations</h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-muted tabular-nums">
            Focus {focusDuration}m · Short {shortBreakDuration}m · Long {longBreakDuration}m · Long
            break every {FIXED_LONG_BREAK_INTERVAL} rounds
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isSessionActive && (
            <span className="text-[11px] font-medium text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
              Active timer unchanged · applies next session
            </span>
          )}
          {isCustomDefault && (
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={isSaving}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text transition-colors"
              aria-label="Reset durations to default 25/5/15 and 5 rounds"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Defaults
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-[11px] text-danger font-medium mb-3">
          {saveError}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Focus Duration Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="custom-focus-minutes" className="text-xs font-medium text-text-muted">
              Focus Duration (minutes)
            </label>
            <span className="text-[11px] text-text-subtle">
              {TIMER_DURATION_LIMITS.focus.min}–{TIMER_DURATION_LIMITS.focus.max}m
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Focus duration presets">
            {FOCUS_DURATION_PRESETS.map((minutes) => {
              const isSelected = focusDuration === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isSaving}
                  onClick={() =>
                    applySettingField(
                      minutes,
                      TIMER_DURATION_LIMITS.focus,
                      'focusDuration',
                      setFocusError,
                      setFocusInput
                    )
                  }
                  className={cn(
                    'px-2.5 py-1 rounded-button text-xs font-semibold border transition-all',
                    isSelected
                      ? 'bg-primary-btn text-white border-primary shadow-sm'
                      : 'bg-surface-2 text-text-muted border-border hover:text-text hover:border-text-subtle'
                  )}
                >
                  {minutes}m
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              applySettingField(
                focusInput,
                TIMER_DURATION_LIMITS.focus,
                'focusDuration',
                setFocusError,
                setFocusInput
              );
            }}
            noValidate
            className="flex items-center gap-2 pt-0.5"
          >
            <input
              id="custom-focus-minutes"
              type="number"
              min={TIMER_DURATION_LIMITS.focus.min}
              max={TIMER_DURATION_LIMITS.focus.max}
              step={1}
              value={focusInput}
              onChange={(e) => {
                setFocusInput(e.target.value);
                if (focusError) setFocusError(null);
              }}
              aria-label="Custom focus minutes"
              aria-invalid={Boolean(focusError)}
              className="w-24 h-8 px-2.5 text-xs bg-surface-2 text-text border border-border rounded-input tabular-nums"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isSaving}
              className="h-8 px-3 text-xs"
            >
              Set Focus
            </Button>
          </form>

          {focusError && (
            <p role="alert" className="text-[11px] text-danger font-medium">
              {focusError}
            </p>
          )}
        </div>

        {/* Short Break Duration Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="custom-break-minutes" className="text-xs font-medium text-text-muted">
              Short Break Duration (minutes)
            </label>
            <span className="text-[11px] text-text-subtle">
              {TIMER_DURATION_LIMITS.shortBreak.min}–{TIMER_DURATION_LIMITS.shortBreak.max}m
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Break duration presets">
            {BREAK_DURATION_PRESETS.map((minutes) => {
              const isSelected = shortBreakDuration === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isSaving}
                  onClick={() =>
                    applySettingField(
                      minutes,
                      TIMER_DURATION_LIMITS.shortBreak,
                      'shortBreakDuration',
                      setBreakError,
                      setBreakInput
                    )
                  }
                  className={cn(
                    'px-2.5 py-1 rounded-button text-xs font-semibold border transition-all',
                    isSelected
                      ? 'bg-success text-white border-success shadow-sm'
                      : 'bg-surface-2 text-text-muted border-border hover:text-text hover:border-text-subtle'
                  )}
                >
                  {minutes}m
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              applySettingField(
                breakInput,
                TIMER_DURATION_LIMITS.shortBreak,
                'shortBreakDuration',
                setBreakError,
                setBreakInput
              );
            }}
            noValidate
            className="flex items-center gap-2 pt-0.5"
          >
            <input
              id="custom-break-minutes"
              type="number"
              min={TIMER_DURATION_LIMITS.shortBreak.min}
              max={TIMER_DURATION_LIMITS.shortBreak.max}
              step={1}
              value={breakInput}
              onChange={(e) => {
                setBreakInput(e.target.value);
                if (breakError) setBreakError(null);
              }}
              aria-label="Custom break minutes"
              aria-invalid={Boolean(breakError)}
              className="w-24 h-8 px-2.5 text-xs bg-surface-2 text-text border border-border rounded-input tabular-nums"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isSaving}
              className="h-8 px-3 text-xs"
            >
              Set Break
            </Button>
          </form>

          {breakError && (
            <p role="alert" className="text-[11px] text-danger font-medium">
              {breakError}
            </p>
          )}
        </div>

        {/* Long Break Duration Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="custom-long-break-minutes"
              className="text-xs font-medium text-text-muted"
            >
              Long Break Duration (minutes)
            </label>
            <span className="text-[11px] text-text-subtle">
              {TIMER_DURATION_LIMITS.longBreak.min}–{TIMER_DURATION_LIMITS.longBreak.max}m
            </span>
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Long break duration presets"
          >
            {LONG_BREAK_DURATION_PRESETS.map((minutes) => {
              const isSelected = longBreakDuration === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isSaving}
                  onClick={() =>
                    applySettingField(
                      minutes,
                      TIMER_DURATION_LIMITS.longBreak,
                      'longBreakDuration',
                      setLongBreakError,
                      setLongBreakInput
                    )
                  }
                  className={cn(
                    'px-2.5 py-1 rounded-button text-xs font-semibold border transition-all',
                    isSelected
                      ? 'bg-secondary text-white border-secondary shadow-sm'
                      : 'bg-surface-2 text-text-muted border-border hover:text-text hover:border-text-subtle'
                  )}
                >
                  {minutes}m
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              applySettingField(
                longBreakInput,
                TIMER_DURATION_LIMITS.longBreak,
                'longBreakDuration',
                setLongBreakError,
                setLongBreakInput
              );
            }}
            noValidate
            className="flex items-center gap-2 pt-0.5"
          >
            <input
              id="custom-long-break-minutes"
              type="number"
              min={TIMER_DURATION_LIMITS.longBreak.min}
              max={TIMER_DURATION_LIMITS.longBreak.max}
              step={1}
              value={longBreakInput}
              onChange={(e) => {
                setLongBreakInput(e.target.value);
                if (longBreakError) setLongBreakError(null);
              }}
              aria-label="Custom long break minutes"
              aria-invalid={Boolean(longBreakError)}
              className="w-24 h-8 px-2.5 text-xs bg-surface-2 text-text border border-border rounded-input tabular-nums"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isSaving}
              className="h-8 px-3 text-xs"
            >
              Set Long Break
            </Button>
          </form>

          {longBreakError && (
            <p role="alert" className="text-[11px] text-danger font-medium">
              {longBreakError}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
