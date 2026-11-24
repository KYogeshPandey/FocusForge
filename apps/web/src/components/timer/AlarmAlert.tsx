import { Bell, BellOff, Volume2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useTimerStore } from '../../stores/useTimerStore';
import { cn } from '../../utils/cn';

interface AlarmAlertProps {
  /**
   * If true, renders as a full in-page card (e.g. on FocusTimerPage).
   * If false, renders as a sticky top notification bar (e.g. across other pages in AppLayout).
   */
  variant?: 'page' | 'banner';
  className?: string;
}

export function AlarmAlert({ variant = 'page', className }: AlarmAlertProps) {
  const { isAlarmActive, alarmPeriodName, pauseAlarm, mode } = useTimerStore();

  if (!isAlarmActive) return null;

  const periodDisplayName = alarmPeriodName || (mode === 'focus' ? 'Focus Session' : 'Break');

  if (variant === 'banner') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          'sticky top-0 z-50 w-full bg-primary text-black px-4 py-2.5 shadow-lg flex items-center justify-between gap-3 animate-fade-in border-b border-primary/20',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-black/10 rounded-full animate-bounce shrink-0">
            <Bell className="w-4 h-4 fill-current" />
          </div>
          <div className="truncate text-xs sm:text-sm font-semibold">
            <span className="font-bold">Time's up!</span> · {periodDisplayName} completed
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={pauseAlarm}
            className="bg-black hover:bg-black/80 text-white font-semibold text-xs h-8 px-3 gap-1.5 shadow"
            aria-label="Pause Alarm"
          >
            <BellOff className="w-3.5 h-3.5" />
            <span>Pause Alarm</span>
          </Button>

          <Link
            to="/timer"
            className="text-xs font-semibold text-black hover:underline hidden sm:flex items-center gap-1 px-1.5 py-1"
          >
            <span>Timer</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Page variant: prominent card on FocusTimerPage
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'w-full max-w-md mx-auto my-4 p-5 rounded-card bg-surface-1 border-2 border-primary/60 shadow-xl flex flex-col items-center text-center animate-fade-in relative overflow-hidden',
        className
      )}
    >
      {/* Subtle pulsing background glow */}
      <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />

      {/* Ringing bell icon */}
      <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-3 animate-bounce shadow-inner">
        <Volume2 className="w-7 h-7" />
      </div>

      <h2 className="text-2xl font-extrabold text-text tracking-tight">Time's up!</h2>

      <p className="text-sm font-medium text-text-muted mt-1 max-w-xs">
        <span className="text-text font-semibold">{periodDisplayName}</span> has completed.
      </p>

      <p className="text-xs text-text-subtle mt-0.5">
        Alarm sound loops continuously until paused.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-4 w-full justify-center">
        <Button
          size="lg"
          onClick={pauseAlarm}
          className="w-44 h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-black shadow-md gap-2"
          aria-label="Pause Alarm"
        >
          <BellOff className="w-4 h-4" />
          <span>Pause Alarm</span>
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={pauseAlarm}
          className="h-11 text-sm font-medium px-4 text-text-muted hover:text-text"
          aria-label="Dismiss completion alert"
        >
          Dismiss
        </Button>
      </div>

      <div className="mt-3 text-[11px] text-text-subtle">
        The next period is ready to start when you are.
      </div>
    </div>
  );
}
