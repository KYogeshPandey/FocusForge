import { Flame } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface StreakBadgeProps {
  currentStreak: number;
  bestStreak: number;
  completedToday?: boolean;
  className?: string;
}

export function StreakBadge({
  currentStreak,
  bestStreak,
  completedToday = false,
  className,
}: StreakBadgeProps) {
  const hasStreak = currentStreak > 0;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none transition-all',
        hasStreak
          ? completedToday
            ? 'bg-warning/15 text-warning border border-warning/30'
            : 'bg-surface-2 text-text border border-border'
          : 'bg-surface-2 text-text-subtle border border-border/50',
        className
      )}
      title={`Current streak: ${currentStreak} days | Best streak: ${bestStreak} days`}
    >
      <Flame
        className={cn(
          'w-4 h-4',
          hasStreak ? 'text-warning fill-warning/30' : 'text-text-subtle'
        )}
      />
      <span>
        {currentStreak} <span className="text-[10px] text-text-muted font-normal">/ {bestStreak}d</span>
      </span>
    </div>
  );
}
