import type { FocusMode } from '@focusforge/shared';
import { formatSeconds } from '../../utils/dates';

export interface TimerRingProps {
  remainingSeconds: number;
  totalDurationSeconds: number;
  progressPercentage: number;
  mode: FocusMode;
  status: 'idle' | 'running' | 'paused';
  taskTitle: string | null;
  subject: string;
}

export function TimerRing({
  remainingSeconds,
  progressPercentage,
  mode,
  status,
  taskTitle,
  subject,
}: TimerRingProps) {
  const radius = 135;
  const circumference = 2 * Math.PI * radius;
  // Progress stroke: offset decreases as time completes
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  const modeColors: Record<FocusMode, { stroke: string; glow: string; text: string }> = {
    focus: {
      stroke: 'var(--primary)',
      glow: 'rgba(139, 92, 246, 0.25)',
      text: 'text-primary',
    },
    'short-break': {
      stroke: 'var(--success)',
      glow: 'rgba(34, 197, 94, 0.25)',
      text: 'text-success',
    },
    'long-break': {
      stroke: 'var(--secondary)',
      glow: 'rgba(59, 130, 246, 0.25)',
      text: 'text-secondary',
    },
  };

  const currentColor = modeColors[mode];

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* SVG Circle Ring */}
        <svg
          className="w-full h-full transform -rotate-90 select-none"
          viewBox="0 0 320 320"
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx="160"
            cy="160"
            r={radius}
            className="stroke-surface-2"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Animated Progress Circle */}
          <circle
            cx="160"
            cy="160"
            r={radius}
            stroke={currentColor.stroke}
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
            style={{
              filter: status === 'running' ? `drop-shadow(0 0 8px ${currentColor.glow})` : 'none',
            }}
          />
        </svg>

        {/* Inner Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 select-none">
          {/* Status Badge */}
          <span className="text-xs uppercase tracking-widest font-bold text-text-muted mb-1">
            {status === 'running' ? (
              <span className="flex items-center gap-1.5 text-text">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                In Progress
              </span>
            ) : status === 'paused' ? (
              <span className="text-warning">Paused</span>
            ) : (
              'Ready'
            )}
          </span>

          {/* Large Tabular Countdown Display */}
          <div
            className="text-5xl sm:text-6xl font-bold tracking-tight text-text tabular-nums my-1"
            aria-live="polite"
            aria-label={`${Math.floor(remainingSeconds / 60)} minutes and ${remainingSeconds % 60} seconds remaining`}
          >
            {formatSeconds(remainingSeconds)}
          </div>

          {/* Attached Task or Subject Tag */}
          <div className="mt-2 max-w-[200px]">
            {taskTitle ? (
              <div className="text-xs font-medium text-text truncate" title={taskTitle}>
                {taskTitle}
              </div>
            ) : (
              <div className="text-xs font-semibold text-text-muted">
                {subject}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
