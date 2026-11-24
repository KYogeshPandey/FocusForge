import { cn } from '../../utils/cn';

export interface RoundIndicatorProps {
  completedRounds: number;
  totalRounds?: number;
  currentRound?: number;
  longBreakInterval?: number;
}

export function RoundIndicator({
  completedRounds,
  totalRounds = 4,
  currentRound,
  longBreakInterval = 4,
}: RoundIndicatorProps) {
  const displayTotal = Math.max(1, totalRounds || longBreakInterval);
  const displayRound = currentRound ?? Math.min(completedRounds + 1, displayTotal);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="text-xs font-semibold text-text-muted">
        Round <span className="text-text font-bold">{displayRound}</span> of{' '}
        <span className="text-text font-bold">{displayTotal}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center max-w-xs">
        {Array.from({ length: displayTotal }).map((_, idx) => {
          const isDone = idx < completedRounds;
          const isCurrent = idx === completedRounds && completedRounds < displayTotal;

          return (
            <div
              key={idx}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all duration-normal',
                isDone
                  ? 'bg-primary'
                  : isCurrent
                  ? 'bg-primary-soft border-2 border-primary scale-125'
                  : 'bg-surface-2 border border-border'
              )}
              title={`Round ${idx + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
