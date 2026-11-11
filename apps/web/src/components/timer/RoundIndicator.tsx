import { cn } from '../../utils/cn';

export interface RoundIndicatorProps {
  completedRounds: number;
  longBreakInterval: number;
}

export function RoundIndicator({ completedRounds, longBreakInterval = 4 }: RoundIndicatorProps) {
  const currentRoundInCycle = (completedRounds % longBreakInterval) + 1;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="text-xs font-semibold text-text-muted">
        Round <span className="text-text font-bold">{currentRoundInCycle}</span> of{' '}
        <span className="text-text font-bold">{longBreakInterval}</span>
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: longBreakInterval }).map((_, idx) => {
          const isDone = idx < (completedRounds % longBreakInterval);
          const isCurrent = idx === completedRounds % longBreakInterval;

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
