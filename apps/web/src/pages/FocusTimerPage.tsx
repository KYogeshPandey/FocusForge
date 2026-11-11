import { useState, useMemo } from 'react';
import { Maximize2, Minimize2, BookOpen, Clock } from 'lucide-react';
import { useTimerStore } from '../stores/useTimerStore';
import { useFocusSessions } from '../hooks/useFocusSessions';
import { useTasks } from '../hooks/useTasks';
import { TimerRing } from '../components/timer/TimerRing';
import { ModeSwitcher } from '../components/timer/ModeSwitcher';
import { TimerControls } from '../components/timer/TimerControls';
import { RoundIndicator } from '../components/timer/RoundIndicator';
import { Card } from '../components/ui/Card';
import { formatDuration, isDateToday } from '../utils/dates';
import { cn } from '../utils/cn';
import type { Task, FocusSession } from '@focusforge/shared';

export default function FocusTimerPage() {
  const {
    mode,
    status,
    remainingSeconds,
    totalDurationSeconds,
    progressPercentage,
    completedRounds,
    subject,
    taskId,
    taskTitle,
    start,
    pause,
    resume,
    reset,
    skip,
    setMode,
    setSubject,
    setLinkedTask,
  } = useTimerStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: focusSessions = [] } = useFocusSessions();
  const { data: tasks = [] } = useTasks();

  // Calculate today's focus minutes strictly from stored records
  const todayFocusMinutes = useMemo(() => {
    return focusSessions
      .filter((s: FocusSession) => s.mode === 'focus' && isDateToday(s.startedAt.slice(0, 10)))
      .reduce((acc: number, s: FocusSession) => acc + s.durationMinutes, 0);
  }, [focusSessions]);

  const activeTasks = useMemo(() => {
    return tasks.filter((t: Task) => t.status !== 'done');
  }, [tasks]);

  const handleTaskSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setLinkedTask(null, null);
    } else {
      const task = tasks.find((t: Task) => t.id === selectedId);
      if (task) {
        setLinkedTask(task.id, task.title, task.subject);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      className={cn(
        'max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-between min-h-[calc(100vh-8rem)] transition-all',
        isFullscreen && 'fixed inset-0 z-50 bg-bg p-6 max-w-none justify-center'
      )}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Focus Timer
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Pomodoro technique with automatic session tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit distraction-free mode' : 'Enter distraction-free mode'}
          className="p-2 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isFullscreen ? 'Exit Fullscreen' : 'Distraction-Free'}
          </span>
        </button>
      </div>

      {/* Main Center Timer Box */}
      <div className="w-full flex flex-col items-center my-6">
        {/* Mode Switcher */}
        <div className="mb-6">
          <ModeSwitcher
            currentMode={mode}
            onSelectMode={setMode}
            disabled={status === 'running'}
          />
        </div>

        {/* Circular Ring */}
        <TimerRing
          remainingSeconds={remainingSeconds}
          totalDurationSeconds={totalDurationSeconds}
          progressPercentage={progressPercentage}
          mode={mode}
          status={status}
          taskTitle={taskTitle}
          subject={subject}
        />

        {/* Round Progress Indicator */}
        <div className="mt-4">
          <RoundIndicator completedRounds={completedRounds} longBreakInterval={4} />
        </div>

        {/* Controls */}
        <TimerControls
          status={status}
          onStart={start}
          onPause={pause}
          onResume={resume}
          onReset={reset}
          onSkip={skip}
        />
      </div>

      {/* Footer / Context Card: Link Task & Today's Summary */}
      {!isFullscreen && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {/* Linked Task Selector */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-text mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Attach to Task / Subject</span>
            </div>
            <div className="space-y-2">
              <select
                value={taskId || ''}
                onChange={handleTaskSelect}
                aria-label="Link a task to this session"
                className="w-full h-9 px-3 text-xs bg-surface-2 text-text border border-border rounded-input truncate"
              >
                <option value="">-- No linked task (Use Custom Subject) --</option>
                {activeTasks.map((t: Task) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.subject})
                  </option>
                ))}
              </select>

              {!taskId && (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter study subject e.g. Mathematics"
                  aria-label="Custom subject name"
                  className="w-full h-8 px-3 text-xs bg-surface-2 text-text border border-border rounded-input"
                />
              )}
            </div>
          </Card>

          {/* Today's Focus Total */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-text-muted font-medium">Today's Focus Logged</div>
              <div className="text-xl sm:text-2xl font-bold text-text tabular-nums mt-0.5">
                {formatDuration(todayFocusMinutes)}
              </div>
              <div className="text-[11px] text-text-subtle mt-0.5">
                Automatically recorded on round completion
              </div>
            </div>
            <div className="w-10 h-10 rounded-button bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
